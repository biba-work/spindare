import Foundation

// Merging nearby Zone pins as the map zooms out, and splitting them apart
// again as it zooms in.
//
// SwiftUI's `Map` has no built-in clustering the way UIKit's `MKMapView` does
// via `MKAnnotationView.clusteringIdentifier` — there is no SwiftUI
// equivalent, so this exists to do the grouping by hand. It's driven by the
// map's current span (how much of the world is visible) rather than a fixed
// pixel distance: the same two venues should merge when the whole city is on
// screen and split apart once you've zoomed into their neighbourhood, and
// span is what changes between those two moments.

/// One merged pin. A cluster of one venue is the ordinary case — most of the
/// time nothing is close enough to merge with.
public struct VenueCluster: Identifiable, Sendable, Equatable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let venues: [Venue]

    public init(venues: [Venue]) {
        // Sorted so the id is stable regardless of the order clustering
        // happened to visit venues in — two runs over the same set must
        // produce the same cluster identity, or SwiftUI sees a
        // remove-and-reinsert instead of an update.
        self.id = venues.map(\.id).sorted().joined(separator: "+")
        self.latitude = venues.map(\.latitude).reduce(0, +) / Double(venues.count)
        self.longitude = venues.map(\.longitude).reduce(0, +) / Double(venues.count)
        self.venues = venues
    }

    public var count: Int { venues.count }
}

public enum VenueClustering {
    /// How close two venues have to be, as a fraction of the visible span, to
    /// merge into one pin. Checked against the actual seed coordinates in
    /// `MockSeed` (consecutive venues sit roughly 0.001–0.007° apart in
    /// latitude): at the default region (span 0.03°, all seven already
    /// visible) this merges the closest pairs but not the whole set — zooming
    /// out further scales the radius up and merges progressively more, which
    /// is the actual "zoomed out → merged" behaviour being asked for.
    public static let defaultRadiusFraction: Double = 0.15

    /// Groups venues whose distance is within `radiusFraction` of
    /// `latitudeSpan`. Greedy transitive grouping — if A is close to B and B
    /// is close to C, all three merge into one cluster even if A and C
    /// themselves are far apart — which is what you want visually: a chain of
    /// nearby pins should read as one blob, not as two overlapping ones.
    ///
    /// `latitudeSpan` alone (not a full `MKCoordinateSpan`) is deliberate:
    /// this file has no MapKit dependency, so it stays trivially testable —
    /// callers convert their own `region.span.latitudeDelta` when they call
    /// it, one line at the SwiftUI boundary.
    public static func cluster(
        _ venues: [Venue],
        latitudeSpan: Double,
        radiusFraction: Double = defaultRadiusFraction
    ) -> [VenueCluster] {
        guard !venues.isEmpty else { return [] }
        let radius = abs(latitudeSpan) * radiusFraction

        var remaining = venues
        var clusters: [VenueCluster] = []

        while !remaining.isEmpty {
            var group = [remaining.removeFirst()]

            // Repeatedly sweep for anything close to *any* current group
            // member — a single pass would miss a venue that's only close to
            // the second member absorbed, not the first.
            var grew = true
            while grew {
                grew = false
                remaining.removeAll { candidate in
                    let isClose = group.contains { isWithin(candidate, $0, radius: radius) }
                    if isClose {
                        group.append(candidate)
                        grew = true
                    }
                    return isClose
                }
            }

            clusters.append(VenueCluster(venues: group))
        }

        return clusters
    }

    private static func isWithin(_ a: Venue, _ b: Venue, radius: Double) -> Bool {
        // Chebyshev distance (max of the two axis deltas) rather than true
        // great-circle distance — cheap, and at the neighbourhood scale this
        // operates over, the difference from a proper haversine calculation
        // is not visually meaningful.
        abs(a.latitude - b.latitude) <= radius && abs(a.longitude - b.longitude) <= radius
    }

    /// A bounding region around a cluster's venues, padded so a zoom-to-fit
    /// doesn't leave pins pinned to the very edge of the screen. Used when a
    /// cluster is tapped: zoom to this, and the next re-cluster (triggered by
    /// the resulting span) naturally splits the group apart since the venues
    /// are now far relative to how much of the map is visible.
    public static func boundingRegion(
        for cluster: VenueCluster,
        paddingFraction: Double = 0.6,
        minimumSpan: Double = 0.006
    ) -> (center: (latitude: Double, longitude: Double), span: (latitudeDelta: Double, longitudeDelta: Double)) {
        let lats = cluster.venues.map(\.latitude)
        let lons = cluster.venues.map(\.longitude)

        let minLat = lats.min() ?? cluster.latitude
        let maxLat = lats.max() ?? cluster.latitude
        let minLon = lons.min() ?? cluster.longitude
        let maxLon = lons.max() ?? cluster.longitude

        let latDelta = max(minimumSpan, (maxLat - minLat) * (1 + paddingFraction))
        let lonDelta = max(minimumSpan, (maxLon - minLon) * (1 + paddingFraction))

        return (
            center: (latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2),
            span: (latitudeDelta: latDelta, longitudeDelta: lonDelta)
        )
    }
}
