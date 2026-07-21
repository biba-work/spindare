import SwiftUI
import MapKit

// Sponsored places, on a map.
//
// Requests "when in use" location — never "Always", which this feature has no
// use for and would be requesting more than the code does anything with.
// Real location only ever *recenters the camera*: the venues themselves are
// fixed mock coordinates around Tirana regardless of where the device
// actually is, so a denied or unavailable location just leaves the map on
// that region instead of failing anything.

public struct ZoneView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var venues: [Venue] = []
    @State private var selected: Venue?
    @State private var isLoading = true
    @State private var location = LocationProvider()
    @State private var camera: MapCameraPosition = .region(Self.mockRegion)
    /// The map's own current span, kept in sync via `.onMapCameraChange` so
    /// clustering re-runs as you pinch — a fixed cluster computed once at
    /// launch wouldn't split apart on zoom-in or merge further on zoom-out at
    /// all, which is the entire feature.
    @State private var currentSpan = Self.mockRegion.span

    private let zoneService: any ZoneServing

    private static let mockRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(
            latitude: MockSeed.zoneCenter.latitude,
            longitude: MockSeed.zoneCenter.longitude
        ),
        span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)
    )

    public init(zoneService: any ZoneServing = MockZoneService()) {
        self.zoneService = zoneService
    }

    /// Once true, an incoming location fix no longer recenters the camera —
    /// otherwise a location update arriving *while you're panning the map*
    /// would yank it back out from under your finger.
    @State private var hasCenteredOnUser = false

    private var clusters: [VenueCluster] {
        VenueClustering.cluster(venues, latitudeSpan: currentSpan.latitudeDelta)
    }

    /// Where each *venue* — not each cluster — should currently render, and
    /// whether it's visible on its own.
    ///
    /// This is the actual fix for the merge/split animation never appearing:
    /// the first attempt gave each *cluster* its own `Annotation`, and a
    /// cluster's identity is the exact set of venue ids it holds — so the
    /// instant that set changes (which is every merge and every split), it's
    /// a different id, and `ForEach` sees a remove-and-insert rather than an
    /// update. Map's SwiftUI annotation bridging does not reliably animate
    /// that kind of insert/remove no matter what `.transition()` says,
    /// confirmed by that attempt visibly doing nothing.
    ///
    /// Per-*venue* identity never changes — the same seven ids exist at every
    /// zoom level, permanently. So instead of removing a venue's pin when it
    /// merges, it stays in the `ForEach` the whole time, and only its
    /// *coordinate* (own position vs. the shared cluster centroid) and
    /// *scale/opacity* (visible vs. converged-to-invisible) change — ordinary
    /// property animation on a view that was never removed, which is exactly
    /// what SwiftUI animates reliably regardless of Map's transition support.
    private var venueDisplay: [String: (coordinate: CLLocationCoordinate2D, isVisible: Bool)] {
        var result: [String: (CLLocationCoordinate2D, Bool)] = [:]
        for cluster in clusters {
            let isVisible = cluster.venues.count == 1
            let coordinate = isVisible
                ? cluster.venues[0].coordinate
                : CLLocationCoordinate2D(latitude: cluster.latitude, longitude: cluster.longitude)
            for venue in cluster.venues {
                result[venue.id] = (coordinate, isVisible)
            }
        }
        return result
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            Map(position: $camera) {
                UserAnnotation()

                ForEach(venues) { venue in
                    if let display = venueDisplay[venue.id] {
                        Annotation(venue.name, coordinate: display.coordinate) {
                            VenuePin(venue: venue, isSelected: selected?.id == venue.id) {
                                select(venue)
                            }
                            // Converges to a point at the cluster centroid
                            // and shrinks away, rather than vanishing — this
                            // is the actual "merge" motion.
                            .scaleEffect(display.isVisible ? 1 : 0.2)
                            .opacity(display.isVisible ? 1 : 0)
                            .allowsHitTesting(display.isVisible)
                            .animation(Spindare.Motion.precise, value: display.isVisible)
                        }
                    }
                }

                // The badge itself still has an unstable identity (it IS the
                // set of merged venues), so its own appearance is best-effort
                // — but the venues visibly gathering into its position above
                // is the part of "merge" that actually reads as one.
                ForEach(clusters.filter { $0.count > 1 }) { cluster in
                    Annotation(
                        "\(cluster.count) places",
                        coordinate: CLLocationCoordinate2D(latitude: cluster.latitude, longitude: cluster.longitude)
                    ) {
                        ClusterPin(count: cluster.count) {
                            zoom(into: cluster)
                        }
                        .transition(.scale(scale: 0.3).combined(with: .opacity))
                    }
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .onMapCameraChange(frequency: .continuous) { context in
                currentSpan = context.region.span
            }
            .ignoresSafeArea()

            if let selected {
                VenueSheet(venue: selected) {
                    guard let challenge = selected.sponsoredChallenge else { return }
                    router.startProof(for: challenge)
                } onClose: {
                    withAnimation(Spindare.Motion.precise) { self.selected = nil }
                }
                .padding(.horizontal, Spindare.Spacing.gutter)
                .padding(.bottom, 96)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if isLoading {
                ProgressView()
            }
        }
        .task { await load() }
        .task { location.start() }
        .onChange(of: location.coordinate) { _, coordinate in
            guard !hasCenteredOnUser, let coordinate else { return }
            hasCenteredOnUser = true
            withAnimation(Spindare.Motion.precise) {
                camera = .region(
                    MKCoordinateRegion(
                        center: CLLocationCoordinate2D(latitude: coordinate.latitude, longitude: coordinate.longitude),
                        span: Self.mockRegion.span
                    )
                )
            }
        }
    }

    private func select(_ venue: Venue) {
        withAnimation(Spindare.Motion.precise) {
            selected = selected?.id == venue.id ? nil : venue
        }
        Haptics.impact(.light)
    }

    /// Zooms tight around a tapped cluster's venues. This is the whole
    /// "tap them and all of them show" behaviour — it doesn't unpack the
    /// cluster directly, it changes the camera, and the smaller resulting
    /// span makes the *next* clustering pass (triggered by
    /// `.onMapCameraChange` above) split the group back into individual pins
    /// on its own.
    private func zoom(into cluster: VenueCluster) {
        let region = VenueClustering.boundingRegion(for: cluster)
        withAnimation(Spindare.Motion.precise) {
            camera = .region(
                MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: region.center.latitude, longitude: region.center.longitude),
                    span: MKCoordinateSpan(latitudeDelta: region.span.latitudeDelta, longitudeDelta: region.span.longitudeDelta)
                )
            )
        }
        Haptics.impact(.light)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        venues = (try? await zoneService.venues()) ?? []
    }
}

extension Venue {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - Pin

/// A big circle, as asked for — large enough to be a comfortable tap target on
/// a moving map, where a standard pin is fiddly.
private struct VenuePin: View {
    @Environment(\.colorScheme) private var scheme
    let venue: Venue
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .fill(venue.sponsoredChallenge == nil
                          ? AnyShapeStyle(Color.spindareSecondary(scheme))
                          : AnyShapeStyle(Spindare.Palette.accentDeep))
                    .frame(width: 44, height: 44)

                // Fixed size — animating a raw SF Symbol point size is what
                // was actually causing the "weird bounce": a glyph isn't a
                // smoothly-scalable vector under animation the way a Shape
                // is, so interpolating its font size re-rasterizes at
                // discrete steps, which reads as a jump rather than a zoom.
                // `.scaleEffect` below is a true geometric transform and
                // interpolates continuously, which is the actual "light
                // popup" being asked for.
                Image(systemName: venue.category.icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .overlay {
                Circle().strokeBorder(.white, lineWidth: 2.5)
            }
            .spindareElevation(.floating)
            // A venue with a live campaign gets a ring; one without is just a
            // partner on the map. The difference has to be visible before you
            // tap, or every pin looks like a challenge.
            .overlay {
                if venue.sponsoredChallenge != nil {
                    Circle()
                        .strokeBorder(Spindare.Palette.accent.opacity(0.55), lineWidth: 3)
                        .frame(width: 58, height: 58)
                }
            }
            .scaleEffect(isSelected ? 1.22 : 1)
        }
        .buttonStyle(.plain)
        .animation(Spindare.Motion.precise, value: isSelected)
    }
}

// MARK: - Cluster pin

/// Merged pins at low zoom — a plain count in a neutral circle, deliberately
/// undecorated relative to `VenuePin` (no sponsor ring, no category icon):
/// this is standing in for several different venues at once, and dressing it
/// up as any one of them would misrepresent what's actually there until you
/// zoom in.
private struct ClusterPin: View {
    @Environment(\.colorScheme) private var scheme
    let count: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .fill(Color.spindarePrimary(scheme))
                    .frame(width: 50, height: 50)
                Text("\(count)")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.spindareBackground(scheme))
            }
            .overlay {
                Circle().strokeBorder(.white, lineWidth: 2.5)
            }
            .spindareElevation(.floating)
        }
        .buttonStyle(PressableStyle())
    }
}

// MARK: - Detail

private struct VenueSheet: View {
    @Environment(\.colorScheme) private var scheme
    let venue: Venue
    let onTake: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
            HStack(alignment: .top, spacing: Spindare.Spacing.sm) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(venue.name)
                        .font(.system(size: 17, weight: .bold))
                        .kerning(-0.3)
                        .foregroundStyle(Color.spindarePrimary(scheme))

                    Text(venue.category.label)
                        .spindareLabel(size: 10, weight: .semibold, tracking: 1.5)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }

                Spacer(minLength: 0)

                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.spindareSecondary(scheme))
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Spindare.Hairline.color(scheme, emphasis: 1.4)))
                }
                .buttonStyle(.plain)
            }

            Text(venue.blurb)
                .font(.system(size: 13))
                .foregroundStyle(Color.spindareSecondary(scheme))
                .fixedSize(horizontal: false, vertical: true)

            if let challenge = venue.sponsoredChallenge {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Sponsored challenge")
                        .spindareLabel(size: 9, weight: .medium, tracking: 2)
                        .foregroundStyle(Color.spindareAccent(scheme))

                    Text(challenge)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.spindarePrimary(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spindare.Spacing.md)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                        .fill(Spindare.Palette.accent.opacity(scheme == .dark ? 0.14 : 0.18))
                }

                Button(action: onTake) {
                    Text("Do this")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background {
                            RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                .fill(Spindare.Palette.ink)
                        }
                }
                .buttonStyle(PressableStyle())

                // The one thing a sponsored challenge has to say out loud,
                // since it's the rule that governs what happens after you
                // post — not buried in a settings screen somewhere.
                Text("Posts for sponsored challenges appear to others 5 minutes after posting.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.spindareSecondary(scheme))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("No live challenge here right now.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }
        }
        .padding(Spindare.Spacing.lg)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                .fill(Color.spindareSurface(scheme))
                .overlay {
                    RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                        .strokeBorder(Spindare.Hairline.color(scheme), lineWidth: Spindare.Hairline.width)
                }
        }
        .spindareElevation(.floating)
    }
}
