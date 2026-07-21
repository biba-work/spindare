import SwiftUI

// The saved-challenges drawer — the one layer you dismiss by dragging rather
// than by pressing a button. Activity/SPIND/Messages used to share this file
// as a second `DrawerMode`; they're now `NotificationsPagerView`, a peer page
// of the main TabView rather than a pushed overlay, so this file is just
// Saved now.
//
// Saving is a commitment with a clock, not a bookmark: every saved challenge
// expires in 48 hours and its countdown turns urgent under six.

public struct SavedDrawerView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var saved: [SavedChallenge] = []
    @State private var isLoading = true
    /// Ticks so an item drops out the moment its clock runs out, instead of
    /// sitting there with a dead countdown until the drawer is reopened.
    @State private var now = Date()

    /// Saved challenges that haven't expired yet. Saving is a commitment with a
    /// deadline, so an expired one should leave — the live backend already
    /// filters these server-side, but the mock store returns everything and
    /// neither covers an item lapsing while you're looking at it.
    private var activeSaved: [SavedChallenge] {
        saved.filter { item in
            guard let expiresAt = item.expiresAt else { return true }
            return expiresAt > now
        }
    }

    private let socialService: any SocialServing

    public init(socialService: any SocialServing = AppEnvironment.socialService) {
        self.socialService = socialService
    }

    public var body: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()

            VStack(spacing: 0) {
                grabber
                header

                ScrollView {
                    LazyVStack(spacing: Spindare.Spacing.md) {
                        if isLoading {
                            RowSkeleton(count: 5)
                        } else {
                            savedList
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spindare.Spacing.gutter)
                    .padding(.vertical, Spindare.Spacing.lg)
                }
                .scrollIndicators(.hidden)
            }
        }
        .task { await load() }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                now = Date()
            }
        }
    }

    private var grabber: some View {
        VStack(spacing: 4) {
            SemiArrowShape(translationY: 0)
                .stroke(Color.spindareSecondary(scheme), style: StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round))
                .frame(width: 38, height: 8)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, Spindare.Spacing.sm)
    }

    private var header: some View {
        ZStack {
            HStack {
                Button { router.pop() } label: {
                    Text("Close")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }
                Spacer()
            }
            Text("SAVED")
                .spindareLabel(size: 12, weight: .semibold, tracking: 4)
                .foregroundStyle(Color.spindarePrimary(scheme))
        }
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.vertical, Spindare.Spacing.md)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Spindare.Hairline.color(scheme))
                .frame(height: Spindare.Hairline.width)
        }
    }

    @ViewBuilder
    private var savedList: some View {
        if activeSaved.isEmpty {
            emptyState(icon: "bookmark", title: "Nothing saved",
                       detail: "Challenges you save show up here for 48 hours.")
        } else {
            ForEach(activeSaved) { item in
                VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
                    Text(item.challenge)
                        .font(.system(size: 15))
                        .lineSpacing(5)
                        .foregroundStyle(Color.spindarePrimary(scheme))
                        .fixedSize(horizontal: false, vertical: true)

                    CountdownPill(expiresAt: item.expiresAt)

                    HStack(spacing: Spindare.Spacing.sm) {
                        drawerAction("Do it", icon: "camera") {
                            router.pop()
                            router.startProof(for: item.challenge)
                        }
                        drawerAction("Send", icon: "paperplane") {
                            router.shareChallenge(item.challenge)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spindare.Spacing.lg)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                        .overlay {
                            RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                                .strokeBorder(Spindare.Hairline.color(scheme), lineWidth: Spindare.Hairline.width)
                        }
                }
            }
        }
    }

    func drawerAction(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(title).font(.system(size: 13, weight: .medium))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background {
                RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                    .fill(Spindare.Palette.ink)
            }
        }
        .buttonStyle(PressableStyle())
    }

    func emptyState(icon: String, title: String, detail: String) -> some View {
        VStack(spacing: Spindare.Spacing.sm) {
            Image(systemName: icon).font(.system(size: 32, weight: .light))
            Text(title).font(.system(size: 15, weight: .medium))
            Text(detail).font(.system(size: 13)).multilineTextAlignment(.center)
        }
        .foregroundStyle(Color.spindareSecondary(scheme))
        .padding(.top, 80)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        saved = (try? await socialService.savedChallenges()) ?? []
    }
}

// MARK: - Countdown

/// Formatting for a countdown, pulled out of the view so the boundaries can be
/// tested — the six-hour urgency switch and the day/hour rollovers are exactly
/// the kind of arithmetic that looks right and is off by one.
public struct Countdown: Sendable, Equatable {
    public let label: String
    public let urgent: Bool

    /// Under six hours the pill turns urgent: the original's way of saying this
    /// is about to lapse.
    public static let urgentThreshold: TimeInterval = 6 * 3600

    public static func remaining(until expiresAt: Date?, now: Date) -> Countdown {
        guard let expiresAt else { return Countdown(label: "No deadline", urgent: false) }

        let seconds = Int(expiresAt.timeIntervalSince(now))
        guard seconds > 0 else { return Countdown(label: "Expired", urgent: true) }

        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let urgent = TimeInterval(seconds) < urgentThreshold

        if hours >= 24 {
            return Countdown(label: "\(hours / 24)d \(hours % 24)h left", urgent: urgent)
        }
        if hours > 0 {
            return Countdown(label: "\(hours)h \(minutes)m left", urgent: urgent)
        }
        // Under an hour is always urgent regardless of the threshold.
        return Countdown(label: "\(minutes)m left", urgent: true)
    }
}

struct CountdownPill: View {
    let expiresAt: Date?

    var body: some View {
        // Driven by TimelineView so it actually counts down. An earlier
        // version computed the remaining time in a `body` getter, which
        // SwiftUI only re-evaluates when something it depends on changes — and
        // a wall-clock read is not a dependency. The label was therefore
        // frozen at whatever it said when the drawer opened.
        TimelineView(.periodic(from: .now, by: 60)) { context in
            let state = Countdown.remaining(until: expiresAt, now: context.date)
            let tint = state.urgent ? Spindare.Palette.danger : Spindare.Palette.blueTint

            Label(state.label, systemImage: "clock")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(tint)
                .contentTransition(.numericText(countsDown: true))
                .animation(Spindare.Motion.enter, value: state.label)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background { Capsule().fill(tint.opacity(0.12)) }
        }
    }
}

extension Spindare.Palette {
    /// Non-urgent countdown tint.
    static let blueTint = Color(hex: 0x007AFF)
}
