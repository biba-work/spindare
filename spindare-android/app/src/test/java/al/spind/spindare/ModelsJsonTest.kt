package al.spind.spindare

import al.spind.spindare.model.AppNotification
import al.spind.spindare.model.Comment
import al.spind.spindare.model.ConnectionRequest
import al.spind.spindare.model.Conversation
import al.spind.spindare.model.Friend
import al.spind.spindare.model.Message
import al.spind.spindare.model.MessagePayload
import al.spind.spindare.model.Post
import al.spind.spindare.model.Profile
import al.spind.spindare.model.SavedChallenge
import al.spind.spindare.model.SearchUser
import al.spind.spindare.model.Speedy
import al.spind.spindare.model.SpindChallenge
import al.spind.spindare.model.Venue
import al.spind.spindare.model.VenuePost
import al.spind.spindare.net.ChatTokenResponse
import al.spind.spindare.net.PresignResponse
import al.spind.spindare.net.SpindareJson
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * Contract tests against the JSON the deployed Nest API actually emits.
 */
class ModelsJsonTest {

    @Test
    fun `post decodes from a full server row`() {
        val json = """
            {
              "id": "abc123",
              "userId": "user_3BB4L8lv1zpSWxD120VmeDlDxET",
              "author": "ada",
              "avatar": "https://pub-x.r2.dev/avatars/1.jpg",
              "challenge": "Photograph something that reminds you of silence.",
              "content": "Found it on the walk home.",
              "media": "https://pub-x.r2.dev/posts/1.jpg",
              "spinCount": 12,
              "reactions": { "felt": 8, "thought": 3, "intrigued": 5 },
              "createdAt": "2026-07-20T10:15:30Z"
            }
        """.trimIndent()

        val post = SpindareJson.decodeFromString<Post>(json)

        assertEquals("abc123", post.id)
        assertEquals("ada", post.author)
        assertEquals(16, post.reactions.total)
        assertFalse(post.isVideo)
    }

    @Test
    fun `post survives missing optional fields`() {
        val post = SpindareJson.decodeFromString<Post>(
            """{"id":"p2","userId":"u2","challenge":"Write one thing."}""",
        )
        assertEquals("unknown", post.author)
        assertEquals(0, post.reactions.total)
    }

    @Test
    fun `video posts are detected from the media extension`() {
        val post = SpindareJson.decodeFromString<Post>(
            """{"id":"p3","userId":"u3","challenge":"c","media":"https://pub-x.r2.dev/v/clip.mp4"}""",
        )
        assertTrue(post.isVideo)
    }

    @Test
    fun `profile ignores unmodelled fields such as pushToken`() {
        val json = """
            {
              "id": "user_abc",
              "username": "ada",
              "email": "ada@example.com",
              "photoURL": null,
              "hobbies": ["running"],
              "studyFields": [],
              "xp": 340,
              "level": 4,
              "pushToken": "ExponentPushToken[xxx]",
              "createdAt": "2026-07-01T09:00:00Z"
            }
        """.trimIndent()

        val profile = SpindareJson.decodeFromString<Profile>(json)
        assertEquals("ada", profile.username)
        assertEquals(listOf("running"), profile.hobbies)
    }

    @Test
    fun `profile tolerates a malformed hobbies column`() {
        val profile = SpindareJson.decodeFromString<Profile>(
            """{"id":"u","username":"ada","hobbies":{"oops":true}}""",
        )
        assertEquals(emptyList<String>(), profile.hobbies)
    }

    @Test
    fun `notification flattens the joined sender`() {
        val json = """
            {
              "id": "n1",
              "type": "reaction",
              "fromUserId": "user_b",
              "content": "reacted to your post",
              "read": false,
              "fromUser": { "username": "ren", "photoURL": "https://x/y.jpg" }
            }
        """.trimIndent()

        val notification = SpindareJson.decodeFromString<AppNotification>(json)
        assertEquals("ren", notification.fromUsername)
    }

    @Test
    fun `search user prefers uid over id`() {
        val user = SpindareJson.decodeFromString<SearchUser>(
            """{"uid":"user_real","id":"row_pk","username":"kai"}""",
        )
        assertEquals("user_real", user.resolvedId)
    }

    @Test
    fun `friend decodes correctly`() {
        val json = """{"id":"u1","name":"Ada","username":"ada","photoURL":"https://x/y.jpg"}"""
        val friend = SpindareJson.decodeFromString<Friend>(json)
        assertEquals("u1", friend.id)
    }

    @Test
    fun `connection request decodes correctly`() {
        val json = """{"id":"r1","username":"kai","photoURL":null}"""
        val request = SpindareJson.decodeFromString<ConnectionRequest>(json)
        assertEquals("r1", request.id)
    }

    @Test
    fun `spind challenge inbox decodes correctly`() {
        val json = """
            {
              "id": "s1",
              "challenge": "Dance!",
              "fromUserId": "u1",
              "fromUsername": "ada",
              "fromAvatar": null,
              "sentAt": "2026-07-20T10:00:00Z",
              "expiresAt": "2026-07-22T10:00:00Z",
              "accepted": false
            }
        """.trimIndent()
        val challenge = SpindareJson.decodeFromString<SpindChallenge>(json)
        assertEquals("s1", challenge.id)
        assertFalse(challenge.accepted)
    }

    @Test
    fun `speedy decodes correctly`() {
        val json = """
            {
              "id": "sp1",
              "userId": "u1",
              "author": "ada",
              "challenge": "Dance",
              "detail": "Fun!",
              "videoURL": "https://x/v.mp4",
              "reactions": { "felt": 10, "thought": 5, "intrigued": 2 }
            }
        """.trimIndent()
        val speedy = SpindareJson.decodeFromString<Speedy>(json)
        assertEquals("sp1", speedy.id)
        assertEquals(10, speedy.reactions.felt)
    }

    @Test
    fun `venue decodes correctly`() {
        val json = """
            {
              "id": "v1",
              "name": "Park",
              "category": "park",
              "latitude": 41.3,
              "longitude": 19.8,
              "blurb": "Green"
            }
        """.trimIndent()
        val venue = SpindareJson.decodeFromString<Venue>(json)
        assertEquals("v1", venue.id)
        assertEquals(al.spind.spindare.model.VenueCategory.PARK, venue.category)
    }

    @Test
    fun `chat token response decodes correctly`() {
        val json = """{"token":"jwt_token"}"""
        val response = SpindareJson.decodeFromString<ChatTokenResponse>(json)
        assertEquals("jwt_token", response.token)
    }

    @Test
    fun `presign response decodes correctly`() {
        val json = """{"uploadUrl":"https://r2/put","publicUrl":"https://pub/get"}"""
        val response = SpindareJson.decodeFromString<PresignResponse>(json)
        assertEquals("https://r2/put", response.uploadUrl)
    }

    @Test
    fun `text payload decodes from the empty-object form`() {
        assertEquals(
            MessagePayload.Text,
            SpindareJson.decodeFromString<MessagePayload>("""{"text":{}}"""),
        )
    }

    @Test
    fun `image payload decodes from the nested url form`() {
        val payload = SpindareJson.decodeFromString<MessagePayload>(
            """{"image":{"url":"https://pub-x.r2.dev/chat/1.jpg"}}""",
        )
        assertEquals(MessagePayload.Image("https://pub-x.r2.dev/chat/1.jpg"), payload)
    }

    @Test
    fun `voice payload keeps its duration and waveform samples`() {
        val payload = SpindareJson.decodeFromString<MessagePayload>(
            """{"voice":{"url":"https://pub-x.r2.dev/chat/1.m4a","duration":3.5,"samples":[0.1,0.9]}}""",
        )
        val voice = payload as MessagePayload.Voice
        assertEquals(3.5, voice.duration, 0.001)
        assertEquals(listOf(0.1f, 0.9f), voice.samples)
    }

    @Test
    fun `payloads round-trip back to the shape the server expects`() {
        val voice = MessagePayload.Voice("https://x/1.m4a", 2.0, listOf(0.5f))
        val encoded = SpindareJson.encodeToString<MessagePayload>(voice)
        assertTrue(encoded.contains("\"voice\""))
        assertEquals(voice, SpindareJson.decodeFromString<MessagePayload>(encoded))
    }

    @Test
    fun `an unsent message degrades to a text bubble`() {
        assertEquals(
            MessagePayload.Text,
            SpindareJson.decodeFromString<MessagePayload>("""{"image":{}}"""),
        )
    }
}
