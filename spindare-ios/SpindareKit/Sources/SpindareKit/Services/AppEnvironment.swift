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
/// Deliberately no `chatService` / `speedyService` / `zoneService` slot: chat
/// has no live backend yet (`LiveChatService` throws), and Speedys/Zone have no
/// `Live` implementation at all. Those stay on their own `Mock*Service()`
/// defaults untouched.
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
    @MainActor
    public static func bootstrap(clerkPublishableKey: String, apiBaseURL: String) {
        Clerk.configure(publishableKey: clerkPublishableKey)

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
}
