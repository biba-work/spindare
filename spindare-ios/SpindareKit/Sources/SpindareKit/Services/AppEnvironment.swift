import Foundation
import ClerkKit

/// The app's composition root, reduced to a set of swappable service slots.
///
/// Every view and view-model injects its service via a default argument. Those
/// defaults used to be `= MockFeedService()` literally; they're now
/// `= AppEnvironment.feedService`, so the one place that decides Mock-vs-Live is
/// here. `SpindareApp.init()` overwrites these with `Live*Service` values backed
/// by a real `APIClient` *before* the first view renders — Swift re-evaluates a
/// default-argument expression at each call site, so whatever's assigned here at
/// launch is what every subsequently-constructed view picks up.
///
/// Chat is live now too. Speedys and Zone still have no `Live` implementation,
/// so they keep their own `Mock*Service()` defaults and are untouched by this.
///
/// `nonisolated(unsafe)`: these are written exactly once, synchronously, during
/// app launch before any concurrency exists, then only ever read. The stored
/// values are all `Sendable` (the protocols require it). The single-writer-at-
/// startup shape is what makes the opt-out honest rather than a race waiting to
/// happen.
public enum AppEnvironment {
    nonisolated(unsafe) public static var feedService: any FeedServing = MockFeedService()
    nonisolated(unsafe) public static var profileService: any ProfileServing = MockProfileService()
    nonisolated(unsafe) public static var socialService: any SocialServing = MockSocialService()
    nonisolated(unsafe) public static var notificationService: any NotificationServing = MockNotificationService()
    nonisolated(unsafe) public static var searchService: any SearchServing = MockSearchService()
    nonisolated(unsafe) public static var chatService: any ChatServing = MockChatService()

    /// Uploads media to R2 via the Nest storage endpoints. `nil` in mock mode:
    /// call sites fall back to writing a local file so posting still works
    /// entirely offline. Set to a real uploader only when running live.
    nonisolated(unsafe) public static var mediaUploader: MediaUploader?

    /// Assigns the live service set. Called from `bootstrap` when a backend
    /// URL is configured.
    public static func useLive(api: APIClient) {
        feedService = LiveFeedService(api: api)
        profileService = LiveProfileService(api: api)
        socialService = LiveSocialService(api: api)
        notificationService = LiveNotificationService(api: api)
        searchService = LiveSearchService(api: api)
        chatService = LiveChatService(api: api)
        mediaUploader = MediaUploader(api: api)
    }

    /// The one call the app's `@main` entry point makes at launch.
    ///
    /// Configures Clerk (always — auth is real regardless of backend state),
    /// then, *only if* a backend URL is set, swaps every service onto the live
    /// backend and wires the API client to mint a fresh Clerk token per request.
    /// With no URL the app keeps serving on-device mock data, so it stays fully
    /// usable before the backend is deployed. Kept here, rather than in the app
    /// target, so `ClerkKit` stays an implementation detail of this package and
    /// the app target needn't depend on it directly.
    /// UserDefaults key for the QA "use on-device mock data" switch. Shared with
    /// the `@AppStorage` toggle in Settings.
    public static let testDataDefaultsKey = "useTestData"

    @MainActor
    public static func bootstrap(clerkPublishableKey: String, apiBaseURL: String) {
        Clerk.configure(publishableKey: clerkPublishableKey)

        // QA override: stay entirely on-device mock data even with a backend
        // configured. Read once at launch (services are single-writer-at-startup
        // by design), so flipping it in Settings applies on the next launch —
        // the toggle says as much. Lets the team keep testing on demo data
        // through the pre-launch window without touching prod.
        if UserDefaults.standard.bool(forKey: testDataDefaultsKey) { return }

        let trimmed = apiBaseURL.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        let api = APIClient(baseURL: trimmed)
        useLive(api: api)
        Task {
            await api.setTokenProvider {
                try? await Clerk.shared.auth.getToken()
            }
        }
    }

    /// Ends the Clerk session. Kept here so `AppRouter`/`SettingsView` can log
    /// out without importing ClerkKit — the session survived a plain
    /// `didSignOut()` before, which is why "log out" didn't actually log you out.
    @MainActor
    public static func signOut() async {
        try? await Clerk.shared.auth.signOut()
    }

    /// The identity restored from a persisted Clerk session at launch, if any.
    public struct RestoredIdentity: Sendable {
        public let userId: String
        /// Optional on purpose: nil means "we don't know it yet", which the UI
        /// renders as a placeholder. It must never be a placeholder *value*, or
        /// it can be persisted as the user's real handle.
        public let username: String?
        public let email: String?
        public let avatarURL: String?
    }

    /// Loads any persisted Clerk session at launch and, if one exists, resolves
    /// the signed-in identity (pulling the real username/avatar from the backend
    /// profile). Returns nil when there's no session — the app then shows
    /// onboarding as before. Without this, a returning user was forced back
    /// through sign-in on every launch even though Clerk still held their session.
    @MainActor
    public static func restoreSession() async -> RestoredIdentity? {
        // ClerkKit 1.3 restores the persisted session by fetching the client
        // (which carries the current session and user) — the older one-shot
        // `Clerk.load()` was split into refreshClient()/refreshEnvironment().
        try? await Clerk.shared.refreshClient()
        guard let user = Clerk.shared.user else { return nil }

        let profile = (try? await profileService.currentProfile()) ?? nil

        // Never substitute a placeholder here. This value becomes
        // `router.username`, which Settings seeds its text field from and then
        // *saves* — so a display fallback like "you" leaking in was how a real
        // account ended up renamed to "you", with the email and avatar blanked
        // alongside it. If the backend profile can't be read, fall back to what
        // Clerk itself knows and otherwise leave it nil, so the UI shows a
        // placeholder without any of it being mistaken for real data.
        return RestoredIdentity(
            userId: user.id,
            username: profile?.username ?? user.username,
            email: profile?.email ?? user.primaryEmailAddress?.emailAddress,
            avatarURL: profile?.photoURL ?? (user.hasImage ? user.imageUrl : nil)
        )
    }
}
