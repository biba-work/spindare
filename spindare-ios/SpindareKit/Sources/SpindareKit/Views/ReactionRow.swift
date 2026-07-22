import SwiftUI

// felt / thought / intrigued — the entire reaction vocabulary. There are no
// comments in this app and no other way to respond to a post.
//
// The defining behaviour: once you react, the controls fade out and unmount.
// You get exactly one, and then the affordance is gone. That is the anti-scroll
// thesis expressed in an interaction — you cannot sit here tapping.

// MARK: - State machine

enum ReactionPhase: Equatable {
    case idle
    case reacted   // holding, briefly, so you see what you picked
    case fading
    case gone
}

public struct ReactionRow: View {
    @Environment(\.colorScheme) private var scheme

    let post: Post
    let isOwner: Bool
    let axis: Axis
    let onImage: Bool
    let onReaction: (ReactionType) -> Void

    @State private var selected: ReactionType?
    @State private var phase: ReactionPhase = .idle

    /// Hold the choice visible before dissolving it.
    private let holdDuration: Duration = .milliseconds(1500)
    private let fadeDuration: Double = 0.6

    public init(
        post: Post,
        isOwner: Bool,
        axis: Axis = .horizontal,
        onImage: Bool = false,
        onReaction: @escaping (ReactionType) -> Void
    ) {
        self.post = post
        self.isOwner = isOwner
        self.axis = axis
        self.onImage = onImage
        self.onReaction = onReaction
    }

    public var body: some View {
        Group {
            if isOwner {
                // The author sees the tally instead — they can't react to
                // their own post at all.
                ownerCounts
            } else if phase != .gone {
                buttons
                    .opacity(phase == .fading ? 0 : 1)
                    .animation(.easeOut(duration: fadeDuration), value: phase)
            }
        }
    }

    // MARK: - Buttons

    private var buttons: some View {
        Group {
            if axis == .horizontal {
                HStack(spacing: 0) {
                    ForEach(ReactionType.allCases, id: \.self) { type in
                        ReactionButton(type: type, isActive: selected == type, onImage: onImage) { react(type) }
                            .frame(maxWidth: .infinity)
                    }
                }
            } else {
                VStack(spacing: Spindare.Spacing.sm) {
                    ForEach(ReactionType.allCases, id: \.self) { type in
                        ReactionButton(type: type, isActive: selected == type, onImage: onImage) { react(type) }
                    }
                }
            }
        }
        .padding(.horizontal, axis == .horizontal ? Spindare.Spacing.sm : 0)
    }

    private func react(_ type: ReactionType) {
        guard selected == nil else { return }

        selected = type
        phase = .reacted
        onReaction(type)

        Task {
            try? await Task.sleep(for: holdDuration)
            guard !Task.isCancelled else { return }
            phase = .fading
            try? await Task.sleep(for: .seconds(fadeDuration))
            guard !Task.isCancelled else { return }
            phase = .gone
        }
    }

    // MARK: - Owner tally

    private var ownerCounts: some View {
        Group {
            if axis == .horizontal {
                HStack(spacing: Spindare.Spacing.sm) {
                    ownerCountsContent
                    Spacer(minLength: 0)
                    Text("\(post.reactions.total) total")
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }
            } else {
                VStack(spacing: Spindare.Spacing.sm) {
                    ownerCountsContent
                }
            }
        }
        .padding(.horizontal, axis == .horizontal ? Spindare.Spacing.md : 0)
    }

    @ViewBuilder
    private var ownerCountsContent: some View {
        ForEach(ReactionType.allCases, id: \.self) { type in
            HStack(spacing: 5) {
                Circle()
                    .fill(Spindare.Palette.color(for: type))
                    .frame(width: 7, height: 7)
                Text("\(count(for: type))")
                    .font(.system(size: 12, weight: .medium).monospacedDigit())
                    .foregroundStyle(onImage ? .white : Color.spindarePrimary(scheme))
                    // A four-figure count used to wrap to a second line and
                    // spill out of the pill. Keep it on one line and let it
                    // shrink a little instead of breaking the shape.
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background {
                RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                    .fill(onImage ? .black.opacity(0.45) : Spindare.Hairline.color(scheme, emphasis: 0.8))
            }
        }
    }

    private func count(for type: ReactionType) -> Int {
        switch type {
        case .felt: post.reactions.felt
        case .thought: post.reactions.thought
        case .intrigued: post.reactions.intrigued
        }
    }
}

// MARK: - Button

struct ReactionButton: View {
    @Environment(\.colorScheme) private var scheme

    let type: ReactionType
    let isActive: Bool
    var showBlinkingRing: Bool = false
    /// Floating over a photo, where the treatment must read against anything
    /// and so deliberately ignores light/dark.
    let onImage: Bool
    let action: () -> Void

    @State private var scale: CGFloat = 1
    @State private var rippleScale: CGFloat = 0.5
    @State private var rippleOpacity: Double = 0
    /// Bumped on every genuine new selection; ReactionBurst watches it as a
    /// trigger rather than a Bool so a second reaction while the first burst
    /// is still animating starts a fresh one instead of being a no-op.
    @State private var burstTrigger = 0

    var body: some View {
        Button(action: tap) {
            VStack(spacing: 4) {
                ZStack {
                    // Ripple, from the original's unused-but-better variant.
                    Circle()
                        .fill(Spindare.Palette.color(for: type).opacity(0.35))
                        .frame(width: 38, height: 38)
                        .scaleEffect(rippleScale)
                        .opacity(rippleOpacity)

                    Circle()
                        .fill(background)
                        .overlay { Circle().strokeBorder(border, lineWidth: isActive ? 2 : 1.5) }
                        .overlay {
                            if showBlinkingRing {
                                Circle()
                                    .stroke(Spindare.Palette.color(for: type).opacity(0.85), lineWidth: 2)
                                    .frame(width: 44, height: 44)
                            }
                        }
                        .frame(width: 38, height: 38)

                    ReactionGlyph(type: type, isActive: isActive)
                        .frame(width: 18, height: 18)

                    // The celebratory flourish, a beat after the ripple. The
                    // ripple is immediate tactile confirmation; this is the
                    // payoff — so it's layered on top, not swapped in for it.
                    ReactionBurst(type: type, trigger: burstTrigger)
                }
                // No clipping: the felt glyph's dots orbit outside these bounds.
                .scaleEffect(scale)

                Text(type.rawValue)
                    .spindareLabel(size: 8, weight: .medium, tracking: 1.2)
                    .foregroundStyle(labelColor)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .heavy), trigger: isActive) { was, now in !was && now }
    }

    private func tap() {
        guard !isActive else { return }
        action()

        // 0.6 → 1.3 → 1.0. A double overshoot, not a simple bounce.
        scale = 0.6
        withAnimation(Spindare.Motion.pop) { scale = 1.3 }
        withAnimation(Spindare.Motion.pop.delay(0.12)) { scale = 1.0 }

        rippleScale = 0.5
        rippleOpacity = 0.6
        withAnimation(.easeOut(duration: 0.5)) {
            rippleScale = 2.5
            rippleOpacity = 0
        }

        burstTrigger += 1
    }

    // Active never fills with colour — the glyph carries it. Active reads as a
    // thicker border over a near-opaque backing.
    private var background: Color {
        if onImage {
            isActive ? Color.white.opacity(0.97) : Color.black.opacity(0.45)
        } else if scheme == .dark {
            isActive ? Color(hex: 0x3A3A3C, opacity: 0.97) : Color.white.opacity(0.07)
        } else {
            isActive ? Color.white.opacity(0.97) : Color.black.opacity(0.04)
        }
    }

    private var border: Color {
        if onImage {
            isActive ? Color.black.opacity(0.18) : Color.white.opacity(0.22)
        } else if scheme == .dark {
            isActive ? Color.white.opacity(0.35) : Color.white.opacity(0.14)
        } else {
            isActive ? Color.black.opacity(0.22) : Color.black.opacity(0.09)
        }
    }

    private var labelColor: Color {
        // Over a photo the label has to read against anything, so it ignores
        // the colour scheme entirely — a scheme-derived grey disappears into a
        // dark image.
        if onImage { return isActive ? .white : .white.opacity(0.85) }
        if isActive { return scheme == .dark ? .white : Spindare.Palette.ink }
        return Color.spindareSecondary(scheme)
    }
}

// MARK: - Burst

/// Per-particle animatable state for `ReactionBurst`. A struct rather than
/// separate `@State` vars because `KeyframeTrack` needs one root value with a
/// keypath per animated property.
private struct BurstPhase {
    var travel: CGFloat = 0
    var lift: CGFloat = 0
    var scale: CGFloat = 0.4
    var opacity: Double = 0
}

/// Ten bubbles radiating outward and fading — the celebratory flourish on
/// selecting a reaction, distinct from the button's own ripple. Position is
/// deterministic per particle (angle + a small per-index stagger) rather than
/// random, so the same reaction always bursts the same way instead of the
/// motion reading as jittery between taps.
struct ReactionBurst: View {
    let type: ReactionType
    /// Any change fires a fresh burst — an incrementing counter rather than a
    /// Bool, so reacting again while a burst is still animating restarts it
    /// cleanly instead of being ignored as "no change."
    let trigger: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let particleCount = 9

    var body: some View {
        if reduceMotion {
            // A single quick pulse carries the same "something happened"
            // signal without the radiating motion.
            Circle()
                .fill(Spindare.Palette.color(for: type))
                .frame(width: 9, height: 9)
                .keyframeAnimator(initialValue: BurstPhase(), trigger: trigger) { view, phase in
                    view.opacity(phase.opacity).scaleEffect(phase.scale)
                } keyframes: { _ in
                    KeyframeTrack(\.scale) {
                        LinearKeyframe(1.4, duration: 0.2)
                        LinearKeyframe(1.0, duration: 0.15)
                    }
                    KeyframeTrack(\.opacity) {
                        LinearKeyframe(1, duration: 0.05)
                        LinearKeyframe(1, duration: 0.15)
                        LinearKeyframe(0, duration: 0.2)
                    }
                }
                .allowsHitTesting(false)
        } else {
            ZStack {
                ForEach(0..<particleCount, id: \.self) { index in
                    particle(index: index)
                }
            }
            .allowsHitTesting(false)
        }
    }

    private func particle(index: Int) -> some View {
        // A near-even ring with a small per-particle angular offset, so it
        // reads as organic rather than as a perfect uniform starburst.
        let angle = (Double(index) / Double(particleCount) * 360 + Double(index) * 11)
            * .pi / 180
        let distance: CGFloat = 24 + CGFloat(index % 3) * 7
        let size: CGFloat = 4 + CGFloat(index % 3)
        let delay = Double(index % 3) * 0.03
        let dx = CGFloat(cos(angle))
        let dy = CGFloat(sin(angle))

        return Circle()
            .fill(Spindare.Palette.color(for: type))
            .frame(width: size, height: size)
            .keyframeAnimator(initialValue: BurstPhase(), trigger: trigger) { view, phase in
                view
                    .offset(x: dx * distance * phase.travel, y: dy * distance * phase.travel - phase.lift)
                    .opacity(phase.opacity)
                    .scaleEffect(phase.scale)
            } keyframes: { _ in
                KeyframeTrack(\.travel) {
                    LinearKeyframe(0, duration: delay)
                    SpringKeyframe(1, duration: 0.42, spring: Spring(response: 0.4, dampingRatio: 0.7))
                }
                KeyframeTrack(\.lift) {
                    LinearKeyframe(0, duration: delay)
                    LinearKeyframe(8, duration: 0.42)
                }
                KeyframeTrack(\.scale) {
                    LinearKeyframe(0.3, duration: delay)
                    LinearKeyframe(1, duration: 0.12)
                    LinearKeyframe(0.7, duration: 0.28)
                }
                KeyframeTrack(\.opacity) {
                    LinearKeyframe(0, duration: delay)
                    LinearKeyframe(1, duration: 0.08)
                    LinearKeyframe(1, duration: 0.16)
                    LinearKeyframe(0, duration: 0.26)
                }
            }
    }
}

// MARK: - Glyphs
//
// Three bespoke animations rather than three emoji. All share Material's
// standard easing curve, which is what the original used throughout.

struct ReactionGlyph: View {
    let type: ReactionType
    let isActive: Bool

    var body: some View {
        switch type {
        case .felt: FeltGlyph(isActive: isActive)
        case .thought: ThoughtGlyph(isActive: isActive)
        case .intrigued: IntriguedGlyph(isActive: isActive)
        }
    }
}

/// Three dots make one revolution while their radius pinches 7 → 2 → 7.
/// That inward collapse at the midpoint is the signature of the whole set.
private struct FeltGlyph: View {
    let isActive: Bool

    var body: some View {
        PhaseAnimator([0.0, 0.5, 1.0], trigger: isActive) { phase in
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Spindare.Palette.felt)
                        .frame(width: 5, height: 5)
                        .offset(x: phase == 0.5 ? 1.5 : 5.5)
                        .rotationEffect(.degrees(Double(i) * 120 + phase * 360))
                }
            }
            .opacity(isActive ? 1 : 0.75)
        } animation: { phase in
            .timingCurve(0.4, 0, 0.2, 1, duration: 0.5)
        }
    }
}

/// Three bars that extend and settle at half — "still thinking". Deliberately
/// does not return to its resting height.
private struct ThoughtGlyph: View {
    let isActive: Bool
    private let offsets: [CGFloat] = [3, -3, 3]

    var body: some View {
        PhaseAnimator([0.0, 1.0, 0.5], trigger: isActive) { phase in
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { i in
                    Capsule()
                        .fill(Spindare.Palette.thought)
                        .frame(width: 2.5, height: 5 + (6 * phase))
                        .offset(y: offsets[i])
                }
            }
            .opacity(isActive ? 1 : 0.75)
        } animation: { phase in
            .timingCurve(0.4, 0, 0.2, 1, duration: 0.4)
        }
    }
}

/// A broken axis that rotates once while a glow blooms at the midpoint.
private struct IntriguedGlyph: View {
    let isActive: Bool

    var body: some View {
        PhaseAnimator([0.0, 0.5, 1.0], trigger: isActive) { phase in
            ZStack {
                Circle()
                    .fill(Spindare.Palette.intrigued)
                    .frame(width: 17, height: 17)
                    .opacity(phase == 0.5 ? 0.8 : 0.2)
                    .blur(radius: 4)

                Canvas { context, size in
                    let c = CGPoint(x: size.width / 2, y: size.height / 2)
                    let stroke = Spindare.Palette.intrigued

                    for dy in [-6.5, 6.5] {
                        let dot = Path(ellipseIn: CGRect(
                            x: c.x - 1.75, y: c.y + dy - 1.75, width: 3.5, height: 3.5
                        ))
                        context.fill(dot, with: .color(stroke))
                    }
                    for dx in [-6.5, 6.5] {
                        var line = Path()
                        let inner = dx < 0 ? c.x - 3 : c.x + 3
                        line.move(to: CGPoint(x: c.x + dx, y: c.y))
                        line.addLine(to: CGPoint(x: inner, y: c.y))
                        context.stroke(line, with: .color(stroke), lineWidth: 2.5)
                    }
                    if isActive {
                        let pip = Path(ellipseIn: CGRect(x: c.x - 1, y: c.y - 1, width: 2, height: 2))
                        context.fill(pip, with: .color(stroke))
                    }
                }
                .rotationEffect(.degrees(phase * 360))
            }
            .opacity(isActive ? 1 : 0.75)
        } animation: { phase in
            .timingCurve(0.4, 0, 0.2, 1, duration: 0.6)
        }
    }
}
