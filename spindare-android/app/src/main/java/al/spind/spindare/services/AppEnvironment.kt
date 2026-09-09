package al.spind.spindare.services

import android.content.Context
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import al.spind.spindare.net.ApiClient
import al.spind.spindare.net.SpindareApi

/**
 * The composition switchboard, ported from SpindareKit/Services/AppEnvironment.swift.
 *
 * Every screen reads its dependencies from here, so flipping the whole app
 * between mock and live is one call at startup rather than an edit in each
 * view. Written once at launch and read everywhere after — single-writer by
 * design, which is why plain `var`s are safe without synchronisation.
 */
object AppEnvironment {

    /** Set only while a backend is configured; null keeps the app on mock data. */
    var api: SpindareApi? = null
        private set

    var feed: FeedServing = MockFeedService()
        private set

    var profile: ProfileServing = MockProfileService()
        private set

    var social: SocialServing = MockSocialService()
        private set

    var notification: NotificationServing = MockNotificationService()
        private set

    var search: SearchServing = MockSearchService()
        private set

    var chat: ChatServing = MockChatService()
        private set

    var speedy: SpeedyServing = MockSpeedyService()
        private set

    var zone: ZoneServing = MockZoneService()
        private set

    var mediaUploader: MediaUploader? = null
        private set

    /** True once [bootstrap] has pointed the services at a real backend. */
    val isLive: Boolean get() = api != null

    /**
     * @param apiBaseUrl empty keeps the app on on-device mock data while auth
     *   stays real Clerk — the same escape hatch the iOS build has, and what
     *   makes the app demoable with no network.
     */
    fun bootstrap(context: Context, clerkPublishableKey: String, apiBaseUrl: String, debug: Boolean) {
        Clerk.initialize(context, publishableKey = clerkPublishableKey)

        val trimmed = apiBaseUrl.trim()
        if (trimmed.isEmpty()) return

        val client = ApiClient.create(
            baseUrl = trimmed,
            debug = debug,
            // Per-request, so an expired token is re-fetched rather than
            // 401-ing every call until the app restarts.
            tokenProvider = { (Clerk.auth.getToken() as? ClerkResult.Success)?.value },
        )
        api = client
        useLive(client)
    }

    private fun useLive(api: SpindareApi) {
        feed = LiveFeedService(api)
        profile = LiveProfileService(api)
        social = LiveSocialService(api)
        notification = LiveNotificationService(api)
        search = LiveSearchService(api)
        chat = LiveChatService(api)
        speedy = LiveSpeedyService()
        zone = LiveZoneService()
        mediaUploader = MediaUploader(api)
    }

    /** Resets all mock data to its initial seed state. No-op in live mode. */
    fun resetMocks() {
        if (isLive) return
        feed = MockFeedService()
        profile = MockProfileService()
        social = MockSocialService()
        notification = MockNotificationService()
        search = MockSearchService()
        chat = MockChatService()
        speedy = MockSpeedyService()
        zone = MockZoneService()
    }

    /** Ends the Clerk session. Kept here so UI never imports the Clerk SDK directly. */
    suspend fun signOut() {
        Clerk.auth.signOut()
    }

    /**
     * The identity restored from a persisted Clerk session at launch, if any.
     *
     * [username] is nullable on purpose: null means "we don't know it yet",
     * which the UI renders as a placeholder. It must never be a placeholder
     * *value* — on iOS a literal `"you"` fallback leaked all the way into the
     * database as people's real handle. Same trap exists here.
     */
    data class RestoredIdentity(
        val userId: String,
        val username: String?,
        val email: String?,
        val avatarUrl: String?,
    )

    // `hasImage` is marked deprecated in clerk-android 1.0.36 with a message
    // pointing at `hasUploadedImage` — a property that does not exist in this
    // version. Using the deprecated one is the only option until Clerk actually
    // ships the replacement; revisit on the next SDK bump.
    @Suppress("DEPRECATION")
    fun currentIdentity(): RestoredIdentity? {
        val user = Clerk.user ?: return null
        return RestoredIdentity(
            userId = user.id,
            username = user.username,
            email = user.primaryEmailAddress?.emailAddress,
            // imageUrl is non-null and always populated — Clerk serves a
            // generated avatar when none was uploaded — so `hasImage` is what
            // distinguishes a real picture from a placeholder.
            avatarUrl = user.imageUrl.takeIf { it.isNotEmpty() && user.hasImage },
        )
    }
}
