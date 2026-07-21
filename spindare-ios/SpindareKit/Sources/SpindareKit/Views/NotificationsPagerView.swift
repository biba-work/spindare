import SwiftUI

// The Notifications page — a peer of Feed and Profile in AppShell's main
// TabView, not a pushed overlay. Three sub-tabs (Notifications / SPIND /
// Messages) are themselves a nested horizontal-paging TabView, so swiping
// between them is native rather than a hand-rolled DragGesture: a paged
// TabView nested inside another paged TabView on the same axis is a standard,
// UIKit-backed pattern — a child page correctly hands a same-axis drag up to
// its parent once it's at its own edge, which is exactly the "swipe anywhere,
// zero conflict" behaviour a custom gesture struggled to reproduce reliably.
// The tab pills above it are a second, equally valid way in — tapping one
// jumps directly, bound to the same selection.

public struct NotificationsPagerView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var tab: AppRouter.ActivityTab
    /// Live swipe position of the pager below, in page units. This is what the
    /// indicator is bound to — see `tabBar`.
    @State private var pageProgress: CGFloat = 0
    @State private var saved: [SavedChallenge] = []
    @State private var notifications: [AppNotification] = []
    @State private var requests: [ConnectionRequest] = []
    @State private var spind: [SpindChallenge] = []
    @State private var isLoading = true
    /// Ticks so an expiring challenge drops out on its own while you're looking
    /// at it, rather than lingering interactive until the next reload.
    @State private var now = Date()

    /// Challenges that haven't expired. An expired dare used to stay in the list
    /// forever with live Accept/Decline/Capture buttons — a challenge with a
    /// clock that's run out shouldn't still be actionable. Backend `spind/inbox`
    /// already filters these out server-side; this covers the mock feed and the
    /// case where one lapses mid-view.
    private var activeSpind: [SpindChallenge] {
        spind.filter { challenge in
            guard let expiresAt = challenge.expiresAt else { return true }
            return expiresAt > now
        }
    }

    private let socialService: any SocialServing
    private let notificationService: any NotificationServing

    public init(
        socialService: any SocialServing = AppEnvironment.socialService,
        notificationService: any NotificationServing = AppEnvironment.notificationService
    ) {
        self.socialService = socialService
        self.notificationService = notificationService
        // Seeded from the router's one-shot entry request (defaults to
        // `.notifications`) rather than read live — once this page exists,
        // its own tab bar owns the selection.
        _tab = State(initialValue: Self.launchTab ?? .notifications)
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            tabBar

            if isLoading {
                RowSkeleton(count: 5)
                    .padding(.horizontal, Spindare.Spacing.gutter)
                    .padding(.top, Spindare.Spacing.lg)
                Spacer(minLength: 0)
            } else {
                PagedStack(
                    pages: AppRouter.ActivityTab.allCases,
                    selection: $tab,
                    progress: $pageProgress
                ) { page in
                    switch page {
                    case .notifications: scrollingList { activityList }
                    case .spind: scrollingList { spindList }
                    case .messages: MessagesView(embedded: true)
                    }
                }
            }
        }
        .background(Color.spindareBackground(scheme).ignoresSafeArea())
        .task { await load() }
        .task {
            // Re-evaluate expiry roughly every 15s so a lapsing challenge drops
            // out on its own — same cadence Speedys uses for its sponsored gate.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                now = Date()
            }
        }
    }

    private func scrollingList<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            LazyVStack(spacing: Spindare.Spacing.md) {
                content()
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spindare.Spacing.gutter)
            .padding(.vertical, Spindare.Spacing.lg)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Chrome

    private var header: some View {
        HStack {
            Button { router.navigate(to: .feed) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            Spacer()
            // No title here — the tab bar directly below already names
            // whichever section is active, and stacking a second label over
            // it reads as a rendering fault.
            Color.clear.frame(width: 40, height: 40)
        }
        .foregroundStyle(Color.spindarePrimary(scheme))
        .padding(.horizontal, Spindare.Spacing.sm)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Spindare.Hairline.color(scheme))
                .frame(height: Spindare.Hairline.width)
        }
    }

    /// The indicator is driven by the pager's *live* scroll position, not by
    /// the committed `tab`. That's the whole fix: bound to `tab`, the only
    /// information available was "which page won", which arrives once the
    /// swipe is already over — so the line sat still through the entire
    /// gesture and then jumped. Bound to `pageProgress` it glides under the
    /// finger, and because a programmatic `tab` change animates the underlying
    /// scroll (see `PagedStack`), progress sweeps through the intermediate
    /// values on a tap too. One code path, both interactions.
    private var tabBar: some View {
        let tabs = AppRouter.ActivityTab.allCases

        return VStack(spacing: 6) {
            HStack(spacing: 0) {
                ForEach(tabs) { candidate in
                    Button {
                        withAnimation(Spindare.Motion.page) { tab = candidate }
                    } label: {
                        HStack(spacing: 5) {
                            Text(candidate.title)
                                .spindareLabel(size: 10, weight: .bold, tracking: 1.5)
                                // Interpolated off the same continuous
                                // position, so a half-swipe leaves both labels
                                // half-lit rather than snapping at the commit.
                                .foregroundStyle(
                                    Color.spindarePrimary(scheme)
                                        .opacity(0.45 + 0.55 * emphasis(for: candidate))
                                )

                            if let count = badge(for: candidate), count > 0 {
                                Text("\(count)")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 4)
                                    .frame(minWidth: 14, minHeight: 14)
                                    .background(Circle().fill(Spindare.Palette.accent))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            // Measured rather than assumed: the bar's width isn't known until
            // layout, and the indicator's travel is a fraction of it.
            GeometryReader { proxy in
                let indicator = TabIndicator.at(
                    progress: pageProgress,
                    totalWidth: proxy.size.width,
                    tabCount: tabs.count,
                    inset: 10
                )

                Capsule()
                    .fill(Color.spindarePrimary(scheme))
                    .frame(width: indicator.width, height: 2)
                    .offset(x: indicator.offset)
            }
            .frame(height: 2)
        }
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.top, Spindare.Spacing.md)
        .sensoryFeedback(.selection, trigger: tab)
    }

    /// How "selected" a tab reads, 0...1, from the live page position. Falls
    /// off linearly with distance so the two tabs either side of a drag share
    /// the emphasis between them.
    private func emphasis(for candidate: AppRouter.ActivityTab) -> Double {
        guard let index = AppRouter.ActivityTab.allCases.firstIndex(of: candidate) else { return 0 }
        return Double(max(0, 1 - abs(pageProgress - CGFloat(index))))
    }

    private func badge(for candidate: AppRouter.ActivityTab) -> Int? {
        switch candidate {
        case .notifications: notifications.filter { !$0.read }.count + requests.count
        case .spind: activeSpind.filter { !$0.accepted }.count
        case .messages: nil
        }
    }

    // MARK: - SPIND

    /// Challenges sent to you. Two stages by design: accepting is a commitment,
    /// and only then does it offer the capture flow.
    @ViewBuilder
    private var spindList: some View {
        if activeSpind.isEmpty {
            emptyState(icon: "paperplane", title: "No challenges waiting",
                       detail: "When a friend sends you one, it lands here.")
        } else {
            ForEach(activeSpind) { item in
                VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
                    HStack(spacing: Spindare.Spacing.sm) {
                        Avatar(url: item.fromAvatar, size: 28)
                        Text("@\(item.fromUsername)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.spindarePrimary(scheme))
                        Text("sent you this")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.spindareSecondary(scheme))
                        Spacer(minLength: 0)
                    }

                    Text(item.challenge)
                        .font(.system(size: 15))
                        .lineSpacing(5)
                        .foregroundStyle(Color.spindarePrimary(scheme))
                        .fixedSize(horizontal: false, vertical: true)

                    CountdownPill(expiresAt: item.expiresAt)

                    if item.accepted {
                        // Stage two: accepted, now go do it.
                        drawerAction("Capture proof", icon: "camera") {
                            router.startProof(for: item.challenge)
                        }
                    } else {
                        HStack(spacing: Spindare.Spacing.sm) {
                            drawerAction("Accept", icon: "checkmark") {
                                accept(item)
                            }
                            Button {
                                decline(item)
                            } label: {
                                Text("Decline")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color.spindareSecondary(scheme))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 40)
                                    .background {
                                        RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                            .strokeBorder(
                                                Spindare.Hairline.color(scheme, emphasis: 2),
                                                lineWidth: Spindare.Hairline.width
                                            )
                                    }
                            }
                            .buttonStyle(PressableStyle())
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
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
        }
    }

    private func accept(_ item: SpindChallenge) {
        // Optimistic: flip it locally, then confirm. Waiting on the round trip
        // left the button looking dead for as long as the request took.
        guard let index = spind.firstIndex(where: { $0.id == item.id }) else { return }
        withAnimation(Spindare.Motion.enter) { spind[index].accepted = true }

        Task {
            do {
                try await socialService.acceptSpind(id: item.id)
            } catch {
                withAnimation(Spindare.Motion.enter) {
                    if let revert = spind.firstIndex(where: { $0.id == item.id }) {
                        spind[revert].accepted = false
                    }
                }
            }
        }
    }

    private func decline(_ item: SpindChallenge) {
        let snapshot = spind
        withAnimation(Spindare.Motion.enter) { spind.removeAll { $0.id == item.id } }

        Task {
            do {
                try await socialService.declineSpind(id: item.id)
            } catch {
                withAnimation(Spindare.Motion.enter) { spind = snapshot }
            }
        }
    }

    private func drawerAction(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
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

    // MARK: - Activity

    @ViewBuilder
    private var activityList: some View {
        if !requests.isEmpty {
            sectionLabel("Connection requests")
            ForEach(requests) { request in
                HStack(spacing: Spindare.Spacing.md) {
                    Avatar(url: request.photoURL, size: 40)
                    Text("@\(request.username)")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.spindarePrimary(scheme))
                    Spacer(minLength: 0)
                    Button("Accept") {
                        // Removed immediately and restored only if the call
                        // fails. Previously the row sat there unchanged until
                        // the request returned, so it read as an unresponsive
                        // button and invited a second tap.
                        let snapshot = requests
                        withAnimation(Spindare.Motion.enter) {
                            requests.removeAll { $0.id == request.id }
                        }
                        Task {
                            do {
                                try await socialService.acceptRequest(from: request.id)
                            } catch {
                                withAnimation(Spindare.Motion.enter) { requests = snapshot }
                            }
                        }
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .frame(height: 34)
                    .background(Capsule().fill(Spindare.Palette.ink))
                    .buttonStyle(.plain)
                }
                .padding(Spindare.Spacing.md)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }
            }
        }

        if notifications.isEmpty && requests.isEmpty {
            emptyState(icon: "bell", title: "All caught up", detail: "Nothing new right now.")
        } else if !notifications.isEmpty {
            sectionLabel("Recent")
            ForEach(notifications) { notification in
                HStack(alignment: .top, spacing: Spindare.Spacing.md) {
                    Avatar(url: notification.fromAvatar, size: 40)

                    VStack(alignment: .leading, spacing: 3) {
                        (Text("@\(notification.fromUsername) ").font(.system(size: 14, weight: .semibold))
                         + Text(notification.content).font(.system(size: 14)))
                            .foregroundStyle(Color.spindarePrimary(scheme))
                            .fixedSize(horizontal: false, vertical: true)

                        Text(notification.createdAt.relativeShort)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }

                    Spacer(minLength: 0)

                    if !notification.read {
                        Circle()
                            .fill(Spindare.Palette.accent)
                            .frame(width: 7, height: 7)
                            .padding(.top, 5)
                    }
                }
                .padding(Spindare.Spacing.md)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }
            }
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .spindareLabel(size: 10, weight: .bold, tracking: 2)
            .foregroundStyle(Color.spindareSecondary(scheme))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func emptyState(icon: String, title: String, detail: String) -> some View {
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

        // Concurrently — three serial round trips made this page feel slow to
        // open for no reason.
        async let fetchedNotifications = try? await notificationService.notifications()
        async let fetchedRequests = try? await socialService.pendingRequests()
        async let fetchedSpind = try? await socialService.spindInbox()

        notifications = await fetchedNotifications ?? []
        requests = await fetchedRequests ?? []
        spind = await fetchedSpind ?? []

        try? await notificationService.markAllRead()
    }

    /// Opens straight onto a sub-tab, for screenshotting a single one:
    ///
    ///     xcrun simctl launch booted com.spindare.Spindare \
    ///         -skipOnboarding -openPage notifications -openTab spind
    static var launchTab: AppRouter.ActivityTab? {
        AppRouter.launchActivityTab
    }
}
