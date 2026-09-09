package al.spind.spindare.net

import al.spind.spindare.model.*
import kotlinx.serialization.Serializable
import retrofit2.http.*

@Serializable
data class HealthResponse(
    val status: String? = null,
    val configured: HealthConfigured? = null,
)

@Serializable
data class HealthConfigured(
    val database: Boolean = false,
    val clerk: Boolean = false,
    val storage: Boolean = false,
    val storagePublicUrl: Boolean = false,
)

@Serializable
data class ReactionBody(val type: String)

@Serializable
data class CommentBody(val text: String, val username: String, val avatar: String)

@Serializable
data class UsernameBody(val username: String)

@Serializable
data class PictureBody(val photoURL: String)

@Serializable
data class ProgressBody(val xp: Int, val level: Int)

@Serializable
data class SpinnerBody(val spinsLeft: Int, val lastSpinTimestamp: Long)

@Serializable
data class PushTokenBody(val pushToken: String)

@Serializable
data class PrivacyBody(val privacy: String)

@Serializable
data class FollowBody(val username: String, val avatar: String?)

@Serializable
data class FollowStatusResponse(val following: Boolean, val requested: Boolean)

@Serializable
data class FollowStatsResponse(val followers: Int, val following: Int)

@Serializable
data class GhostStatusResponse(val ghosted: Boolean, val ghostedBy: Boolean)

@Serializable
data class KeptChallengeBody(val postId: String? = null, val challenge: String)

@Serializable
data class SpindRecordBody(val postId: String, val challenge: String)

@Serializable
data class SpindSendBody(val toUserId: String, val challenge: String)

@Serializable
data class ChatTokenResponse(val token: String)

@Serializable
data class CreateProfileBody(
    val username: String,
    val email: String? = null,
    val hobbies: List<String> = emptyList(),
    val studyFields: List<String> = emptyList()
)

@Serializable
data class PresignResponse(val uploadUrl: String, val publicUrl: String)

@Serializable
data class PresignBody(val contentType: String, val folder: String, val filename: String)

interface SpindareApi {

    // MARK: Health

    @GET("health")
    suspend fun health(): HealthResponse

    // MARK: Feed

    @GET("posts")
    suspend fun feed(): List<Post>

    @GET("posts/count")
    suspend fun postCount(): Int

    @GET("posts/user/{userId}")
    suspend fun userPosts(@Path("userId") userId: String): List<Post>

    @POST("posts")
    suspend fun createPost(@Body body: Post): Post

    @GET("posts/{postId}/reaction")
    suspend fun getMyReaction(@Path("postId") postId: String): String?

    @POST("posts/{postId}/reaction")
    suspend fun react(@Path("postId") postId: String, @Body body: ReactionBody)

    @GET("posts/{postId}/comments")
    suspend fun comments(@Path("postId") postId: String): List<Comment>

    @POST("posts/{postId}/comments")
    suspend fun addComment(@Path("postId") postId: String, @Body body: CommentBody): Comment

    // MARK: Profile

    @GET("profiles/{id}")
    suspend fun profile(@Path("id") id: String): Profile

    @GET("profiles")
    suspend fun profileOwn(): Profile

    @POST("profiles")
    suspend fun createProfile(@Body body: CreateProfileBody): Profile

    @PATCH("profiles/username")
    suspend fun updateUsername(@Body body: UsernameBody): Profile

    @PATCH("profiles/picture")
    suspend fun updatePicture(@Body body: PictureBody): Profile

    @PATCH("profiles/progress")
    suspend fun updateProgress(@Body body: ProgressBody): Profile

    @PATCH("profiles/spinner")
    suspend fun updateSpinner(@Body body: SpinnerBody): Profile

    @PATCH("profiles/push-token")
    suspend fun registerPushToken(@Body body: PushTokenBody)

    @PATCH("profiles/privacy")
    suspend fun updatePrivacy(@Body body: PrivacyBody): Profile

    @DELETE("profiles")
    suspend fun deleteAccount()

    // MARK: Social

    @POST("social/follow/{targetId}")
    suspend fun follow(@Path("targetId") targetId: String, @Body body: FollowBody)

    @DELETE("social/follow/{targetId}")
    suspend fun unfollow(@Path("targetId") targetId: String)

    @GET("social/follow/{targetId}/status")
    suspend fun followStatus(@Path("targetId") targetId: String): FollowStatusResponse

    @GET("social/follow-stats/{userId}")
    suspend fun followStats(@Path("userId") userId: String): FollowStatsResponse

    @GET("social/friends")
    suspend fun friends(): List<Friend>

    @GET("social/requests")
    suspend fun pendingRequests(): List<ConnectionRequest>

    @POST("social/requests/{requesterId}/accept")
    suspend fun acceptRequest(@Path("requesterId") requesterId: String, @Body body: FollowBody)

    @POST("social/requests/{requesterId}/decline")
    suspend fun declineRequest(@Path("requesterId") requesterId: String)

    @POST("social/ghost/{targetId}")
    suspend fun block(@Path("targetId") targetId: String)

    @DELETE("social/ghost/{targetId}")
    suspend fun unblock(@Path("targetId") targetId: String)

    @GET("social/ghosted")
    suspend fun blockedUsers(): List<Friend>

    @GET("social/ghosted/{targetId}/status")
    suspend fun ghostStatus(@Path("targetId") targetId: String): GhostStatusResponse

    // MARK: Notifications

    @GET("notifications")
    suspend fun notifications(): List<AppNotification>

    @GET("unread-count")
    suspend fun unreadCount(): Int

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String)

    @PATCH("notifications/read-all")
    suspend fun markAllNotificationsRead()

    // MARK: Challenges

    @GET("challenges/kept")
    suspend fun listKept(): List<Post>

    @GET("challenges/kept/saved")
    suspend fun listSavedChallenges(): List<SavedChallenge>

    @POST("challenges/kept/toggle")
    suspend fun toggleKeptChallenge(@Body body: KeptChallengeBody): Boolean

    @POST("challenges/kept/save")
    suspend fun saveChallenge(@Body body: KeptChallengeBody)

    @GET("challenges/spind")
    suspend fun listSpind(): List<Post>

    @POST("challenges/spind")
    suspend fun recordSpind(@Body body: SpindRecordBody)

    @GET("challenges/spind/inbox")
    suspend fun spindInbox(): List<SpindChallenge>

    @POST("challenges/spind/send")
    suspend fun sendSpind(@Body body: SpindSendBody): SpindChallenge

    @POST("challenges/spind/{id}/accept")
    suspend fun acceptSpind(@Path("id") id: String)

    @POST("challenges/spind/{id}/decline")
    suspend fun declineSpind(@Path("id") id: String)

    // MARK: Search

    @GET("search/users")
    suspend fun searchUsers(@Query("q") query: String): List<SearchUser>

    @GET("search/challenges")
    suspend fun searchChallenges(@Query("q") query: String): List<Post>

    // MARK: Chat

    @POST("chat/token")
    suspend fun getChatToken(): ChatTokenResponse

    // MARK: Storage

    @POST("storage/presign")
    suspend fun presign(@Body body: PresignBody): PresignResponse
}
