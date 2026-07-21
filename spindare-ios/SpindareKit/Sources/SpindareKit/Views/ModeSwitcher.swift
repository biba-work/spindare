import SwiftUI

// Feed / SPeedys / Zone.
//
// Icon-only so the control stays small enough to float over content without
// becoming chrome in its own right — and because three words side by side at
// this size would be unreadable anyway. Holding one names it, which is the
// standard escape hatch for an icon whose meaning isn't obvious on sight
// (it's what a tooltip is for on desktop, and what this is for here).
//
// Hold, not tap-and-wait: the label appears while the finger is down and
// leaves when it lifts, so discovering what an icon means never costs you a
// navigation you didn't want.

public enum AppMode: String, CaseIterable, Identifiable, Hashable, Sendable {
    case feed, speedys, zone

    public var id: String { rawValue }

    /// "SPeedys" is spelled exactly this way on purpose — it's the product
    /// name, not a typo to be tidied up by the next person who reads it.
    public var title: String {
        switch self {
        case .feed: "Feed"
        case .speedys: "SPeedys"
        case .zone: "Zone"
        }
    }

    public var icon: String {
        switch self {
        case .feed: "square.stack"
        case .speedys: "play.rectangle.fill"
        case .zone: "map.fill"
        }
    }

    var hint: String {
        switch self {
        case .feed: "Everything, newest and best first"
        case .speedys: "Short clips of challenges"
        case .zone: "Sponsored places near you"
        }
    }
}

public struct ModeSwitcher: View {
    @Environment(\.colorScheme) private var scheme
    @Binding var mode: AppMode

    /// Which pill is currently being held. Nil when nothing is.
    @State private var held: AppMode?
    @Namespace private var pillNamespace

    public init(mode: Binding<AppMode>) {
        self._mode = mode
    }

    public var body: some View {
        HStack(spacing: 4) {
            ForEach(AppMode.allCases) { candidate in
                pill(candidate)
            }
        }
        .padding(4)
        .background {
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay {
                    Capsule().strokeBorder(
                        Spindare.Hairline.color(scheme, emphasis: 1.2),
                        lineWidth: Spindare.Hairline.width
                    )
                }
        }
        .spindareElevation(.floating)
        // The held label sits below the control rather than above it, where a
        // finger would be covering it.
        .overlay(alignment: .top) {
            if let held {
                heldLabel(held)
                    .fixedSize()
                    .offset(y: 46)
                    .transition(.opacity.combined(with: .scale(scale: 0.9, anchor: .top)))
            }
        }
        .animation(Spindare.Motion.settle, value: held)
        .sensoryFeedback(.selection, trigger: mode)
    }

    private func pill(_ candidate: AppMode) -> some View {
        let isActive = mode == candidate

        return Image(systemName: candidate.icon)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(
                isActive ? Color.spindareBackground(scheme) : Color.spindarePrimary(scheme)
            )
            .frame(width: 46, height: 34)
            .background {
                if isActive {
                    Capsule()
                        .fill(Color.spindarePrimary(scheme))
                        .matchedGeometryEffect(id: "activePill", in: pillNamespace)
                }
            }
            .contentShape(Capsule())
            // A long press to reveal the label and a tap to switch are the
            // same finger-down event diverging on duration, so they're one
            // gesture — two recognisers on the same view would arbitrate, and
            // the tap would usually lose to the press.
            .onLongPressGesture(minimumDuration: 0.28) {
                // Long-press completed: this was a "what is this?", so it
                // deliberately does *not* switch mode.
                Haptics.impact(.light)
            } onPressingChanged: { pressing in
                held = pressing ? candidate : nil
                if !pressing { return }
            }
            .simultaneousGesture(
                TapGesture().onEnded {
                    guard mode != candidate else { return }
                    withAnimation(Spindare.Motion.page) { mode = candidate }
                }
            )
            .animation(Spindare.Motion.page, value: mode)
    }

    private func heldLabel(_ candidate: AppMode) -> some View {
        VStack(spacing: 2) {
            Text(candidate.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.spindarePrimary(scheme))
            Text(candidate.hint)
                .font(.system(size: 11))
                .foregroundStyle(Color.spindareSecondary(scheme))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background {
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay {
                    Capsule().strokeBorder(
                        Spindare.Hairline.color(scheme, emphasis: 1.2),
                        lineWidth: Spindare.Hairline.width
                    )
                }
        }
        .spindareElevation(.floating)
        .allowsHitTesting(false)
    }
}
