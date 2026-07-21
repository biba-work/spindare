import SwiftUI

// Hold the send button to make the message bigger.
//
// The size has to be *chosen* during the hold and committed on release, which
// rules out a plain Button — its action fires on release with no notion of how
// long it was held, and `LongPressGesture` only tells you that a threshold was
// crossed, not how far past it you are. A `DragGesture(minimumDistance: 0)`
// with a timer is what gives a continuously readable hold.
//
// Sliding away cancels, matching every other press-and-hold control on the
// platform: once a hold is doing something irreversible, "let go somewhere
// else" has to be the way out.

public enum SendEmphasis {
    /// Standard body size — what an un-held tap sends at.
    public static let base: CGFloat = 16
    public static let max: CGFloat = 40
    /// Seconds of holding to travel from base to max.
    public static let rampDuration: TimeInterval = 1.4

    /// Size after holding for `elapsed`. Eased so the first moments move
    /// slowly: a linear ramp makes it near-impossible to stop at a small
    /// increase, since the useful range is over before you react.
    public static func size(heldFor elapsed: TimeInterval) -> CGFloat {
        guard elapsed > 0 else { return base }
        let t = Swift.min(1, elapsed / rampDuration)
        let eased = t * t
        return base + (max - base) * eased
    }

    /// Whether a size is worth recording on the message at all.
    public static func isEmphasised(_ size: CGFloat) -> Bool {
        size > base + 1
    }
}

public struct HoldToGrowSendButton: View {
    /// Called on release, with the chosen point size (nil for a plain tap).
    private let onSend: (CGFloat?) -> Void
    private let isEnabled: Bool
    /// Reports the live size so the composer can preview the text at it.
    @Binding private var previewSize: CGFloat?

    @State private var holdStart: Date?
    @State private var currentSize: CGFloat = SendEmphasis.base
    @State private var cancelled = false

    public init(
        isEnabled: Bool,
        previewSize: Binding<CGFloat?>,
        onSend: @escaping (CGFloat?) -> Void
    ) {
        self.isEnabled = isEnabled
        self._previewSize = previewSize
        self.onSend = onSend
    }

    private var isHolding: Bool { holdStart != nil }

    public var body: some View {
        ZStack {
            Circle()
                .fill(Spindare.Palette.ink)
                // Grows with the emphasis so the button itself shows what it's
                // about to do, rather than the preview being the only signal.
                .scaleEffect(1 + 0.22 * growth)

            Image(systemName: cancelled ? "xmark" : "arrow.up")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
        }
        .frame(width: 44, height: 44)
        .opacity(isEnabled ? 1 : 0.4)
        .animation(Spindare.Motion.settle, value: cancelled)
        .gesture(hold)
        .disabled(!isEnabled)
        // Drives the ramp while held. A timeline rather than a Timer so it
        // stops entirely when not holding, instead of ticking through every
        // idle moment in the chat.
        .overlay {
            if isHolding {
                TimelineView(.animation) { timeline in
                    Color.clear.onChange(of: timeline.date) { _, now in
                        guard let holdStart, !cancelled else { return }
                        currentSize = SendEmphasis.size(heldFor: now.timeIntervalSince(holdStart))
                        previewSize = SendEmphasis.isEmphasised(currentSize) ? currentSize : nil
                    }
                }
                .allowsHitTesting(false)
            }
        }
    }

    /// 0...1 across the emphasis range, for driving the button's own scale.
    private var growth: CGFloat {
        guard isHolding, !cancelled else { return 0 }
        return (currentSize - SendEmphasis.base) / (SendEmphasis.max - SendEmphasis.base)
    }

    private var hold: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if holdStart == nil {
                    holdStart = Date()
                    Haptics.impact(.light)
                }

                // Far enough off the button to read as "not this one". Checked
                // continuously so the cancel state shows *before* release, or
                // the escape hatch isn't discoverable.
                let strayed = abs(value.translation.width) > 60 || abs(value.translation.height) > 60
                if strayed != cancelled {
                    cancelled = strayed
                    if strayed { Haptics.impact(.rigid) }
                }
            }
            .onEnded { _ in
                defer { reset() }
                guard !cancelled, isEnabled else { return }
                onSend(SendEmphasis.isEmphasised(currentSize) ? currentSize : nil)
            }
    }

    private func reset() {
        holdStart = nil
        cancelled = false
        currentSize = SendEmphasis.base
        previewSize = nil
    }
}
