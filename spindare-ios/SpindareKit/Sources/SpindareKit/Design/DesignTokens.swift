import SwiftUI

// Design tokens taken from the React Native source of truth.
//
// The identity in one line: warm off-white, soft charcoal, dusty slate blue.
// Nothing is ever pure black or pure white as a surface, and depth comes from
// hairline borders rather than shadows. Letting SwiftUI defaults pull this
// toward .systemBackground / .label is exactly how a port goes generic.

public enum Spindare {}

// MARK: - Raw palette
//
// Frequency-ranked from the RN codebase. Prefer the semantic accessors below;
// these are the literal values behind them.

public extension Spindare {
    enum Palette {
        /// Warm off-white. The app background — never `.white`.
        public static let cream = Color(hex: 0xFAF9F6)
        /// Soft charcoal. Primary ink and primary button fill — never black.
        public static let ink = Color(hex: 0x4A4A4A)
        /// Dusty slate blue. The brand accent.
        public static let accent = Color(hex: 0xA7BBC7)
        /// Darker slate, for accent *text* on light backgrounds where the
        /// dusty blue doesn't hold enough contrast.
        public static let accentDeep = Color(hex: 0x6B8A99)

        // Dark mode
        public static let inkDark = Color(hex: 0x1C1C1E)      // background
        public static let surfaceDark = Color(hex: 0x3A3A3C)  // elevated surface
        public static let textOnDark = Color(hex: 0xE5E5EA)

        // Text. Darkened a couple of shades from the RN values (#8E8E93 /
        // #AEAEB2) — those are iOS system greys and were failing contrast for
        // timestamps and reaction labels, especially outdoors.
        public static let textSecondary = Color(hex: 0x6E6E73)
        public static let textTertiary = Color(hex: 0x8A8A8E)

        // Semantic
        public static let success = Color(hex: 0x34C759)
        public static let danger = Color(hex: 0xFF3B30)

        // Reaction identity. Defined once here — the RN app declared these in
        // three separate places and two of them disagreed.
        public static let felt = Color(hex: 0x007AFF)
        public static let thought = Color(hex: 0xFFD60A)
        public static let intrigued = Color(hex: 0x5856D6)
    }
}

public extension Spindare.Palette {
    static func color(for reaction: ReactionType) -> Color {
        switch reaction {
        case .felt: felt
        case .thought: thought
        case .intrigued: intrigued
        }
    }
}

// MARK: - Semantic colours
//
// Resolve through the environment rather than the `darkMode && styleDark`
// pattern the RN app repeats at every call site (GenericOverlay alone carried
// 17 parallel dark style blocks).

public extension ShapeStyle where Self == Color {
    /// App background.
    static func spindareBackground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Spindare.Palette.inkDark : Spindare.Palette.cream
    }
    /// Card / elevated surface.
    static func spindareSurface(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Spindare.Palette.surfaceDark : .white
    }
    /// Primary text.
    static func spindarePrimary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Spindare.Palette.textOnDark : Spindare.Palette.ink
    }
    /// Secondary text.
    static func spindareSecondary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Spindare.Palette.textTertiary : Spindare.Palette.textSecondary
    }
    /// Accent, warmed slightly for light mode legibility.
    static func spindareAccent(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Spindare.Palette.accent : Spindare.Palette.accentDeep
    }
}

public extension Spindare {
    /// Hairline borders carry depth in this design — see `Elevation`.
    enum Hairline {
        public static func color(_ scheme: ColorScheme, emphasis: Double = 1) -> Color {
            scheme == .dark
                ? Color.white.opacity(0.10 * emphasis)
                : Color.black.opacity(0.05 * emphasis)
        }
        public static let width: CGFloat = 1
    }
}

// MARK: - Radius
//
// The RN app used 13 distinct radii for what amounts to five roles.

public extension Spindare {
    enum Radius {
        public static let tight: CGFloat = 4      // progress tracks, ticks
        public static let control: CGFloat = 12   // chips, small pills
        public static let card: CGFloat = 20      // post cards, inputs
        public static let panel: CGFloat = 24     // overlay cards
        public static let sheet: CGFloat = 32     // bottom sheets
    }
}

// MARK: - Spacing
//
// Effectively a 2pt grid with 4pt preferred. Gutter is 24 in overlays,
// 14 inside feed cards.

public extension Spindare {
    enum Spacing {
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 14
        public static let lg: CGFloat = 20
        public static let gutter: CGFloat = 24
        public static let xl: CGFloat = 32
    }
}

// MARK: - Typography
//
// System font throughout. `fontFamily` appears five times in the entire RN
// codebase and four of those are in dead code — this app is SF Pro, and the
// previously-declared Inter dependency was never bundled, so `.custom("Inter")`
// was silently falling back anyway.
//
// The signature is the contrast between normally-tracked body text and tiny
// uppercase labels tracked out hard.

public extension Spindare {
    enum Typography {
        // Body
        public static let body = Font.system(size: 15, weight: .regular)
        public static let bodyLarge = Font.system(size: 16, weight: .regular)
        public static let bodyLineSpacing: CGFloat = 7   // ~22pt line height at 15pt

        // Identity
        public static let brand = Font.system(size: 32, weight: .black)
        public static let brandTracking: CGFloat = 5

        // Structure
        public static let title = Font.system(size: 24, weight: .bold)
        public static let titleTracking: CGFloat = -0.4
        public static let authorName = Font.system(size: 14, weight: .semibold)
        public static let authorTracking: CGFloat = -0.2
        public static let timestamp = Font.system(size: 12, weight: .regular)
    }
}

/// The app's most characteristic text treatment: tiny, uppercase, widely tracked.
/// Used for overlay titles, section headers, button labels and reaction labels.
public struct SpindareLabelStyle: ViewModifier {
    let size: CGFloat
    let weight: Font.Weight
    let tracking: CGFloat

    public func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: weight))
            .kerning(tracking)
            .textCase(.uppercase)
    }
}

public extension View {
    /// - Parameters follow the RN scale: overlay titles 11/600/3,
    ///   section headers 10/700/2, buttons 11/700/1.5, reaction labels 8/500/1.2.
    func spindareLabel(
        size: CGFloat = 11,
        weight: Font.Weight = .semibold,
        tracking: CGFloat = 2
    ) -> some View {
        modifier(SpindareLabelStyle(size: size, weight: weight, tracking: tracking))
    }
}

// MARK: - Elevation
//
// Shadows are almost absent and where present are extremely soft. Depth is
// carried by hairline borders instead. The one deliberate exception is the
// post-success glow, which is why that confirmation lands.

public extension Spindare {
    struct Shadow: Sendable, Equatable {
        public let color: Color
        public let radius: CGFloat
        public let y: CGFloat

        public init(color: Color, radius: CGFloat, y: CGFloat) {
            self.color = color
            self.radius = radius
            self.y = y
        }

        /// Feed cards. Barely perceptible by design.
        public static let card = Shadow(color: .black.opacity(0.04), radius: 12, y: 2)
        /// Floating panels and the search dropdown.
        public static let panel = Shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        /// Bottom sheets, casting upward.
        public static let sheet = Shadow(color: .black.opacity(0.03), radius: 20, y: -10)
        /// The success confirmation — the only assertive shadow in the app.
        public static let successGlow = Shadow(color: Palette.success.opacity(0.45), radius: 20, y: 6)
    }
}

public extension View {
    func spindareShadow(_ shadow: Spindare.Shadow) -> some View {
        self
            .shadow(color: shadow.color, radius: shadow.radius, x: 0, y: shadow.y)
            .shadow(color: shadow.color.opacity(0.5), radius: shadow.radius * 0.25, x: 0, y: shadow.y * 0.25)
    }
}

// MARK: - Motion
//
// The RN app's springs cluster into exactly two families: friction 8 / tension
// 40–60 for anything entering or sliding, and friction 3 / tension 180 for
// anything reacting to a tap. Everything else was drift. Two springs, used
// everywhere — resist adding a third.

public extension Spindare {
    @MainActor
    enum Motion {
        /// Slides, entrances, sheets. Smooth, fast, critically-damped.
        public static let enter = Animation.spring(response: 0.32, dampingFraction: 0.95)
        /// Taps and reactions. Tactile and crisp, no excessive wobble.
        public static let pop = Animation.spring(response: 0.22, dampingFraction: 0.80)

        /// Material standard easing — every reaction icon animates on this.
        public static func standard(_ duration: Double) -> Animation {
            .timingCurve(0.4, 0, 0.2, 1, duration: duration)
        }

        /// Per-card entrance offset in the feed.
        public static let cardStagger: Double = 0.07
        /// Sheets close on a timing curve rather than a spring.
        public static let sheetClose = Animation.easeOut(duration: 0.26)

        /// The asymmetric transition from the original: enters on a crossfade,
        /// exits by scaling up and fading out simultaneously.
        public static let fadeScale = AnyTransition.asymmetric(
            insertion: .opacity,
            removal: .scale(scale: 1.05).combined(with: .opacity)
        )

        // MARK: Gesture release
        //
        // `enter` is tuned for something arriving from off-screen and is too
        // loose to catch a gesture: released mid-drag it drifts, which reads as
        // lag rather than as weight. These are for the moment a finger lets go
        // of something it has been dragging 1:1.

        /// Snapping a dragged thing back to rest — an image that wasn't pulled
        /// far enough to dismiss, a swiped row closing again.
        public static let settle = Animation.spring(response: 0.35, dampingFraction: 0.85)
        /// A dragged thing continuing the way it was thrown: a row collapsing
        /// into a delete, a photo flung off-screen.
        public static let commit = Animation.spring(response: 0.4, dampingFraction: 0.8)
        /// Programmatic page changes, matched to how a paged scroll settles so
        /// that tapping and swiping to the same place look like one motion.
        public static let page = Animation.spring(response: 0.42, dampingFraction: 0.9)

        /// Map pin selection, cluster expansion, camera zoom — anything that
        /// should read as a precise zoom rather than a physical object
        /// settling into place. Critically damped (`dampingFraction: 1`, no
        /// overshoot at all) on purpose: every other spring in this file has
        /// at least a little bounce because it's imitating something
        /// physical, but a camera zooming in doesn't bounce, and a pin that
        /// does was the specific complaint this exists to fix.
        public static let precise = Animation.spring(response: 0.3, dampingFraction: 1.0)

        /// Apple / Instagram exact timing curve for sheet & card transitions.
        public static let appleTimingCurve = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.32)

        /// Full-screen layers arriving and leaving — composer, messages, chat,
        /// saved, another user's profile.
        public static let layer = Animation.spring(response: 0.3, dampingFraction: 0.95)
    }
}

// MARK: - Morphing Semi-Arrow Grabber Shape

public struct SemiArrowShape: Shape {
    public var translationY: CGFloat

    public var animatableData: CGFloat {
        get { translationY }
        set { translationY = newValue }
    }

    public init(translationY: CGFloat = 0) {
        self.translationY = translationY
    }

    public func path(in rect: CGRect) -> Path {
        var path = Path()
        let midX = rect.midX
        let startY = rect.midY
        let peakY = startY - min(12, max(0, translationY * 0.3))

        path.move(to: CGPoint(x: rect.minX, y: startY))
        path.addLine(to: CGPoint(x: midX, y: peakY))
        path.addLine(to: CGPoint(x: rect.maxX, y: startY))

        return path
    }
}

// MARK: - Interactive Dismiss Modifier (r = min(1.0, offsetY / 350))

public struct InteractiveDismissModifier: ViewModifier {
    let offsetY: CGFloat

    public init(offsetY: CGFloat) {
        self.offsetY = offsetY
    }

    public func body(content: Content) -> some View {
        let r = min(1.0, max(0, offsetY / 350.0))
        let backdropOpacity = 1.0 - r
        let elementsOpacity = max(0.0, 1.0 - (r * 2.5))

        return content
            .background(Color.black.opacity(backdropOpacity))
            .environment(\.interactiveDismissProgress, r)
            .environment(\.interactiveElementsOpacity, elementsOpacity)
    }
}

private struct InteractiveDismissProgressKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private struct InteractiveElementsOpacityKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

public extension EnvironmentValues {
    var interactiveDismissProgress: CGFloat {
        get { self[InteractiveDismissProgressKey.self] }
        set { self[InteractiveDismissProgressKey.self] = newValue }
    }
    var interactiveElementsOpacity: CGFloat {
        get { self[InteractiveElementsOpacityKey.self] }
        set { self[InteractiveElementsOpacityKey.self] = newValue }
    }
}

public extension View {
    func interactiveDismiss(offsetY: CGFloat) -> some View {
        self.modifier(InteractiveDismissModifier(offsetY: offsetY))
    }
}

// MARK: - Helpers

public extension Color {
    /// `Color(hex: 0xFAF9F6)` — keeps the token table readable against the
    /// CSS hex values it was ported from.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
