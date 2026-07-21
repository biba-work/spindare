import SwiftUI

// Navigation state for a single-surface app.
//
// Spindare has no tab bar and no navigation library — the RN original drives
// everything from ~9 independent booleans in one root component, where the
// z-order of overlapping layers is decided by JSX ordering. That works but is
// fragile and undiscoverable, so this models the same behaviour as an explicit
// stack: the last layer pushed is the one on top.
//
// There is no back-chevron hierarchy anywhere in this app. Every exit is a
// close button or a downward drag, which is why this is a stack of full-screen
// layers rather than a NavigationPath.

@MainActor
@Observable
public final class AppRouter {

    // MARK: - Root

    public enum Root: Equatable {
        case onboarding
        case feed
    }

    public private(set) var root: Root = .onboarding

    // MARK: - Pages
    //
    // Feed, Profile, and Notifications are peer pages of one horizontal-paging
    // TabView in AppShell, not layers in `stack` below. They used to be —
    // Profile was a pushed `.hard` layer with an ancestor DragGesture for
    // swipe-to-dismiss, and that gesture kept winning arbitration against
    // Buttons inside it (most visibly: the grid/list toggle, which tapping
    // "grid" from "list" silently did nothing). Native paging is orthogonal to
    // a page's own vertical scrolling by construction, so there is no longer
    // any ancestor gesture over Profile's content to compete with a tap at all.

    public enum Page: Hashable {
        case profile, feed, notifications
    }

    public private(set) var activePage: Page = .feed

    /// The only way to change pages. A plain `activePage = ...` assignment at
    /// a call site has no animation context, so the page host's scroll never
    /// gets to animate — it just cuts. Routing every change through here means
    /// every entry point (the header's avatar/bell, a page's own back button)
    /// gets the same motion without repeating `withAnimation` everywhere.
    ///
    /// `.page` rather than `.enter` deliberately: this drives a scroll offset
    /// that a finger can also drive, and it should land the way a released
    /// swipe lands. `.enter` is tuned for something arriving from off-screen
    /// and overshoots noticeably when a whole page rides on it.
    public func navigate(to page: Page) {
        withAnimation(Spindare.Motion.page) { activePage = page }
    }

    public enum ActivityTab: String, CaseIterable, Identifiable, Sendable {
        case notifications, spind, messages

        public var id: String { rawValue }

        public var title: String {
            switch self {
            case .notifications: "ACTIVITY"
            case .spind: "SPIND"
            case .messages: "MESSAGES"
            }
        }
    }

    // MARK: - Layers

    public struct UserRef: Equatable, Hashable, Identifiable, Sendable {
        public let id: String
        public let username: String
        public let avatarURL: String?

        public init(id: String, username: String, avatarURL: String? = nil) {
            self.id = id
            self.username = username
            self.avatarURL = avatarURL
        }
    }

    public struct ConversationRef: Equatable, Hashable, Identifiable, Sendable {
        public let id: String
        public let otherUsername: String
        public let otherAvatarURL: String?

        public init(id: String, otherUsername: String, otherAvatarURL: String? = nil) {
            self.id = id
            self.otherUsername = otherUsername
            self.otherAvatarURL = otherAvatarURL
        }
    }

    public enum Layer: Equatable, Hashable, Identifiable {
        case composer
        case messages
        /// The inboxed-conversations list — reachable from `MessagesView` so
        /// a thread you swiped "Inbox" on isn't just gone with extra steps.
        case archivedMessages
        case chat(ConversationRef)
        case userProfile(UserRef)
        /// The saved-challenges drawer — the only `DrawerMode` left once
        /// Activity/SPIND/Messages moved to `NotificationsPagerView` as a page.
        case savedDrawer
        case friendPicker

        public var id: String {
            switch self {
            case .composer: "composer"
            case .messages: "messages"
            case .archivedMessages: "archivedMessages"
            case .chat(let c): "chat-\(c.id)"
            case .userProfile(let u): "userProfile-\(u.id)"
            case .savedDrawer: "savedDrawer"
            case .friendPicker: "friendPicker"
            }
        }

        /// How a layer presents. The RN app uses three distinct behaviours and
        /// the difference encodes weight — flattening everything to one sheet
        /// style would throw that information away.
        public var presentation: Presentation {
            switch self {
            case .composer: .animated
            case .savedDrawer: .draggable
            default: .hard
            }
        }

        /// The screen edge this layer enters from — and therefore the direction
        /// it can be dragged back out toward.
        public var entryEdge: Edge {
            switch self {
            // Enters from the bottom and drags *down* to dismiss, matching the
            // top grabber's affordance (a horizontal handle reads as "pull
            // down", not "swipe right"). LayerContainer already supports a
            // bottom entry edge — the composer uses it.
            case .savedDrawer: .bottom
            case .composer: .bottom
            default: .trailing
            }
        }

        /// Whether a drag can dismiss this layer. The composer is the one
        /// exception — mid-post, an accidental swipe should not discard what
        /// you have typed, so it closes by an explicit button only.
        public var isDragDismissable: Bool {
            presentation != .animated
        }
    }

    public enum Presentation {
        /// Snaps in with no animation; closes via an explicit button only.
        case hard
        /// Springs up, times out; closes via button.
        case animated
        /// Springs up and can be dragged away, but only when its scroll view
        /// is at the top.
        case draggable
    }

    public private(set) var stack: [Layer] = []

    public var topLayer: Layer? { stack.last }

    // MARK: - The spine
    //
    // `challenge` is the single piece of state that survives every transition.
    // It is written by the wheel, a search-result tap, a feed-card action or a
    // saved-card action; and read by the composer ("THE CHALLENGE"), the friend
    // picker, and post submission.

    public var challenge: String?

    /// Media captured as proof, carried into the composer.
    public var proofMediaURL: URL?
    /// Whether the proof came from the camera rather than the library, so the
    /// raw temp file can be cleaned up after upload.
    public var proofFromCamera = false

    // MARK: - Session

    public private(set) var userId: String?
    public private(set) var username: String?
    public private(set) var email: String?
    public private(set) var avatarURL: String?

    public init() {}

    /// Starts already signed in, bypassing onboarding. For SwiftUI previews and
    /// for launching straight into the feed during development:
    ///
    ///     xcrun simctl launch booted com.spindare.Spindare -skipOnboarding
    ///
    /// Never reachable in a normal launch — the flag has to be passed explicitly.
    public static func previewSignedIn(
        userId: String = "dev-user",
        username: String = "you"
    ) -> AppRouter {
        let router = AppRouter()
        router.userId = userId
        router.username = username
        router.root = .feed
        if let page = launchPage { router.activePage = page }
        if let layer = launchLayer { router.stack = [layer] }
        return router
    }

    public static var launchedWithOnboardingSkipped: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipOnboarding")
    }

    /// Opens straight onto a page, for screenshotting a single surface:
    ///
    ///     xcrun simctl launch booted com.spindare.Spindare -skipOnboarding -openPage profile
    public static var launchPage: Page? {
        let args = ProcessInfo.processInfo.arguments
        guard let flag = args.firstIndex(of: "-openPage"),
              args.index(after: flag) < args.endIndex
        else { return nil }

        return switch args[args.index(after: flag)] {
        case "profile": .profile
        case "feed": .feed
        case "notifications": .notifications
        default: nil
        }
    }

    /// Opens straight onto a layer, for screenshotting a single surface:
    ///
    ///     xcrun simctl launch booted com.spindare.Spindare -skipOnboarding -openLayer composer
    public static var launchLayer: Layer? {
        let args = ProcessInfo.processInfo.arguments
        guard let flag = args.firstIndex(of: "-openLayer"),
              args.index(after: flag) < args.endIndex
        else { return nil }

        return switch args[args.index(after: flag)] {
        case "composer": .composer
        case "saved": .savedDrawer
        case "friends": .friendPicker
        case "messages": .messages
        default: nil
        }
    }

    /// Companion to `-openPage notifications`, for screenshotting a specific
    /// sub-tab:
    ///
    ///     xcrun simctl launch booted com.spindare.Spindare \
    ///         -skipOnboarding -openPage notifications -openTab spind
    public static var launchActivityTab: ActivityTab? {
        let args = ProcessInfo.processInfo.arguments
        guard let flag = args.firstIndex(of: "-openTab"),
              args.index(after: flag) < args.endIndex
        else { return nil }
        return ActivityTab(rawValue: args[args.index(after: flag)])
    }

    // MARK: - Auth

    public func didSignIn(userId: String, username: String, email: String?, avatarURL: String?) {
        self.userId = userId
        self.username = username
        self.email = email
        self.avatarURL = avatarURL
        withAnimation(Spindare.Motion.enter) {
            root = .feed
        }
    }

    public func didSignOut() {
        userId = nil
        username = nil
        email = nil
        avatarURL = nil
        stack.removeAll()
        activePage = .feed
        challenge = nil
        clearProof()
        withAnimation(Spindare.Motion.enter) {
            root = .onboarding
        }
    }

    /// Reflects a just-changed avatar/username across every surface that reads
    /// the session identity — the header, feed authorship on new posts, the
    /// friend picker — rather than only the screen that made the change.
    public func updateAvatar(_ url: String?) {
        avatarURL = url
    }

    public func updateUsername(_ name: String) {
        username = name
    }

    // MARK: - Stack
    //
    // Every mutation here goes through `withAnimation` internally, not at each
    // call site. `LayerContainer`'s `.transition()` and the page host's slide
    // are both defined already — they were only ever "teleporting" because
    // nothing put the state change that triggers them inside an animation
    // context. Wrapping it once, centrally, means every call site (composer,
    // saved, friend picker, chat, another user's profile) gets the same
    // motion for free, rather than needing `withAnimation` copy-pasted at
    // every button.

    public func push(_ layer: Layer) {
        // Re-pushing the layer that's already on top is a no-op rather than a
        // duplicate — double-taps on a button shouldn't stack two copies.
        guard topLayer != layer else { return }

        withAnimation(Spindare.Motion.layer) {
            // A layer already further down gets promoted rather than duplicated.
            if let existing = stack.firstIndex(of: layer) {
                stack.remove(at: existing)
            }
            stack.append(layer)
        }
    }

    public func pop() {
        guard !stack.isEmpty else { return }
        withAnimation(Spindare.Motion.layer) { _ = stack.removeLast() }
    }

    public func dismiss(_ layer: Layer) {
        withAnimation(Spindare.Motion.layer) { stack.removeAll { $0 == layer } }
    }

    public func dismissAll() {
        withAnimation(Spindare.Motion.layer) { stack.removeAll() }
    }

    /// Replaces the top layer instead of stacking on it. Used where the RN app
    /// swaps rather than stacks — messages → chat, and user profile → chat.
    public func replaceTop(with layer: Layer) {
        withAnimation(Spindare.Motion.layer) {
            if !stack.isEmpty { stack.removeLast() }
        }
        push(layer)
    }

    // MARK: - Intents
    //
    // Named for what the user is doing, so call sites read as intent and the
    // stack bookkeeping stays in one place.

    /// Take on a challenge and go capture proof of it.
    public func startProof(for challenge: String) {
        self.challenge = challenge
        push(.composer)
    }

    /// Send a challenge to a friend. Deliberately stacks *above* whatever is showing
    /// so that sharing from inside the spinner result returns you to it intact.
    public func shareChallenge(_ challenge: String) {
        self.challenge = challenge
        push(.friendPicker)
    }

    public func openChat(_ conversation: ConversationRef) {
        // Swap rather than stack: you should not be able to back out of a chat
        // into the message list *and* still have the list underneath.
        if topLayer == .messages || isUserProfile(topLayer) {
            replaceTop(with: .chat(conversation))
        } else {
            push(.chat(conversation))
        }
    }

    public func clearProof() {
        proofMediaURL = nil
        proofFromCamera = false
    }

    private func isUserProfile(_ layer: Layer?) -> Bool {
        if case .userProfile = layer { return true }
        return false
    }
}
