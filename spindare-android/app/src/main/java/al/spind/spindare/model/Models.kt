package al.spind.spindare.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import java.time.Instant

// Ported from SpindareKit/Models/Models.swift, which in turn mirrors
// server/prisma/schema.prisma. Column names there are @map'd to the original
// camelCase Supabase casing and the API returns them verbatim, so these decode
// without any naming strategy — the JSON really is camelCase.
//
// The Swift originals decode defensively (missing counters become zero, a
// malformed array becomes empty) because several columns are untyped JSON blobs
// with no shape constraint in Postgres. That leniency is reproduced here rather
// than simplified away: a single odd row should degrade one field, not blow up
// the whole feed.

// MARK: - Serializers

/** ISO-8601 timestamps as the Nest API emits them. */
object InstantSerializer : KSerializer<Instant> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("Instant", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: Instant) =
        encoder.encodeString(value.toString())

    override fun deserialize(decoder: Decoder): Instant =
        Instant.parse(decoder.decodeString())
}

/**
 * `hobbies` and `studyFields` are untyped JSON columns. If a row ever holds a
 * non-array, decode to empty rather than failing the whole profile — the same
 * `(try? ...) ?? []` the Swift initialiser uses.
 */
object LenientStringListSerializer : KSerializer<List<String>> {
    private val delegate = ListSerializer(String.serializer())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun serialize(encoder: Encoder, value: List<String>) =
        delegate.serialize(encoder, value)

    override fun deserialize(decoder: Decoder): List<String> {
        val input = decoder as? JsonDecoder ?: return delegate.deserialize(decoder)
        val element = input.decodeJsonElement()
        val array = element as? JsonArray ?: return emptyList()
        return array.mapNotNull { (it as? JsonPrimitive)?.contentOrNullIfNotString() }
    }

    private fun JsonPrimitive.contentOrNullIfNotString(): String? =
        if (isString) content else null
}

// MARK: - Profile

@Serializable
data class Profile(
    /** Clerk user id (e.g. `user_3BB4L8lv1zpSWxD120VmeDlDxET`) — a string, never a UUID. */
    val id: String,
    val username: String,
    val email: String? = null,
    val photoURL: String? = null,
    @Serializable(with = LenientStringListSerializer::class)
    val hobbies: List<String> = emptyList(),
    @Serializable(with = LenientStringListSerializer::class)
    val studyFields: List<String> = emptyList(),
    val xp: Int = 0,
    val level: Int = 1,
    val spinsLeft: Int? = null,
    /** Epoch millis. BigInt in Postgres, coerced to a JSON number server-side. */
    val lastSpinTimestamp: Long? = null,
    val connectionPrivacy: String? = null,
    val streak: Int? = null,
    val lastChallengeDate: String? = null,
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant? = null,
)
// `pushToken` is intentionally omitted, same as on iOS. The server currently
// returns it on GET /profiles/:id to any authenticated caller, which is a leak
// we don't want to propagate into a second client.

// MARK: - Post

@Serializable
data class Reactions(
    val felt: Int = 0,
    val thought: Int = 0,
    val intrigued: Int = 0,
) {
    val total: Int get() = felt + thought + intrigued
}

@Serializable
enum class ReactionType {
    @SerialName("felt") FELT,
    @SerialName("thought") THOUGHT,
    @SerialName("intrigued") INTRIGUED,
}

@Serializable
data class Post(
    val id: String,
    val userId: String,
    /** Denormalised copy of the author's username at post time. */
    val author: String = "unknown",
    val avatar: String? = null,
    val challenge: String = "",
    val content: String? = null,
    val media: String? = null,
    val spinCount: Int? = null,
    val reactions: Reactions = Reactions(),
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant? = null,
) {
    val isVideo: Boolean
        get() = media
            ?.substringBefore('?')
            ?.substringAfterLast('.', "")
            ?.lowercase()
            ?.let { it in setOf("mp4", "mov", "avi", "webm", "3gp") }
            ?: false
}

// MARK: - Comment

@Serializable
data class Comment(
    val id: String,
    val postId: String,
    val userId: String,
    val author: String,
    val avatar: String? = null,
    val text: String,
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant? = null,
)

// MARK: - Notification

@Serializable
enum class NotificationType {
    @SerialName("reaction") REACTION,
    @SerialName("follow") FOLLOW,
    @SerialName("challenge") CHALLENGE,
    @SerialName("comment") COMMENT,
    @SerialName("unknown") UNKNOWN,
}

/**
 * The API nests the sender as a joined `fromUser` relation, but the app only
 * ever needs their username and avatar. Kept as a nested object here (rather
 * than flattened at decode time like Swift does) because kotlinx has no
 * equivalent hook that stays this readable; the [fromUsername]/[fromAvatar]
 * accessors give call sites the same flat view.
 */
@Serializable
data class NotificationSender(
    val username: String? = null,
    val photoURL: String? = null,
)

@Serializable
data class AppNotification(
    val id: String,
    val type: NotificationType = NotificationType.UNKNOWN,
    val fromUserId: String = "",
    val content: String = "",
    val targetId: String? = null,
    val read: Boolean = false,
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant? = null,
    val fromUser: NotificationSender? = null,
) {
    val fromUsername: String get() = fromUser?.username ?: "User"
    val fromAvatar: String? get() = fromUser?.photoURL
}

// MARK: - Connection request

@Serializable
data class ConnectionRequest(
    val id: String,
    val username: String,
    val photoURL: String? = null,
)

// MARK: - Saved challenge

@Serializable
data class SavedChallenge(
    val challenge: String,
    @Serializable(with = InstantSerializer::class)
    val expiresAt: Instant? = null,
) {
    val id: String get() = challenge
}

// MARK: - Chat

/** Drives the optimistic-UI states: shown immediately as [SENDING], then confirmed or retried. */
@Serializable
enum class DeliveryState {
    @SerialName("sending") SENDING,
    @SerialName("sent") SENT,
    @SerialName("failed") FAILED,
}

/**
 * What a message actually carries.
 *
 * The wire format is fixed by Swift's *synthesised* enum Codable, which the
 * server already emits to match (see server/src/chat/chat.service.ts):
 *
 *     .text                        -> {"text":{}}
 *     .image(url:)                 -> {"image":{"url":"…"}}
 *     .voice(url:duration:samples:)-> {"voice":{"url":…,"duration":…,"samples":[…]}}
 *
 * That is externally-tagged with a single key, which is *not* what kotlinx
 * produces for a sealed class by default (it would emit a `type` discriminator
 * alongside the fields). Hence the hand-written serializer — getting this wrong
 * is silent: media messages decode as blank text lines rather than erroring.
 */
@Serializable(with = MessagePayloadSerializer::class)
sealed interface MessagePayload {
    data object Text : MessagePayload

    data class Image(val url: String) : MessagePayload

    /**
     * `samples` are normalised 0..1 loudness values, stored with the message so
     * the waveform is stable — recomputing it from the audio on every render
     * would draw a different shape each time.
     */
    data class Voice(
        val url: String,
        val duration: Double,
        val samples: List<Float> = emptyList(),
    ) : MessagePayload
}

object MessagePayloadSerializer : KSerializer<MessagePayload> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("MessagePayload", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: MessagePayload) {
        val output = encoder as? JsonEncoder
            ?: throw IllegalStateException("MessagePayload requires a JSON encoder")
        val element = when (value) {
            is MessagePayload.Text -> buildJsonObject { putJsonObject("text") {} }
            is MessagePayload.Image -> buildJsonObject {
                putJsonObject("image") { put("url", value.url) }
            }
            is MessagePayload.Voice -> buildJsonObject {
                putJsonObject("voice") {
                    put("url", value.url)
                    put("duration", value.duration)
                    put("samples", JsonArray(value.samples.map { JsonPrimitive(it) }))
                }
            }
        }
        output.encodeJsonElement(element)
    }

    override fun deserialize(decoder: Decoder): MessagePayload {
        val input = decoder as? JsonDecoder
            ?: throw IllegalStateException("MessagePayload requires a JSON decoder")
        val root = input.decodeJsonElement() as? JsonObject ?: return MessagePayload.Text

        root["image"]?.jsonObject?.let { image ->
            val url = image["url"]?.jsonPrimitive?.content
            if (!url.isNullOrEmpty()) return MessagePayload.Image(url)
        }
        root["voice"]?.jsonObject?.let { voice ->
            val url = voice["url"]?.jsonPrimitive?.content
            if (!url.isNullOrEmpty()) {
                return MessagePayload.Voice(
                    url = url,
                    duration = voice["duration"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0,
                    samples = (voice["samples"] as? JsonArray)
                        ?.mapNotNull { (it as? JsonPrimitive)?.content?.toFloatOrNull() }
                        ?: emptyList(),
                )
            }
        }
        // Unknown or unsent -> a plain text bubble, never a decode failure.
        return MessagePayload.Text
    }
}

@Serializable
data class Message(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val text: String = "",
    @Serializable(with = InstantSerializer::class)
    val sentAt: Instant,
    val delivery: DeliveryState = DeliveryState.SENT,
    val payload: MessagePayload = MessagePayload.Text,
    /** Point size the sender chose by holding send. Null means standard body size. */
    val emphasis: Float? = null,
)

// MARK: - Conversation

@Serializable
data class Conversation(
    val id: String,
    val otherUserId: String,
    val otherUsername: String,
    val otherAvatarURL: String? = null,
    /** Preview line. Empty for a thread that exists but has no messages yet. */
    val lastMessage: String = "",
    @Serializable(with = InstantSerializer::class)
    val lastMessageAt: Instant,
    val unreadCount: Int = 0,
    val isMuted: Boolean = false,
    /** Archived threads are hidden from the main list but never deleted. */
    val isArchived: Boolean = false,
)

@Serializable
data class ConversationRef(
    val id: String,
    val otherUsername: String,
    val otherAvatarURL: String? = null,
)

/**
 * Most recent first, ties broken on username so the order is stable across
 * reloads — seeded threads can share a timestamp, and a list that reshuffles on
 * every refresh looks broken even when the sort is technically correct.
 */
fun List<Conversation>.sortedByRecency(): List<Conversation> =
    sortedWith(compareByDescending<Conversation> { it.lastMessageAt }.thenBy { it.otherUsername })

// MARK: - SPIND

/**
 * A challenge someone sent directly to you. Not a notification — a notification
 * says something happened; this is waiting on a decision, and it expires if you
 * leave it.
 */
@Serializable
data class SpindChallenge(
    val id: String,
    val challenge: String,
    val fromUserId: String,
    val fromUsername: String,
    val fromAvatar: String? = null,
    @Serializable(with = InstantSerializer::class)
    val sentAt: Instant,
    @Serializable(with = InstantSerializer::class)
    val expiresAt: Instant? = null,
    /** Set once you accept, which is what moves it from "decide" to "do". */
    val accepted: Boolean = false,
)

// MARK: - Sponsorship

@Serializable
enum class VenueCategory {
    @SerialName("gym") GYM,
    @SerialName("cafe") CAFE,
    @SerialName("studio") STUDIO,
    @SerialName("park") PARK,
    @SerialName("shop") SHOP;

    val label: String
        get() = when (this) {
            GYM -> "Gym"
            CAFE -> "Café"
            STUDIO -> "Studio"
            PARK -> "Park"
            SHOP -> "Shop"
        }

    /** Categories an age-safety filter hides from the Zone map. */
    val isIntense: Boolean get() = this == GYM || this == PARK
}

@Serializable
data class Sponsor(val id: String, val name: String, val venueId: String)

@Serializable
data class Venue(
    val id: String,
    val name: String,
    val category: VenueCategory,
    val latitude: Double,
    val longitude: Double,
    val blurb: String,
    /** The challenge this venue is currently paying to promote; null when no live campaign. */
    val sponsoredChallenge: String? = null,
)

@Serializable
data class VenuePost(
    val id: String,
    val venueId: String,
    val userId: String,
    val author: String,
    val avatar: String? = null,
    /** The proof image shown inside the venue pin once visible. */
    val media: String? = null,
    val reactions: Reactions = Reactions(),
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant? = null,
)

// MARK: - Speedys

@Serializable
data class Speedy(
    val id: String,
    val userId: String,
    val author: String,
    val avatar: String? = null,
    /** The challenge this is proof of — the card's title. */
    val challenge: String,
    /** What they wrote about doing it. */
    val detail: String = "",
    /** Null for a photo-only card, which renders [posterURL] full-bleed instead. */
    val videoURL: String? = null,
    val posterURL: String? = null,
    val reactions: Reactions = Reactions(),
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant? = null,
    /** Set when this completes a sponsored challenge. Drives the Zone badge and visibility delay. */
    val sponsor: Sponsor? = null,
) {
    val isSponsored: Boolean get() = sponsor != null

    companion object {
        /** Lets the profile grid open one of your own posts in the Speedys card. */
        fun from(post: Post): Speedy = Speedy(
            id = post.id,
            userId = post.userId,
            author = post.author,
            avatar = post.avatar,
            challenge = post.challenge,
            detail = post.content ?: "",
            videoURL = if (post.isVideo) post.media else null,
            posterURL = if (post.isVideo) null else post.media,
            reactions = post.reactions,
            createdAt = post.createdAt,
        )
    }
}

// MARK: - Friend

@Serializable
data class Friend(
    val id: String,
    val name: String,
    val username: String,
    val photoURL: String? = null,
)

// MARK: - Search result user

/**
 * GET /search/users returns the same conceptual entity as /profiles/:id but a
 * different shape — it aliases `id` to an extra `uid` field. [resolvedId]
 * normalises that so the rest of the app only ever deals with one id.
 */
@Serializable
data class SearchUser(
    val id: String? = null,
    val uid: String? = null,
    val username: String = "",
    val photoURL: String? = null,
) {
    /** Prefers `uid` — the endpoint has emitted both over its life. */
    val resolvedId: String get() = uid ?: id.orEmpty()
}
