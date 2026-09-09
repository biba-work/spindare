package al.spind.spindare.services

import al.spind.spindare.model.*
import al.spind.spindare.net.*
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

interface FeedServing {
    suspend fun feed(): List<Post>
    suspend fun userPosts(userId: String): List<Post>
    suspend fun react(postId: String, type: String)
    suspend fun comments(postId: String): List<Comment>
    suspend fun addComment(postId: String, text: String): Comment
}

interface ProfileServing {
    suspend fun profile(id: String): Profile?
    suspend fun currentProfile(): Profile?
    suspend fun createProfile(username: String, email: String?, hobbies: List<String>, studyFields: List<String>): Profile
    suspend fun updateUsername(username: String)
    suspend fun updatePhoto(url: String)
    suspend fun deleteAccount()
    suspend fun updatePrivacy(privacy: String)
}

interface NotificationServing {
    suspend fun notifications(): List<AppNotification>
    suspend fun unreadCount(): Int
    suspend fun markAllRead()
}

interface SocialServing {
    suspend fun friends(): List<Friend>
    suspend fun pendingRequests(): List<ConnectionRequest>
    suspend fun acceptRequest(fromUserId: String)
    suspend fun declineRequest(fromUserId: String)
    suspend fun savedChallenges(): List<SavedChallenge>
    suspend fun saveChallenge(challenge: String)
    suspend fun spindInbox(): List<SpindChallenge>
    suspend fun acceptSpind(id: String)
    suspend fun declineSpind(id: String)
    suspend fun sendSpind(toUserId: String, challenge: String)
    suspend fun blockedUsers(): List<Friend>
    suspend fun block(userId: String)
    suspend fun unblock(userId: String)
}

interface SpeedyServing {
    suspend fun speedys(): List<Speedy>
    suspend fun setReaction(type: ReactionType, previous: ReactionType?, speedyId: String)
    suspend fun toggleFavourite(speedyId: String): Boolean
    suspend fun favourites(): Set<String>
}

interface ZoneServing {
    suspend fun venues(): List<Venue>
    suspend fun venuePosts(): List<VenuePost>
}

interface SearchServing {
    suspend fun users(matching: String): List<SearchUser>
    suspend fun challenges(matching: String): List<Post>
}

interface ChatServing {
    suspend fun messages(conversation: ConversationRef): List<Message>
    suspend fun send(text: String, conversation: ConversationRef, payload: MessagePayload, emphasis: Float?): Message
    suspend fun deleteMessage(id: String, conversationId: String)
    suspend fun conversations(): List<Conversation>
    suspend fun archivedConversations(): List<Conversation>
    suspend fun deleteConversation(id: String)
    suspend fun setMuted(muted: Boolean, conversationId: String)
    suspend fun archiveConversation(id: String)
    suspend fun unarchiveConversation(id: String)
}

class LiveFeedService(private val api: SpindareApi) : FeedServing {
    override suspend fun feed(): List<Post> = api.feed()
    override suspend fun userPosts(userId: String): List<Post> = api.userPosts(userId)
    override suspend fun react(postId: String, type: String) =
        api.react(postId, ReactionBody(type))
    override suspend fun comments(postId: String): List<Comment> = api.comments(postId)
    override suspend fun addComment(postId: String, text: String): Comment {
        val identity = AppEnvironment.currentIdentity()
        return api.addComment(
            postId,
            CommentBody(
                text = text,
                username = identity?.username ?: "unknown",
                avatar = identity?.avatarUrl ?: ""
            )
        )
    }
}

class LiveProfileService(private val api: SpindareApi) : ProfileServing {
    override suspend fun profile(id: String): Profile? = api.profile(id)
    override suspend fun currentProfile(): Profile? = api.profileOwn()
    override suspend fun createProfile(
        username: String,
        email: String?,
        hobbies: List<String>,
        studyFields: List<String>
    ): Profile = api.createProfile(CreateProfileBody(username, email, hobbies, studyFields))

    override suspend fun updateUsername(username: String) {
        api.updateUsername(UsernameBody(username))
    }

    override suspend fun updatePhoto(url: String) {
        api.updatePicture(PictureBody(url))
    }

    override suspend fun deleteAccount() {
        api.deleteAccount()
    }

    override suspend fun updatePrivacy(privacy: String) {
        api.updatePrivacy(PrivacyBody(privacy))
    }
}

class LiveNotificationService(private val api: SpindareApi) : NotificationServing {
    override suspend fun notifications(): List<AppNotification> = api.notifications()
    override suspend fun unreadCount(): Int = api.unreadCount()
    override suspend fun markAllRead() {
        api.markAllNotificationsRead()
    }
}

class LiveSocialService(private val api: SpindareApi) : SocialServing {
    override suspend fun friends(): List<Friend> = api.friends()
    override suspend fun pendingRequests(): List<ConnectionRequest> = api.pendingRequests()
    override suspend fun acceptRequest(fromUserId: String) {
        val identity = AppEnvironment.currentIdentity()
        api.acceptRequest(
            fromUserId,
            FollowBody(identity?.username ?: "unknown", identity?.avatarUrl)
        )
    }

    override suspend fun declineRequest(fromUserId: String) {
        api.declineRequest(fromUserId)
    }

    override suspend fun savedChallenges(): List<SavedChallenge> = api.listSavedChallenges()
    override suspend fun saveChallenge(challenge: String) {
        api.saveChallenge(KeptChallengeBody(challenge = challenge))
    }

    override suspend fun spindInbox(): List<SpindChallenge> = api.spindInbox()
    override suspend fun acceptSpind(id: String) {
        api.acceptSpind(id)
    }

    override suspend fun declineSpind(id: String) {
        api.declineSpind(id)
    }

    override suspend fun sendSpind(toUserId: String, challenge: String) {
        api.sendSpind(SpindSendBody(toUserId, challenge))
    }

    override suspend fun blockedUsers(): List<Friend> = api.blockedUsers()
    override suspend fun block(userId: String) {
        api.block(userId)
    }

    override suspend fun unblock(userId: String) {
        api.unblock(userId)
    }
}

class LiveSearchService(private val api: SpindareApi) : SearchServing {
    override suspend fun users(matching: String): List<SearchUser> = api.searchUsers(matching)
    override suspend fun challenges(matching: String): List<Post> = api.searchChallenges(matching)
}

class LiveSpeedyService : SpeedyServing {
    override suspend fun speedys(): List<Speedy> = emptyList()
    override suspend fun setReaction(type: ReactionType, previous: ReactionType?, speedyId: String) {}
    override suspend fun toggleFavourite(speedyId: String): Boolean = false
    override suspend fun favourites(): Set<String> = emptySet()
}

class LiveZoneService : ZoneServing {
    override suspend fun venues(): List<Venue> = emptyList()
    override suspend fun venuePosts(): List<VenuePost> = emptyList()
}

class LiveChatService(private val api: SpindareApi) : ChatServing {
    override suspend fun messages(conversation: ConversationRef): List<Message> = emptyList()
    override suspend fun send(text: String, conversation: ConversationRef, payload: MessagePayload, emphasis: Float?): Message {
        throw NotImplementedError("Chat messaging not yet implemented in backend")
    }
    override suspend fun deleteMessage(id: String, conversationId: String) {}
    override suspend fun conversations(): List<Conversation> = emptyList()
    override suspend fun archivedConversations(): List<Conversation> = emptyList()
    override suspend fun deleteConversation(id: String) {}
    override suspend fun setMuted(muted: Boolean, conversationId: String) {}
    override suspend fun archiveConversation(id: String) {}
    override suspend fun unarchiveConversation(id: String) {}
}

class MockFeedService : FeedServing {
    private var posts = MockSeed.posts.toMutableList()
    private val commentsByPost = mutableMapOf<String, MutableList<Comment>>()

    override suspend fun feed(): List<Post> = posts.toList()

    override suspend fun userPosts(userId: String): List<Post> =
        posts.filter { it.userId == userId }

    override suspend fun react(postId: String, type: String) {
        val index = posts.indexOfFirst { it.id == postId }
        if (index < 0) return
        val current = posts[index].reactions
        posts[index] = posts[index].copy(
            reactions = when (type) {
                "felt" -> current.copy(felt = current.felt + 1)
                "thought" -> current.copy(thought = current.thought + 1)
                "intrigued" -> current.copy(intrigued = current.intrigued + 1)
                else -> current
            },
        )
    }

    override suspend fun comments(postId: String): List<Comment> =
        commentsByPost[postId].orEmpty()

    override suspend fun addComment(postId: String, text: String): Comment {
        val comment = Comment(
            id = "c_${System.nanoTime()}",
            postId = postId,
            userId = MockSeed.SELF_ID,
            author = "you",
            text = text,
            createdAt = Instant.now(),
        )
        commentsByPost.getOrPut(postId) { mutableListOf() }.add(comment)
        return comment
    }
}

class MockProfileService : ProfileServing {
    override suspend fun profile(id: String): Profile? = MockSeed.profile
    override suspend fun currentProfile(): Profile? = MockSeed.profile
    override suspend fun createProfile(
        username: String,
        email: String?,
        hobbies: List<String>,
        studyFields: List<String>
    ): Profile = MockSeed.profile.copy(username = username, email = email, hobbies = hobbies, studyFields = studyFields)

    override suspend fun updateUsername(username: String) {}
    override suspend fun updatePhoto(url: String) {}
    override suspend fun deleteAccount() {}
    override suspend fun updatePrivacy(privacy: String) {}
}

class MockNotificationService : NotificationServing {
    override suspend fun notifications(): List<AppNotification> = MockSeed.notifications
    override suspend fun unreadCount(): Int = MockSeed.notifications.count { !it.read }
    override suspend fun markAllRead() {}
}

class MockSocialService : SocialServing {
    override suspend fun friends(): List<Friend> = MockSeed.friends
    override suspend fun pendingRequests(): List<ConnectionRequest> = MockSeed.requests
    override suspend fun acceptRequest(fromUserId: String) {}
    override suspend fun declineRequest(fromUserId: String) {}
    override suspend fun savedChallenges(): List<SavedChallenge> = MockSeed.saved
    override suspend fun saveChallenge(challenge: String) {}
    override suspend fun spindInbox(): List<SpindChallenge> = MockSeed.spind
    override suspend fun acceptSpind(id: String) {}
    override suspend fun declineSpind(id: String) {}
    override suspend fun sendSpind(toUserId: String, challenge: String) {}
    override suspend fun blockedUsers(): List<Friend> = emptyList()
    override suspend fun block(userId: String) {}
    override suspend fun unblock(userId: String) {}
}

class MockSpeedyService : SpeedyServing {
    override suspend fun speedys(): List<Speedy> = MockSeed.speedys
    override suspend fun setReaction(type: ReactionType, previous: ReactionType?, speedyId: String) {}
    override suspend fun toggleFavourite(speedyId: String): Boolean = false
    override suspend fun favourites(): Set<String> = emptySet()
}

class MockZoneService : ZoneServing {
    override suspend fun venues(): List<Venue> = MockSeed.venues
    override suspend fun venuePosts(): List<VenuePost> = MockSeed.venuePosts
}

class MockSearchService : SearchServing {
    override suspend fun users(matching: String): List<SearchUser> =
        MockSeed.friends.filter { it.username.contains(matching, ignoreCase = true) }
            .map { SearchUser(id = it.id, username = it.username, photoURL = it.photoURL) }

    override suspend fun challenges(matching: String): List<Post> =
        MockSeed.posts.filter { it.challenge.contains(matching, ignoreCase = true) }
}

class MockChatService : ChatServing {
    private val messages = mutableMapOf<String, MutableList<Message>>()

    override suspend fun messages(conversation: ConversationRef): List<Message> =
        messages[conversation.id].orEmpty()

    override suspend fun send(text: String, conversation: ConversationRef, payload: MessagePayload, emphasis: Float?): Message {
        val msg = Message(
            id = UUID.randomUUID().toString(),
            conversationId = conversation.id,
            senderId = MockSeed.SELF_ID,
            text = text,
            sentAt = Instant.now(),
            payload = payload,
            emphasis = emphasis
        )
        messages.getOrPut(conversation.id) { mutableListOf() }.add(msg)
        return msg
    }

    override suspend fun deleteMessage(id: String, conversationId: String) {
        messages[conversationId]?.removeAll { it.id == id }
    }

    override suspend fun conversations(): List<Conversation> = MockSeed.conversations
    override suspend fun archivedConversations(): List<Conversation> = emptyList()
    override suspend fun deleteConversation(id: String) {}
    override suspend fun setMuted(muted: Boolean, conversationId: String) {}
    override suspend fun archiveConversation(id: String) {}
    override suspend fun unarchiveConversation(id: String) {}
}

object MockSeed {
    const val SELF_ID = "user_mock_self"

    val profile = Profile(
        id = SELF_ID,
        username = "you",
        hobbies = listOf("photography", "running", "coding"),
        studyFields = listOf("Design", "CS"),
        xp = 340,
        level = 4,
        streak = 4
    )

    private fun ago(minutes: Long): Instant = Instant.now().minus(minutes, ChronoUnit.MINUTES)

    val friends: List<Friend> = listOf(
        Friend(id = "user_mock_ada", name = "Ada", username = "ada", photoURL = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200"),
        Friend(id = "user_mock_ren", name = "Ren", username = "ren", photoURL = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200"),
        Friend(id = "user_mock_kai", name = "Kai", username = "kai", photoURL = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200"),
    )

    val requests: List<ConnectionRequest> = listOf(
        ConnectionRequest(id = "req1", username = "sola", photoURL = "https://api.dicebear.com/7.x/avataaars/svg?seed=sola"),
    )

    val notifications: List<AppNotification> = listOf(
        AppNotification(id = "n1", type = NotificationType.REACTION, content = "reacted to your post", createdAt = ago(5)),
        AppNotification(id = "n2", type = NotificationType.FOLLOW, content = "started following you", createdAt = ago(60)),
        AppNotification(id = "n3", type = NotificationType.COMMENT, content = "commented on your post", createdAt = ago(120)),
    )

    val saved: List<SavedChallenge> = listOf(
        SavedChallenge(challenge = "Eat something you've never tried before.", expiresAt = ago(-2880)),
        SavedChallenge(challenge = "Read 10 pages of a book.", expiresAt = ago(-1440)),
    )

    val spind: List<SpindChallenge> = listOf(
        SpindChallenge(id = "s1", challenge = "Record a 5-second silence.", fromUserId = "user_mock_ada", fromUsername = "ada", sentAt = ago(10)),
    )

    val speedys: List<Speedy> = listOf(
        Speedy(id = "sp1", userId = "user_mock_ada", author = "ada", challenge = "Fastest coffee run.", detail = "Got it in 3 mins!", createdAt = ago(120), videoURL = "https://pub-f4c02930438647579624833630f983a0.r2.dev/spindare-assets/speedy1.mp4"),
        Speedy(id = "sp2", userId = "user_mock_ren", author = "ren", challenge = "10 pushups.", detail = "Done!", createdAt = ago(240), videoURL = "https://pub-f4c02930438647579624833630f983a0.r2.dev/spindare-assets/speedy2.mp4"),
    )

    val venues: List<Venue> = listOf(
        Venue(id = "v1", name = "Central Park", category = VenueCategory.PARK, latitude = 40.785091, longitude = -73.968285, blurb = "The lung of NYC.", sponsoredChallenge = "Take a photo of silence"),
        Venue(id = "v2", name = "Starbucks Times Square", category = VenueCategory.CAFE, latitude = 40.758896, longitude = -73.985130, blurb = "Quick caffeine hit.", sponsoredChallenge = "Buy a stranger a coffee"),
        Venue(id = "v3", name = "Equinox Gym", category = VenueCategory.GYM, latitude = 40.753345, longitude = -73.978564, blurb = "Push your limits.", sponsoredChallenge = "Do 50 pushups"),
        Venue(id = "v4", name = "Apple Store Fifth Ave", category = VenueCategory.SHOP, latitude = 40.763844, longitude = -73.972965, blurb = "Tech heaven.", sponsoredChallenge = "Record a 10s video of light"),
    )

    val venuePosts: List<VenuePost> = listOf(
        VenuePost(id = "vp1", venueId = "v1", userId = "user_mock_ren", author = "ren", createdAt = ago(300)),
    )

    val conversations: List<Conversation> = listOf(
        Conversation(id = "c1", otherUserId = "user_mock_ada", otherUsername = "ada", lastMessage = "Hey! Ready to spin?", lastMessageAt = ago(2)),
        Conversation(id = "c2", otherUserId = "user_mock_ren", otherUsername = "ren", lastMessage = "That photo was amazing.", lastMessageAt = ago(45)),
        Conversation(id = "c3", otherUserId = "user_mock_kai", otherUsername = "kai", lastMessage = "Sent you a challenge!", lastMessageAt = ago(120)),
    )

    fun seedMessages(conversationId: String): List<Message> = listOf(
        Message(
            id = "m1",
            conversationId = conversationId,
            senderId = "user_mock_ada",
            text = "Hey! Ready to spin?",
            sentAt = ago(5),
            payload = MessagePayload.Text
        ),
        Message(
            id = "m2",
            conversationId = conversationId,
            senderId = SELF_ID,
            text = "Always.",
            sentAt = ago(2),
            payload = MessagePayload.Text
        )
    )

    val posts: List<Post> = listOf(
        Post(
            id = "p1",
            userId = "user_mock_ada",
            author = "dan.exe",
            challenge = "No mirror day",
            content = "Went the whole day without checking how I looked. By lunchtime I stopped caring. By evening I felt weirdly free.",
            media = "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900",
            spinCount = 3300,
            reactions = Reactions(felt = 800, thought = 300, intrigued = 500),
            createdAt = ago(600),
        ),
        Post(
            id = "p2",
            userId = "user_mock_ren",
            author = "b.ramos",
            challenge = "Write a letter you'll never send",
            content = "Wrote three pages. Tore them up. Then wrote three more. Writing is different when you know no one will read it.",
            media = "https://images.unsplash.com/photo-1516541196182-6bdb0516ed27?w=900",
            spinCount = 1600,
            reactions = Reactions(felt = 210, thought = 140, intrigued = 20),
            createdAt = ago(1440),
        ),
        Post(
            id = "p3",
            userId = "user_mock_kai",
            author = "apple_user",
            challenge = "Tell someone what they mean to you",
            content = "Called my high school teacher. She remembered me.",
            media = null,
            spinCount = 2100,
            reactions = Reactions(felt = 400, thought = 100, intrigued = 900),
            createdAt = ago(420),
        ),
    )
}
