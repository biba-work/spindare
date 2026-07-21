import Foundation

// Mirrors server/prisma/schema.prisma. Column names there are @map'd to the
// original camelCase Supabase casing, and the API returns them verbatim, so
// these decode without a keyDecodingStrategy — the JSON really is camelCase.

// MARK: - Profile

public struct Profile: Codable, Sendable, Identifiable, Hashable {
    /// Clerk user id (e.g. `user_3BB4L8lv1zpSWxD120VmeDlDxET`) — a string, never a UUID.
    public let id: String
    public var username: String
    public var email: String?
    public var photoURL: String?
    public var hobbies: [String]
    public var studyFields: [String]
    public var xp: Int
    public var level: Int
    public var spinsLeft: Int?
    /// Epoch millis. BigInt in Postgres, coerced to a JSON number server-side.
    public var lastSpinTimestamp: Int64?
    public var connectionPrivacy: String?
    public var streak: Int?
    public var lastChallengeDate: String?
    public var createdAt: Date?

    // `pushToken` is intentionally omitted. The server currently returns it on
    // GET /profiles/:id to any authenticated caller, which is a leak we don't
    // want to propagate into the client model.

    public init(
        id: String,
        username: String,
        email: String? = nil,
        photoURL: String? = nil,
        hobbies: [String] = [],
        studyFields: [String] = [],
        xp: Int = 0,
        level: Int = 1,
        spinsLeft: Int? = nil,
        lastSpinTimestamp: Int64? = nil,
        connectionPrivacy: String? = nil,
        streak: Int? = nil,
        lastChallengeDate: String? = nil,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.username = username
        self.email = email
        self.photoURL = photoURL
        self.hobbies = hobbies
        self.studyFields = studyFields
        self.xp = xp
        self.level = level
        self.spinsLeft = spinsLeft
        self.lastSpinTimestamp = lastSpinTimestamp
        self.connectionPrivacy = connectionPrivacy
        self.streak = streak
        self.lastChallengeDate = lastChallengeDate
        self.createdAt = createdAt
    }

    // hobbies/studyFields are untyped JSON arrays in Postgres. If a row ever
    // holds a non-array (the column has no shape constraint), decode to empty
    // rather than failing the whole profile.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        username = try c.decode(String.self, forKey: .username)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        photoURL = try c.decodeIfPresent(String.self, forKey: .photoURL)
        hobbies = (try? c.decode([String].self, forKey: .hobbies)) ?? []
        studyFields = (try? c.decode([String].self, forKey: .studyFields)) ?? []
        xp = try c.decodeIfPresent(Int.self, forKey: .xp) ?? 0
        level = try c.decodeIfPresent(Int.self, forKey: .level) ?? 1
        spinsLeft = try c.decodeIfPresent(Int.self, forKey: .spinsLeft)
        lastSpinTimestamp = try c.decodeIfPresent(Int64.self, forKey: .lastSpinTimestamp)
        connectionPrivacy = try c.decodeIfPresent(String.self, forKey: .connectionPrivacy)
        streak = try c.decodeIfPresent(Int.self, forKey: .streak)
        lastChallengeDate = try c.decodeIfPresent(String.self, forKey: .lastChallengeDate)
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)
    }
}

// MARK: - Post

public struct Reactions: Codable, Sendable, Hashable {
    public var felt: Int
    public var thought: Int
    public var intrigued: Int

    public var total: Int { felt + thought + intrigued }

    public init(felt: Int = 0, thought: Int = 0, intrigued: Int = 0) {
        self.felt = felt
        self.thought = thought
        self.intrigued = intrigued
    }

    // Stored as an untyped JSON blob on Post, so missing keys are normal for
    // older rows — treat any absent counter as zero rather than failing.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        felt = try c.decodeIfPresent(Int.self, forKey: .felt) ?? 0
        thought = try c.decodeIfPresent(Int.self, forKey: .thought) ?? 0
        intrigued = try c.decodeIfPresent(Int.self, forKey: .intrigued) ?? 0
    }
}

public enum ReactionType: String, Codable, Sendable, CaseIterable {
    case felt
    case thought
    case intrigued
}

public struct Post: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let userId: String
    /// Denormalised copy of the author's username at post time.
    public var author: String
    public var avatar: String?
    public var challenge: String
    public var content: String?
    public var media: String?
    public var spinCount: Int?
    public var reactions: Reactions
    public var createdAt: Date?

    public var isVideo: Bool {
        guard let media, let url = URL(string: media) else { return false }
        return ["mp4", "mov", "avi", "webm", "3gp"].contains(url.pathExtension.lowercased())
    }

    public init(
        id: String,
        userId: String,
        author: String,
        avatar: String? = nil,
        challenge: String,
        content: String? = nil,
        media: String? = nil,
        spinCount: Int? = nil,
        reactions: Reactions = Reactions(),
        createdAt: Date? = nil
    ) {
        self.id = id
        self.userId = userId
        self.author = author
        self.avatar = avatar
        self.challenge = challenge
        self.content = content
        self.media = media
        self.spinCount = spinCount
        self.reactions = reactions
        self.createdAt = createdAt
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decode(String.self, forKey: .userId)
        author = try c.decodeIfPresent(String.self, forKey: .author) ?? "unknown"
        avatar = try c.decodeIfPresent(String.self, forKey: .avatar)
        challenge = try c.decodeIfPresent(String.self, forKey: .challenge) ?? ""
        content = try c.decodeIfPresent(String.self, forKey: .content)
        media = try c.decodeIfPresent(String.self, forKey: .media)
        spinCount = try c.decodeIfPresent(Int.self, forKey: .spinCount)
        reactions = try c.decodeIfPresent(Reactions.self, forKey: .reactions) ?? Reactions()
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)
    }
}

// MARK: - Comment

public struct Comment: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let postId: String
    public let userId: String
    public var author: String
    public var avatar: String?
    public var text: String
    public var createdAt: Date?

    public init(
        id: String,
        postId: String,
        userId: String,
        author: String,
        avatar: String? = nil,
        text: String,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.postId = postId
        self.userId = userId
        self.author = author
        self.avatar = avatar
        self.text = text
        self.createdAt = createdAt
    }
}

// MARK: - Notification

public enum NotificationType: String, Codable, Sendable {
    case reaction
    case follow
    case challenge
    case comment
    case unknown

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = NotificationType(rawValue: raw) ?? .unknown
    }
}

public struct AppNotification: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let type: NotificationType
    public let fromUserId: String
    public var fromUsername: String
    public var fromAvatar: String?
    public var content: String
    public var targetId: String?
    public var read: Bool
    public var createdAt: Date?

    // The API nests the sender as a joined `fromUser` relation, but the app
    // only ever needs their username and avatar — flatten at the boundary so
    // views aren't reaching through two levels for a display name.
    private enum CodingKeys: String, CodingKey {
        case id, type, fromUserId, content, targetId, read, createdAt, fromUser
    }

    private struct FromUser: Codable {
        let username: String?
        let photoURL: String?
    }

    public init(
        id: String,
        type: NotificationType,
        fromUserId: String,
        fromUsername: String,
        fromAvatar: String? = nil,
        content: String,
        targetId: String? = nil,
        read: Bool = false,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.type = type
        self.fromUserId = fromUserId
        self.fromUsername = fromUsername
        self.fromAvatar = fromAvatar
        self.content = content
        self.targetId = targetId
        self.read = read
        self.createdAt = createdAt
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decodeIfPresent(NotificationType.self, forKey: .type) ?? .unknown
        fromUserId = try c.decodeIfPresent(String.self, forKey: .fromUserId) ?? ""
        content = try c.decodeIfPresent(String.self, forKey: .content) ?? ""
        targetId = try c.decodeIfPresent(String.self, forKey: .targetId)
        read = try c.decodeIfPresent(Bool.self, forKey: .read) ?? false
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)

        let fromUser = try c.decodeIfPresent(FromUser.self, forKey: .fromUser)
        fromUsername = fromUser?.username ?? "User"
        fromAvatar = fromUser?.photoURL
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(type, forKey: .type)
        try c.encode(fromUserId, forKey: .fromUserId)
        try c.encode(content, forKey: .content)
        try c.encodeIfPresent(targetId, forKey: .targetId)
        try c.encode(read, forKey: .read)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encode(FromUser(username: fromUsername, photoURL: fromAvatar), forKey: .fromUser)
    }
}

// MARK: - Connection request

public struct ConnectionRequest: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public var username: String
    public var photoURL: String?

    public init(id: String, username: String, photoURL: String? = nil) {
        self.id = id
        self.username = username
        self.photoURL = photoURL
    }
}

// MARK: - Saved challenge

public struct SavedChallenge: Codable, Sendable, Hashable, Identifiable {
    public var id: String { challenge }
    public var challenge: String
    public var expiresAt: Date?

    public init(challenge: String, expiresAt: Date? = nil) {
        self.challenge = challenge
        self.expiresAt = expiresAt
    }
}

// MARK: - Chat

/// A message's journey through sending — drives the optimistic-UI states in
/// `ChatViewModel`: shown immediately as `.sending`, then either confirmed or
/// offered a retry.
public enum DeliveryState: String, Codable, Sendable, Hashable {
    case sending, sent, failed
}

/// What a message actually carries.
///
/// A separate enum rather than optional fields on `Message`, because the cases
/// are genuinely exclusive — a bubble renders as exactly one of these — and
/// optional-field modelling would let "an image *and* a voice note with no
/// text" be constructed, which nothing can draw.
public enum MessagePayload: Codable, Sendable, Hashable {
    case text
    /// Local file URL for a picked or captured image.
    case image(url: URL)
    /// A recorded voice note. `samples` are normalised 0...1 loudness values,
    /// stored with the message so the waveform is stable — recomputing it from
    /// the audio on every render would redraw a different shape each time.
    case voice(url: URL, duration: TimeInterval, samples: [CGFloat])
}

public struct Message: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public var conversationId: String
    public var senderId: String
    public var text: String
    public var sentAt: Date
    public var delivery: DeliveryState
    public var payload: MessagePayload
    /// Point size the sender chose by holding the send button. Nil means the
    /// standard body size.
    public var emphasis: CGFloat?

    public init(
        id: String,
        conversationId: String,
        senderId: String,
        text: String,
        sentAt: Date,
        delivery: DeliveryState = .sent,
        payload: MessagePayload = .text,
        emphasis: CGFloat? = nil
    ) {
        self.id = id
        self.conversationId = conversationId
        self.senderId = senderId
        self.text = text
        self.sentAt = sentAt
        self.delivery = delivery
        self.payload = payload
        self.emphasis = emphasis
    }
}

// MARK: - Conversation

/// A thread in the message list.
///
/// The list used to render `Friend` directly, which is why it couldn't be
/// sorted: a friend has a name and an avatar but nothing that says *when*, so
/// every row was equally recent and the order was whatever the friends
/// endpoint happened to return. Sorting a message list by anything other than
/// recency is wrong, so the list needs an entity that carries a timestamp.
public struct Conversation: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public var otherUserId: String
    public var otherUsername: String
    public var otherAvatarURL: String?
    /// Preview line. Empty for a thread that exists but has no messages yet.
    public var lastMessage: String
    public var lastMessageAt: Date
    public var unreadCount: Int
    public var isMuted: Bool
    /// Set by the "Inbox" swipe action. An archived thread is hidden from the
    /// main list but not deleted — its transcript and this record both
    /// survive, findable from the archive.
    public var isArchived: Bool

    public init(
        id: String,
        otherUserId: String,
        otherUsername: String,
        otherAvatarURL: String? = nil,
        lastMessage: String = "",
        lastMessageAt: Date,
        unreadCount: Int = 0,
        isMuted: Bool = false,
        isArchived: Bool = false
    ) {
        self.id = id
        self.otherUserId = otherUserId
        self.otherUsername = otherUsername
        self.otherAvatarURL = otherAvatarURL
        self.lastMessage = lastMessage
        self.lastMessageAt = lastMessageAt
        self.unreadCount = unreadCount
        self.isMuted = isMuted
        self.isArchived = isArchived
    }

    // `isArchived` is additive — rows already sitting in a device's local
    // store from before this field existed won't have the key. Decoding it
    // leniently (default `false`, same treatment `Reactions` gives a missing
    // counter above) means those threads just aren't archived, rather than
    // failing to decode at all and silently vanishing from the list.
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        otherUserId = try c.decode(String.self, forKey: .otherUserId)
        otherUsername = try c.decode(String.self, forKey: .otherUsername)
        otherAvatarURL = try c.decodeIfPresent(String.self, forKey: .otherAvatarURL)
        lastMessage = try c.decodeIfPresent(String.self, forKey: .lastMessage) ?? ""
        lastMessageAt = try c.decode(Date.self, forKey: .lastMessageAt)
        unreadCount = try c.decodeIfPresent(Int.self, forKey: .unreadCount) ?? 0
        isMuted = try c.decodeIfPresent(Bool.self, forKey: .isMuted) ?? false
        isArchived = try c.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
    }

    public var ref: AppRouter.ConversationRef {
        AppRouter.ConversationRef(
            id: id,
            otherUsername: otherUsername,
            otherAvatarURL: otherAvatarURL
        )
    }
}

public extension Array where Element == Conversation {
    /// Most recent first. Ties break on username so the order is stable across
    /// reloads — seeded threads can share a timestamp, and a list that
    /// reshuffles itself on every refresh looks broken even when the sort is
    /// technically correct.
    func sortedByRecency() -> [Conversation] {
        sorted {
            $0.lastMessageAt == $1.lastMessageAt
                ? $0.otherUsername < $1.otherUsername
                : $0.lastMessageAt > $1.lastMessageAt
        }
    }
}

// MARK: - SPIND

/// A challenge someone sent directly to you.
///
/// This is the inbox the RN app calls SPIND. It is not a notification — a
/// notification tells you something happened, this is something waiting on a
/// decision from you, and it expires if you leave it.
public struct SpindChallenge: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public var challenge: String
    public var fromUserId: String
    public var fromUsername: String
    public var fromAvatar: String?
    public var sentAt: Date
    public var expiresAt: Date?
    /// Set once you accept, which is what moves it from "decide" to "do".
    public var accepted: Bool

    public init(
        id: String,
        challenge: String,
        fromUserId: String,
        fromUsername: String,
        fromAvatar: String? = nil,
        sentAt: Date,
        expiresAt: Date? = nil,
        accepted: Bool = false
    ) {
        self.id = id
        self.challenge = challenge
        self.fromUserId = fromUserId
        self.fromUsername = fromUsername
        self.fromAvatar = fromAvatar
        self.sentAt = sentAt
        self.expiresAt = expiresAt
        self.accepted = accepted
    }
}

// MARK: - Sponsorship

public enum VenueCategory: String, Codable, Sendable, CaseIterable, Hashable {
    case gym, cafe, studio, park, shop

    public var label: String {
        switch self {
        case .gym: "Gym"
        case .cafe: "Café"
        case .studio: "Studio"
        case .park: "Park"
        case .shop: "Shop"
        }
    }

    public var icon: String {
        switch self {
        case .gym: "figure.strengthtraining.traditional"
        case .cafe: "cup.and.saucer.fill"
        case .studio: "paintpalette.fill"
        case .park: "tree.fill"
        case .shop: "bag.fill"
        }
    }
}

/// A paying partner. Attached to a challenge, it makes that challenge
/// *sponsored* — which is what puts it on the Zone map and, critically, what
/// subjects any post completing it to the delay in `SponsoredVisibility`.
public struct Sponsor: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public var name: String
    public var venueId: String

    public init(id: String, name: String, venueId: String) {
        self.id = id
        self.name = name
        self.venueId = venueId
    }
}

/// A sponsored place on the Zone map.
public struct Venue: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public var name: String
    public var category: VenueCategory
    public var latitude: Double
    public var longitude: Double
    public var blurb: String
    /// The challenge this venue is currently paying to promote. Nil for a
    /// partner with no live campaign — still on the map, just not handing out
    /// a challenge right now.
    public var sponsoredChallenge: String?

    public init(
        id: String,
        name: String,
        category: VenueCategory,
        latitude: Double,
        longitude: Double,
        blurb: String,
        sponsoredChallenge: String? = nil
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.latitude = latitude
        self.longitude = longitude
        self.blurb = blurb
        self.sponsoredChallenge = sponsoredChallenge
    }
}

/// A completed sponsored-challenge post pinned to a venue on the Zone map.
///
/// Same visibility rule as a sponsored Speedy (see `SponsoredVisibility`): the
/// author sees their own the instant they post; everyone else waits five minutes
/// so the pin can't broadcast "this person is standing here right now." Once the
/// gate opens, a venue with several completions shows the most-reacted one's
/// image on its pin instead of the category glyph.
public struct VenuePost: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let venueId: String
    public let userId: String
    public var author: String
    public var avatar: String?
    /// The proof image shown inside the venue pin once visible.
    public var media: String?
    public var reactions: Reactions
    public var createdAt: Date?

    public init(
        id: String,
        venueId: String,
        userId: String,
        author: String,
        avatar: String? = nil,
        media: String? = nil,
        reactions: Reactions = Reactions(),
        createdAt: Date? = nil
    ) {
        self.id = id
        self.venueId = venueId
        self.userId = userId
        self.author = author
        self.avatar = avatar
        self.media = media
        self.reactions = reactions
        self.createdAt = createdAt
    }
}

// MARK: - Speedys

/// One full-screen short-form card.
///
/// Both the Speedys feed and the profile's own-post fullscreen render this, so
/// they can't drift apart — the difference between them is entirely about
/// *whose* it is (see `ReactionRow`'s `isOwner` split), not about two separate
/// layouts that happen to look similar.
public struct Speedy: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let userId: String
    public var author: String
    public var avatar: String?
    /// The challenge this is proof of — shown as the card's title.
    public var challenge: String
    /// What they wrote about doing it.
    public var detail: String
    /// Remote video. Nil for a photo-only card, which renders `posterURL`
    /// full-bleed instead — both are legitimate, not a degraded state.
    public var videoURL: String?
    /// Still frame. Shown while the video loads, and as the whole card when
    /// there is no video.
    public var posterURL: String?
    public var reactions: Reactions
    public var createdAt: Date?
    /// Set when this completes a sponsored challenge. Drives the Zone badge
    /// and the visibility delay.
    public var sponsor: Sponsor?

    public init(
        id: String,
        userId: String,
        author: String,
        avatar: String? = nil,
        challenge: String,
        detail: String,
        videoURL: String? = nil,
        posterURL: String? = nil,
        reactions: Reactions = Reactions(),
        createdAt: Date? = nil,
        sponsor: Sponsor? = nil
    ) {
        self.id = id
        self.userId = userId
        self.author = author
        self.avatar = avatar
        self.challenge = challenge
        self.detail = detail
        self.videoURL = videoURL
        self.posterURL = posterURL
        self.reactions = reactions
        self.createdAt = createdAt
        self.sponsor = sponsor
    }

    public var isSponsored: Bool { sponsor != nil }

    /// Lets the profile grid open one of your own posts in the same
    /// full-screen card the Speedys feed uses.
    public init(post: Post) {
        self.init(
            id: post.id,
            userId: post.userId,
            author: post.author,
            avatar: post.avatar,
            challenge: post.challenge,
            detail: post.content ?? "",
            videoURL: post.isVideo ? post.media : nil,
            posterURL: post.isVideo ? nil : post.media,
            reactions: post.reactions,
            createdAt: post.createdAt
        )
    }
}

// MARK: - Friend

public struct Friend: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public var name: String
    public var username: String
    public var photoURL: String?

    public init(id: String, name: String, username: String, photoURL: String? = nil) {
        self.id = id
        self.name = name
        self.username = username
        self.photoURL = photoURL
    }
}

// MARK: - Search result user
//
// GET /search/users returns the same conceptual entity as /profiles/:id but a
// different shape — it aliases `id` to an extra `uid` field. Normalising here
// so the rest of the app only ever sees `Profile`.

public struct SearchUser: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public var username: String
    public var photoURL: String?

    private enum CodingKeys: String, CodingKey {
        case id, uid, username, photoURL
    }

    public init(id: String, username: String, photoURL: String? = nil) {
        self.id = id
        self.username = username
        self.photoURL = photoURL
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Prefer `uid`, fall back to `id` — the endpoint has emitted both.
        if let uid = try c.decodeIfPresent(String.self, forKey: .uid) {
            id = uid
        } else {
            id = try c.decode(String.self, forKey: .id)
        }
        username = try c.decodeIfPresent(String.self, forKey: .username) ?? ""
        photoURL = try c.decodeIfPresent(String.self, forKey: .photoURL)
    }

    // Written by hand because `uid` is a decode-only alias with no stored
    // property, which blocks the synthesised encoder. Round-trips as `id`.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(username, forKey: .username)
        try c.encodeIfPresent(photoURL, forKey: .photoURL)
    }
}
