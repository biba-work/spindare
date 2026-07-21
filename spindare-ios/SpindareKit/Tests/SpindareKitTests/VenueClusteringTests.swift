import Testing
@testable import SpindareKit

@Suite("Venue clustering")
struct VenueClusteringTests {
    private func venue(_ id: String, lat: Double, lon: Double, sponsored: Bool = false) -> Venue {
        Venue(
            id: id,
            name: id,
            category: .cafe,
            latitude: lat,
            longitude: lon,
            blurb: "",
            sponsoredChallenge: sponsored ? "test" : nil
        )
    }

    @Test("Two venues far apart, relative to the span, stay separate")
    func farApartVenuesDontMerge() {
        let venues = [venue("a", lat: 41.30, lon: 19.80), venue("b", lat: 41.50, lon: 19.80)]
        let clusters = VenueClustering.cluster(venues, latitudeSpan: 0.03)
        #expect(clusters.count == 2)
    }

    @Test("Two venues close, relative to the span, merge into one cluster")
    func closeVenuesMerge() {
        let venues = [venue("a", lat: 41.300, lon: 19.800), venue("b", lat: 41.3005, lon: 19.800)]
        let clusters = VenueClustering.cluster(venues, latitudeSpan: 0.03)
        #expect(clusters.count == 1)
        #expect(clusters[0].count == 2)
    }

    @Test("The same venues merge at a wide span and split at a narrow one")
    func zoomChangesClusteringOutcome() {
        let venues = [venue("a", lat: 41.300, lon: 19.800), venue("b", lat: 41.302, lon: 19.800)]

        let zoomedOut = VenueClustering.cluster(venues, latitudeSpan: 0.5)
        #expect(zoomedOut.count == 1, "Zoomed way out, these two should read as one pin")

        let zoomedIn = VenueClustering.cluster(venues, latitudeSpan: 0.001)
        #expect(zoomedIn.count == 2, "Zoomed in tight, they must be distinguishable again")
    }

    @Test("A chain of venues transitively merges even if the ends are far apart")
    func transitiveChainMerges() {
        // a-b close, b-c close, a-c NOT close on their own — but all three
        // must read as one cluster, or the map would show two overlapping
        // blobs instead of one.
        let venues = [
            venue("a", lat: 41.300, lon: 19.800),
            venue("b", lat: 41.301, lon: 19.800),
            venue("c", lat: 41.302, lon: 19.800),
        ]
        let clusters = VenueClustering.cluster(venues, latitudeSpan: 0.03)
        #expect(clusters.count == 1)
        #expect(clusters[0].count == 3)
    }

    @Test("Clustering never drops or duplicates a venue")
    func preservesEveryVenue() {
        let venues = (0..<12).map { venue("v\($0)", lat: 41.30 + Double($0) * 0.0003, lon: 19.80) }
        let clusters = VenueClustering.cluster(venues, latitudeSpan: 0.02)
        let allIds = clusters.flatMap { $0.venues.map(\.id) }
        #expect(Set(allIds) == Set(venues.map(\.id)))
        #expect(allIds.count == venues.count, "No venue must appear in more than one cluster")
    }

    @Test("An empty venue list produces no clusters")
    func emptyInputProducesNoClusters() {
        #expect(VenueClustering.cluster([], latitudeSpan: 0.03).isEmpty)
    }

    @Test("A single venue is its own cluster of one")
    func singleVenueIsItsOwnCluster() {
        let clusters = VenueClustering.cluster([venue("solo", lat: 41.3, lon: 19.8)], latitudeSpan: 0.03)
        #expect(clusters.count == 1)
        #expect(clusters[0].count == 1)
    }

    @Test("Cluster identity is stable regardless of input order")
    func clusterIdIsOrderIndependent() {
        let a = venue("a", lat: 41.300, lon: 19.800)
        let b = venue("b", lat: 41.3005, lon: 19.800)

        let forward = VenueClustering.cluster([a, b], latitudeSpan: 0.03)
        let reversed = VenueClustering.cluster([b, a], latitudeSpan: 0.03)

        #expect(forward.first?.id == reversed.first?.id)
    }

    @Test("The seed venues merge at the default region's span but not entirely")
    func seedVenuesBehaveReasonablyAtDefaultZoom() {
        // Pinned against real data rather than synthetic coordinates, since
        // the whole point of `defaultRadiusFraction` is that it was checked
        // against these exact venues, not picked blind.
        let clusters = VenueClustering.cluster(MockSeed.venues, latitudeSpan: 0.03)
        #expect(clusters.count > 1, "The default zoom must not merge every venue into a single pin")
        #expect(clusters.count < MockSeed.venues.count, "Some of the closer venues should already be merging")
    }

    @Test("Bounding region tightly frames a cluster's venues, with padding")
    func boundingRegionFramesTheCluster() {
        let cluster = VenueCluster(venues: [
            venue("a", lat: 41.30, lon: 19.80),
            venue("b", lat: 41.31, lon: 19.82),
        ])
        let region = VenueClustering.boundingRegion(for: cluster, paddingFraction: 0.5)

        #expect(region.center.latitude > 41.30 && region.center.latitude < 41.31)
        #expect(region.center.longitude > 19.80 && region.center.longitude < 19.82)
        // Span must comfortably exceed the raw spread (0.01) once padded.
        #expect(region.span.latitudeDelta > 0.01)
    }

    @Test("Bounding region never collapses to zero span for a tightly-packed cluster")
    func boundingRegionHasAMinimumSpan() {
        let cluster = VenueCluster(venues: [
            venue("a", lat: 41.30, lon: 19.80),
            venue("b", lat: 41.30, lon: 19.80),
        ])
        let region = VenueClustering.boundingRegion(for: cluster)
        #expect(region.span.latitudeDelta > 0)
        #expect(region.span.longitudeDelta > 0)
    }
}
