import SwiftUI

// Shared interaction motion.
//
// The thing that separates a native-feeling control from a scaled rectangle is
// that a press changes several properties at once. Scale alone reads as a
// cartoon squash; scale plus a shadow that tightens and rises reads as the
// control being pushed *into* the surface, because that's what real depth does.

public struct PressableStyle: ButtonStyle {
    /// Softer variant for icon-only controls, where a full press is too much.
    public enum Weight {
        case standard
        case subtle

        var scale: CGFloat {
            switch self {
            case .standard: 0.96
            case .subtle: 0.92
            }
        }
    }

    let weight: Weight

    public init(_ weight: Weight = .standard) {
        self.weight = weight
    }

    public func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed

        return configuration.label
            .scaleEffect(pressed ? weight.scale : 1)
            .brightness(pressed ? -0.02 : 0)
            // Shadow collapses toward the surface as the control goes down.
            .shadow(
                color: .black.opacity(pressed ? 0.04 : 0.10),
                radius: pressed ? 2 : 8,
                y: pressed ? 1 : 4
            )
            .animation(
                // Asymmetric on purpose: firm going down, loose coming back.
                pressed
                    ? .interpolatingSpring(stiffness: 320, damping: 22)
                    : .interpolatingSpring(stiffness: 180, damping: 12),
                value: pressed
            )
            .sensoryFeedback(.impact(weight: .light, intensity: 0.5), trigger: pressed) { was, now in
                // Fire on release rather than touch-down — matches the system,
                // and touch-down firing feels trigger-happy while scrolling.
                was && !now
            }
    }
}

// MARK: - Layered elevation
//
// One shadow can't describe depth: real objects cast a tight dark contact
// shadow *and* a wide soft ambient one. Stacking two is the whole trick.

public extension View {
    /// Card-level elevation — subtle, for surfaces resting on the background.
    func spindareElevation(_ level: SpindareElevation = .card) -> some View {
        shadow(color: .black.opacity(level.contactOpacity), radius: level.contactRadius, y: level.contactY)
            .shadow(color: .black.opacity(level.ambientOpacity), radius: level.ambientRadius, y: level.ambientY)
    }
}

public enum SpindareElevation: Sendable {
    case card
    case raised
    case floating

    var contactOpacity: Double {
        switch self {
        case .card: 0.04
        case .raised: 0.06
        case .floating: 0.08
        }
    }
    var contactRadius: CGFloat {
        switch self {
        case .card: 1
        case .raised: 2
        case .floating: 3
        }
    }
    var contactY: CGFloat {
        switch self {
        case .card: 1
        case .raised: 1
        case .floating: 2
        }
    }
    var ambientOpacity: Double {
        switch self {
        case .card: 0.05
        case .raised: 0.08
        case .floating: 0.14
        }
    }
    var ambientRadius: CGFloat {
        switch self {
        case .card: 12
        case .raised: 20
        case .floating: 32
        }
    }
    var ambientY: CGFloat {
        switch self {
        case .card: 4
        case .raised: 8
        case .floating: 14
        }
    }
}

// MARK: - Scroll entrance

public extension View {
    /// Cards settle as they enter the viewport and ease off as they leave.
    ///
    /// Replaces a manual `onAppear` + seen-set: this reacts continuously to
    /// scroll position, so it also responds when you scroll back up, and there
    /// is no per-item bookkeeping to get out of sync.
    func spindareScrollEntrance() -> some View {
        scrollTransition(.interactive, axis: .vertical) { content, phase in
            content
                .opacity(phase.isIdentity ? 1 : 0.55)
                .scaleEffect(phase.isIdentity ? 1 : 0.94)
                .blur(radius: phase.isIdentity ? 0 : 1.5)
        }
    }

    /// Horizontal, swipe-paged `TabView` with no page dots — the app's main
    /// page host and the nested Notifications pager both use this. `.page`
    /// style is iOS/tvOS/watchOS only; on macOS (where this package also
    /// builds and tests without Xcode) it falls back to the default style,
    /// which has no paging gesture but still compiles and renders each tab.
    func spindarePagedTabViewStyle() -> some View {
        #if os(iOS)
        self.tabViewStyle(.page(indexDisplayMode: .never))
        #else
        self
        #endif
    }

    /// Item-driven full-screen presentation. `fullScreenCover` is iOS-only —
    /// this package also builds for macOS so `swift build` / `swift test` can
    /// run without Xcode, where it falls back to a sheet (the closest thing
    /// macOS has, and never actually exercised at runtime).
    @ViewBuilder
    func spindareFullScreen<Item: Identifiable, Content: View>(
        item: Binding<Item?>,
        @ViewBuilder content: @escaping (Item) -> Content
    ) -> some View {
        #if os(iOS)
        self.fullScreenCover(item: item, content: content)
        #else
        self.sheet(item: item, content: content)
        #endif
    }
}
