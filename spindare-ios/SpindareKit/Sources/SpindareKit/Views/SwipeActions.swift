import SwiftUI

// Trailing swipe actions with a destructive over-swipe stage.
//
// Not `.swipeActions` — the system modifier gives you the first stage (reveal
// buttons) and a full-swipe shortcut, but no control over the second: it can't
// express "keep pulling and the destructive action takes over the row, arms
// visibly, then fires on release". That arming step is the point. A full-swipe
// delete that commits the instant you cross a threshold is easy to trigger by
// accident on a list you were only trying to scroll; one that shows you a ring
// filling and waits for you to let go is not.
//
// The staging lives here as pure functions because the failure mode is a
// threshold that's slightly off — arming a hair before the ring visually
// completes, or a destructive stage that engages during an ordinary reveal —
// and none of that is visible in a static screenshot.

/// What a trailing-swipe row looks like at a given drag distance.
public struct SwipeActionState: Sendable, Equatable {
    /// How far the row content has been pushed aside, always positive.
    public let revealed: CGFloat
    /// The destructive action has expanded to consume the others.
    public let isDestructive: Bool
    /// Ring fill, 0...1. Reaches 1 exactly when the action arms.
    public let armProgress: CGFloat

    /// Releasing now performs the destructive action.
    public var isArmed: Bool { armProgress >= 1 }

    public init(revealed: CGFloat, isDestructive: Bool, armProgress: CGFloat) {
        self.revealed = revealed
        self.isDestructive = isDestructive
        self.armProgress = armProgress
    }
}

public enum SwipeActionGeometry {
    /// Width of one action button at rest.
    public static let actionWidth: CGFloat = 68

    /// Fraction of the buttons' own width you have to pull to reveal all of
    /// them. Under 1, so a short flick opens the row completely rather than
    /// leaving it hanging half-open — one swipe should show the actions.
    public static let openingFraction: CGFloat = 0.55

    /// Fraction of the row at which the destructive action takes over.
    public static let destructiveFraction: CGFloat = 0.7

    /// How far past takeover to fully arm, as a fraction of the row. Large on
    /// purpose: the ring has to fill *slowly* enough to notice, decide, and
    /// back out of. A short arm distance turns a firm swipe into an
    /// accidental delete.
    public static let armFraction: CGFloat = 0.28

    /// Rate the row follows the finger past full reveal. Below 1, so the
    /// second stage feels like pulling against something.
    private static let dragResistance: CGFloat = 0.6

    public static func restingWidth(actionCount: Int) -> CGFloat {
        CGFloat(actionCount) * actionWidth
    }

    /// - Parameters:
    ///   - translation: raw horizontal drag. Negative is leftward (revealing).
    ///   - rowWidth: full width of the row.
    ///   - actionCount: number of actions revealed at stage one.
    public static func state(
        translation: CGFloat,
        rowWidth: CGFloat,
        actionCount: Int
    ) -> SwipeActionState {
        // Rightward drags on a closed row do nothing; the actions are on the
        // trailing edge, so there is nothing to reveal in that direction.
        let pulled = max(0, -translation)
        let resting = restingWidth(actionCount: actionCount)
        guard rowWidth > 0, resting > 0 else {
            return SwipeActionState(revealed: pulled, isDestructive: false, armProgress: 0)
        }

        // Stage one is accelerated — the buttons are fully out before your
        // finger has travelled their width. Past that the row keeps following,
        // but slowly, which is what separates "show me the options" from "I
        // mean to destroy this".
        let openingDistance = resting * openingFraction
        let revealed: CGFloat = pulled <= openingDistance
            ? pulled * (resting / openingDistance)
            : resting + (pulled - openingDistance) * dragResistance

        let takeover = rowWidth * destructiveFraction
        let isDestructive = revealed >= takeover

        let armDistance = rowWidth * armFraction
        let armProgress = isDestructive && armDistance > 0
            ? min(1, (revealed - takeover) / armDistance)
            : 0

        return SwipeActionState(
            revealed: revealed,
            isDestructive: isDestructive,
            armProgress: armProgress
        )
    }

    /// Pull distance at which the row sits fully open.
    ///
    /// In *pull* units, not revealed units — the two differ because stage one
    /// is accelerated. Mixing them up puts an open row at a pull distance that
    /// re-derives to more than fully open, so it drifts further open every
    /// time it's touched.
    public static func openPull(actionCount: Int) -> CGFloat {
        restingWidth(actionCount: actionCount) * openingFraction
    }

    /// Where a released row settles, in pull units: fully open, or closed.
    /// Destructive releases don't come through here — they animate off-screen.
    ///
    /// Note this is also what a released-but-not-armed over-swipe returns to:
    /// pulling deep into the red and then letting go without completing the
    /// ring drops you back to the plain actions rather than closing, so
    /// backing out of a delete leaves you where you'd have been anyway.
    public static func restingPull(
        for state: SwipeActionState,
        actionCount: Int
    ) -> CGFloat {
        // Half of one button is the usual "did they mean it" line: less than
        // that reads as a stray horizontal wobble during a vertical scroll.
        state.revealed > actionWidth / 2 ? openPull(actionCount: actionCount) : 0
    }
}

// MARK: - Action model

public struct SwipeAction: Identifiable, Sendable {
    public enum Role: Sendable {
        case destructive
        case standard
    }

    public let id: String
    public let title: String
    public let icon: String
    public let tint: Color
    public let role: Role
    public let perform: @MainActor () -> Void

    public init(
        id: String,
        title: String,
        icon: String,
        tint: Color,
        role: Role = .standard,
        perform: @escaping @MainActor () -> Void
    ) {
        self.id = id
        self.title = title
        self.icon = icon
        self.tint = tint
        self.role = role
        self.perform = perform
    }
}

// MARK: - Row

/// Wraps any row content with trailing swipe actions.
public struct SwipeActionRow<Content: View>: View {
    @Environment(\.colorScheme) private var scheme

    private let actions: [SwipeAction]
    private let content: Content

    /// Current pull distance, in the same units the geometry takes.
    @State private var pull: CGFloat = 0
    /// Where the row rests between drags — 0 closed, `openPull` open. A drag
    /// composes from here rather than from zero, or picking an already-open
    /// row back up snaps it shut before it starts moving.
    @State private var base: CGFloat = 0
    /// Latched so the heavy tap fires once on crossing, not every frame the
    /// ring sits full.
    @State private var hasArmed = false
    @State private var isCollapsing = false

    public init(actions: [SwipeAction], @ViewBuilder content: () -> Content) {
        self.actions = actions
        self.content = content()
    }

    private var destructive: SwipeAction? {
        actions.first { $0.role == .destructive }
    }

    public var body: some View {
        GeometryReader { proxy in
            let rowWidth = proxy.size.width
            let state = SwipeActionGeometry.state(
                translation: -pull,
                rowWidth: rowWidth,
                actionCount: actions.count
            )

            ZStack(alignment: .trailing) {
                background(state: state, rowWidth: rowWidth)

                content
                    .frame(width: rowWidth, alignment: .leading)
                    // Opaque, and matching the page behind it: the actions sit
                    // *underneath* the row rather than beside it, so anything
                    // translucent here shows the coloured panel through the
                    // row's own content as it slides.
                    .background(Color.spindareBackground(scheme))
                    .offset(x: -state.revealed)
            }
            .frame(width: rowWidth)
            .contentShape(Rectangle())
            .highPriorityGesture(gesture(rowWidth: rowWidth))
            .onChange(of: state.isArmed) { _, armed in
                guard armed, !hasArmed else {
                    if !armed { hasArmed = false }
                    return
                }
                hasArmed = true
                Haptics.impact(.heavy)
            }
        }
        .frame(height: isCollapsing ? 0 : nil)
        .opacity(isCollapsing ? 0 : 1)
        .clipped()
    }

    // MARK: Background

    @ViewBuilder
    private func background(state: SwipeActionState, rowWidth: CGFloat) -> some View {
        if state.isDestructive, let destructive {
            // Stage two: one colour across the whole revealed area. The other
            // actions aren't hidden so much as consumed — the row has stopped
            // offering a choice and is now doing one thing.
            ZStack(alignment: .trailing) {
                destructive.tint

                HStack(spacing: 12) {
                    Image(systemName: destructive.icon)
                        .font(.system(size: 18, weight: .semibold))

                    Text(destructive.title)
                        .font(.system(size: 14, weight: .semibold))

                    // Fills as you pull. This is the row telling you how much
                    // further it needs before it will act.
                    ZStack {
                        Circle()
                            .stroke(.white.opacity(0.35), lineWidth: 2.5)
                        Circle()
                            .trim(from: 0, to: state.armProgress)
                            .stroke(.white, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 22, height: 22)
                    // A small kick at the moment it arms, so the haptic has
                    // something visual landing with it.
                    .scaleEffect(state.isArmed ? 1.15 : 1)
                    .animation(Spindare.Motion.pop, value: state.isArmed)
                }
                .foregroundStyle(.white)
                .padding(.trailing, Spindare.Spacing.lg)
            }
        } else {
            HStack(spacing: 0) {
                ForEach(actions) { action in
                    Button {
                        close()
                        action.perform()
                    } label: {
                        VStack(spacing: 5) {
                            Image(systemName: action.icon)
                                .font(.system(size: 17, weight: .semibold))
                            Text(action.title)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(.white)
                        .frame(width: SwipeActionGeometry.actionWidth)
                        .frame(maxHeight: .infinity)
                        .background(action.tint)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(width: state.revealed, alignment: .trailing)
            .clipped()
        }
    }

    // MARK: Gesture

    private func gesture(rowWidth: CGFloat) -> some Gesture {
        // A minimum distance, and a horizontal bias check below, so this never
        // steals an ordinary vertical scroll through the list.
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                // Composed from `base`, and floored at 0 so dragging an open
                // row rightward closes it and then stops, rather than running
                // negative and pulling the row off the other edge.
                pull = max(0, base - value.translation.width)
            }
            .onEnded { value in
                let state = SwipeActionGeometry.state(
                    translation: -pull,
                    rowWidth: rowWidth,
                    actionCount: actions.count
                )

                if state.isArmed, let destructive {
                    fire(destructive, rowWidth: rowWidth)
                } else {
                    base = SwipeActionGeometry.restingPull(
                        for: state,
                        actionCount: actions.count
                    )
                    withAnimation(Spindare.Motion.settle) { pull = base }
                    hasArmed = false
                }
            }
    }

    /// Sends the row the rest of the way out, then collapses the gap it leaves.
    /// Performing the action first and letting the list re-render would make the
    /// row vanish mid-gesture, with the finger still on it.
    private func fire(_ action: SwipeAction, rowWidth: CGFloat) {
        withAnimation(Spindare.Motion.commit) { pull = rowWidth * 1.5 }

        Task {
            try? await Task.sleep(for: .milliseconds(180))
            withAnimation(Spindare.Motion.settle) { isCollapsing = true }
            try? await Task.sleep(for: .milliseconds(200))
            action.perform()
        }
    }

    private func close() {
        base = 0
        withAnimation(Spindare.Motion.settle) { pull = 0 }
        hasArmed = false
    }
}
