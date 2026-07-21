import SwiftUI

// The single surface.
//
// Spindare is not a tabbed app in the UIKit sense — no persistent tab bar
// eating screen space — but Feed, Profile, and Notifications are peer pages
// of one horizontal-paging TabView, reached by swiping (or by the header's
// avatar/bell) rather than by a visible tab bar.
//
// This replaced an earlier version where Profile and the activity drawer were
// pushed as `AppRouter.Layer` overlays with a hand-rolled ancestor
// `DragGesture` for swipe-to-dismiss. That gesture kept winning arbitration
// against Buttons inside it — most visibly, tapping "grid" from "list" on the
// profile toggle silently did nothing, and two attempts at patching the
// gesture's priority/geometry didn't fix it. Native paging is orthogonal to a
// page's own vertical scrolling by construction, so there is no longer any
// ancestor gesture over Profile's content to compete with a tap at all — the
// fix is removing the competing mechanism, not out-arguing it.
//
// Everything else that isn't part of this three-page flow — composer, chat,
// another user's profile, the friend picker, the saved-challenges drawer —
// still uses the overlay-stack system below (`AppRouter.stack` /
// `LayerContainer`), unaffected by this change.

public struct AppShell: View {
    @Environment(\.colorScheme) private var scheme
    @State private var router: AppRouter
    @State private var headerHidden = false
    @State private var isCompactHeader = false
    @State private var lastOffset: CGFloat = 0
    @State private var isSearching = false
    @State private var query = ""
    /// Bookmark and bell badge counts. Fetched independently of the
    /// notifications pager's own load — that path marks things read, which
    /// would zero out a badge the header just populated, so this can't reuse it.
    @State private var savedCount = 0
    @State private var activityBadgeCount = 0
    /// Live swipe position across the three pages. Nothing reads it yet — the
    /// page host requires the binding — but it's the hook for any chrome that
    /// should track the page rather than jump with it.
    @State private var pageProgress: CGFloat = 1
    /// Which of Feed / SPeedys / Zone the middle page is showing.
    @State private var mode: AppMode = .feed

    private let scrollSpace = "feed"
    private let socialService: any SocialServing
    private let notificationService: any NotificationServing

    /// How far the base surface has receded behind an overlay layer — full
    /// once anything is pushed, otherwise none.
    private var revealProgress: CGFloat {
        router.stack.isEmpty ? 0 : 1
    }

    private var pageBinding: Binding<AppRouter.Page> {
        Binding(get: { router.activePage }, set: { router.navigate(to: $0) })
    }

    public init(
        router: AppRouter = AppRouter(),
        socialService: any SocialServing = AppEnvironment.socialService,
        notificationService: any NotificationServing = AppEnvironment.notificationService
    ) {
        _router = State(initialValue: router)
        self.socialService = socialService
        self.notificationService = notificationService
    }

    public var body: some View {
        ZStack(alignment: .top) {
            Color.spindareBackground(scheme).ignoresSafeArea()

            // Base surface — this is what recedes behind an overlay layer. The
            // scale and dim must NOT wrap `layerStack`, or the layer being
            // pushed shrinks along with the thing it's covering.
            PagedStack(
                pages: [.profile, .feed, .notifications],
                selection: pageBinding,
                progress: $pageProgress
            ) { page in
                switch page {
                case .profile: ProfileView()
                case .feed: feedPage
                case .notifications: NotificationsPagerView()
                }
            }
            .scaleEffect(1 - 0.06 * revealProgress)
            .overlay {
                Color.black
                    .opacity(0.18 * revealProgress)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
            .animation(Spindare.Motion.enter, value: router.stack.count)

            layerStack
        }
        .environment(router)
        .task(id: router.userId) {
            // Relabels the sentinel-authored seed posts to the signed-in id so
            // "your" challenges show up on your own profile. No-op against a live
            // backend — the mock store simply isn't in play there.
            guard let userId = router.userId else { return }
            await MockBackend.shared.bind(
                userId: userId,
                username: router.username ?? "you",
                email: router.email
            )
            await refreshBadges()
        }
        // Closing any layer is the simplest reliable moment to catch a saved
        // challenge, an accepted request, or a read notification — rather
        // than threading a callback through every place that could change one
        // of these counts.
        .onChange(of: router.stack.isEmpty) { _, isEmpty in
            guard isEmpty else { return }
            Task { await refreshBadges() }
        }
    }

    private var feedPage: some View {
        ZStack(alignment: .top) {
            // Feed keeps its header and search; SPeedys and Zone are
            // full-bleed surfaces where a bar across the top would only be in
            // the way — a video card and a map both want the whole screen.
            switch mode {
            case .feed:
                feedMode
            case .speedys:
                SpeedysView()
            case .zone:
                ZoneView()
            }

            if mode == .feed {
                AppHeader(
                    router: router,
                    isSearching: $isSearching,
                    query: $query,
                    avatarURL: router.avatarURL,
                    savedCount: savedCount,
                    activityCount: activityBadgeCount,
                    compact: isCompactHeader,
                    username: router.username
                )
                .offset(y: headerHidden ? -AppHeader.height : 0)
            }
        }
        // Floats over whichever mode is showing. Hidden while searching — the
        // keyboard is up and the search results own the screen at that point.
        .overlay(alignment: .bottom) {
            if !isSearching {
                ModeSwitcher(mode: $mode)
                    .padding(.bottom, Spindare.Spacing.lg)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(Spindare.Motion.settle, value: isSearching)
    }

    private var feedMode: some View {
        ZStack(alignment: .top) {
            // Always mounted, never unloaded — layers cover it rather than
            // replacing it.
            FeedView(
                currentUserId: router.userId,
                currentUsername: router.username,
                currentAvatar: router.avatarURL,
                onProfileTap: { router.push(.userProfile($0)) }
            )
            .safeAreaPadding(.top, AppHeader.height)
            .onScrollOffsetChange(in: scrollSpace) { offset in
                updateHeader(for: offset)
            }

            if isSearching {
                SearchView(query: $query, isSearching: $isSearching)
                    .padding(.top, AppHeader.height)
            }
        }
    }

    private func refreshBadges() async {
        async let savedTask = socialService.savedChallenges()
        async let notificationsTask = notificationService.notifications()
        async let requestsTask = socialService.pendingRequests()

        let saved = (try? await savedTask) ?? []
        let notifications = (try? await notificationsTask) ?? []
        let requests = (try? await requestsTask) ?? []

        savedCount = saved.count
        activityBadgeCount = notifications.filter { !$0.read }.count + requests.count
    }

    // MARK: - Layers

    @ViewBuilder
    private var layerStack: some View {
        // Rendered in stack order, so the last pushed sits on top. This
        // ordering is load-bearing: the friend picker must be able to appear
        // over a user's profile so that sharing mid-spin returns you to the
        // result you were looking at, still intact underneath.
        ForEach(router.stack) { layer in
            LayerContainer(layer: layer) {
                router.dismiss(layer)
            } content: {
                view(for: layer)
            }
        }
    }

    @ViewBuilder
    private func view(for layer: AppRouter.Layer) -> some View {
        switch layer {
        case .composer:
            ComposerView()
        case .messages:
            MessagesView()
        case .archivedMessages:
            ArchivedMessagesView()
        case .chat(let conversation):
            ChatView(conversation: conversation)
        case .userProfile(let user):
            UserProfileView(user: user)
        case .savedDrawer:
            SavedDrawerView()
        case .friendPicker:
            FriendPickerView()
        }
    }

    // MARK: - Header hide-on-scroll
    //
    // Thresholds are deliberately asymmetric in the original: hiding needs 8pt
    // of downward travel and only applies past an 80pt dead zone, while
    // revealing needs just 6pt. Reappearing is easier than disappearing.

    private func updateHeader(for offset: CGFloat) {
        guard !isSearching else {
            // Searching pins the header open — it *is* the search field.
            if headerHidden { headerHidden = false }
            lastOffset = offset
            return
        }

        let delta = offset - lastOffset

        if delta > 8, offset > 80, !headerHidden {
            withAnimation(Spindare.Motion.enter) { headerHidden = true }
        } else if delta < -6, headerHidden {
            withAnimation(Spindare.Motion.enter) { headerHidden = false }
        }

        // Once you're genuinely into the feed the bar comes back condensed
        // rather than at full height. Returning to the very top restores it.
        let shouldCompact = offset > 120
        if shouldCompact != isCompactHeader {
            withAnimation(Spindare.Motion.enter) { isCompactHeader = shouldCompact }
        }

        lastOffset = offset
    }
}

// MARK: - Layer container

/// Applies the presentation behaviour a layer declares. The three tiers are a
/// deliberate hierarchy in the original, not an inconsistency.
private struct LayerContainer<Content: View>: View {
    let layer: AppRouter.Layer
    let onDismiss: () -> Void
    @ViewBuilder let content: Content

    /// Distance dragged along the layer's dismissal axis. Always positive —
    /// "how far toward the exit", with the sign reapplied on display.
    @State private var dragged: CGFloat = 0

    var body: some View {
        content
            .offset(x: horizontalOffset, y: verticalOffset)
            // `.simultaneousGesture`, not `.gesture` — plain `.gesture` claims
            // exclusive priority over descendant gestures whenever SwiftUI's
            // arbitration is ambiguous, which can eat taps on buttons in the
            // content below it. Simultaneous recognition lets a stationary tap
            // still reach a button while a real drag still fully drives the
            // dismiss. (The remaining layers here — composer, chat, another
            // user's profile, the friend picker, the saved drawer — don't have
            // a reported version of the bug that motivated this, but there's
            // no reason to leave the more fragile arbitration in place.)
            .simultaneousGesture(gesture)
            .transition(transition)
    }

    private var horizontalOffset: CGFloat {
        layer.entryEdge == .trailing ? dragged : 0
    }

    private var verticalOffset: CGFloat {
        layer.entryEdge == .bottom ? dragged : 0
    }

    /// Asymmetric on purpose — a push in and a lighter dismissal out, so the two
    /// directions don't feel like the same event played backwards.
    private var transition: AnyTransition {
        .asymmetric(
            insertion: .move(edge: layer.entryEdge),
            removal: .move(edge: layer.entryEdge).combined(with: .opacity)
        )
    }

    /// One gesture that branches on the layer's exit edge. There is no gesture
    /// equivalent of `@ViewBuilder`, so a `switch` returning different Gesture
    /// types can't be expressed — and attaching two DragGestures makes them
    /// fight over the same touch.
    private var gesture: some Gesture {
        DragGesture(minimumDistance: 15)
            .onChanged { value in
                guard layer.isDragDismissable, canBegin(value) else { return }
                // Tracked directly, with no `.animation(value:)` on the offset.
                // An implicit spring there makes the layer lag behind the
                // finger, which reads as dropped frames rather than as weight.
                dragged = max(0, travel(value.translation))
            }
            .onEnded { value in
                guard layer.isDragDismissable else { return }

                let residual = travel(value.predictedEndTranslation) - travel(value.translation)
                if dragged > dismissThreshold || (dragged > 30 && residual > 160) {
                    withAnimation(Spindare.Motion.settle) {
                        dragged = layer.entryEdge == .bottom ? 800 : 500
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        onDismiss()
                        dragged = 0
                    }
                } else {
                    withAnimation(Spindare.Motion.settle) {
                        dragged = 0
                    }
                }
            }
    }

    /// Whether this drag is allowed to become a dismissal.
    ///
    /// Horizontal layers additionally need a horizontal bias, or a diagonal
    /// flick while scrolling starts sliding the whole screen away.
    private func canBegin(_ value: DragGesture.Value) -> Bool {
        let dx = value.translation.width
        let dy = value.translation.height

        switch layer.entryEdge {
        case .trailing:
            // The standard iOS back-swipe: from the leading edge only, so this
            // never competes with a layer's own horizontal content.
            return value.startLocation.x < 40 && abs(dx) > abs(dy) * 1.4
        default:
            return dy > 0
        }
    }

    /// Projects a translation onto the axis that dismisses this layer, so a
    /// drag "toward the exit" is positive whichever edge that happens to be.
    private func travel(_ translation: CGSize) -> CGFloat {
        layer.entryEdge == .trailing ? translation.width : translation.height
    }

    /// A downward drag has the whole screen height to work with; a sideways one
    /// competes with content, so it commits sooner.
    private var dismissThreshold: CGFloat {
        layer.entryEdge == .bottom ? 120 : 110
    }
}
