import Foundation
import SwiftData

// Service protocols with Live (Nest API) and Mock (in-memory) conformances,
// mirroring the split added to the RN client in src/services/MockData.ts +
// src/config/AppConfig.ts.
//
// This exists because the backend has never been run against fully provisioned
// infrastructure. Views bind to the protocols, so UI work proceeds against Mock
// regardless of backend state, and swapping to Live is a one-line change in the
// app's composition root.

// MARK: - Protocols

public protocol FeedServing: Sendable {
    func feed() async throws -> [Post]
    func posts(forUser userId: String) async throws -> [Post]
    func createPost(challenge: String, content: String?, media: String?, username: String, avatar: String?) async throws -> Post
    func reaction(forPost postId: String) async throws -> ReactionType?
    func setReaction(_ type: ReactionType, postId: String, username: String, avatar: String?) async throws
}

public protocol ProfileServing: Sendable {
    func profile(id: String) async throws -> Profile?
    func currentProfile() async throws -> Profile?
    func createProfile(username: String, email: String?, hobbies: [String], studyFields: [String]) async throws -> Profile
    func updateUsername(_ username: String) async throws
    func updatePhoto(url: String) async throws
    /// Permanently deletes the signed-in user's account (server rows + Clerk user).
    func deleteAccount() async throws
}

public protocol NotificationServing: Sendable {
    func notifications() async throws -> [AppNotification]
    func unreadCount() async throws -> Int
    func markAllRead() async throws
}

public protocol SocialServing: Sendable {
    func friends() async throws -> [Friend]
    func pendingRequests() async throws -> [ConnectionRequest]
    func acceptRequest(from userId: String) async throws
    func declineRequest(from userId: String) async throws
    func savedChallenges() async throws -> [SavedChallenge]
    func saveChallenge(_ challenge: String) async throws

    /// Challenges other people have sent you — the SPIND inbox.
    func spindInbox() async throws -> [SpindChallenge]
    func acceptSpind(id: String) async throws
    func declineSpind(id: String) async throws
    /// Send a challenge to a friend — it lands in their SPIND inbox.
    func sendSpind(toUserId: String, challenge: String) async throws
}

public protocol SpeedyServing: Sendable {
    /// The Speedys feed. Implementations return everything; the *visibility
    /// gate is the caller's job* via `SponsoredVisibility` — deliberately not
    /// applied here, so the view layer can also ask "what's still pending"
    /// rather than only ever seeing a pre-filtered list it can't reason about.
    func speedys() async throws -> [Speedy]
    /// `previous` is the viewer's prior pick, if they're switching within the
    /// short window Speedys allows — nil for a first-ever reaction. Needed so
    /// the backend can move the count rather than double-add it.
    func setReaction(_ type: ReactionType, replacing previous: ReactionType?, speedyId: String) async throws
    func toggleFavourite(speedyId: String) async throws -> Bool
    func favourites() async throws -> Set<String>
}

public protocol ZoneServing: Sendable {
    func venues() async throws -> [Venue]
    /// Completed sponsored challenges pinned to venues. The visibility gate is
    /// the caller's job (via `SponsoredVisibility`), same as the Speedys feed.
    func venuePosts() async throws -> [VenuePost]
}

public protocol SearchServing: Sendable {
    func users(matching query: String) async throws -> [SearchUser]
    func challenges(matching query: String) async throws -> [Post]
}

public protocol ChatServing: Sendable {
    func messages(in conversation: AppRouter.ConversationRef) async throws -> [Message]
    func send(_ text: String, in conversation: AppRouter.ConversationRef) async throws -> Message

    /// The main list — everything *except* what's been inboxed. Most-recent-
    /// first ordering left to the caller.
    func conversations() async throws -> [Conversation]
    /// Everything that's been inboxed. This is what makes "Inbox" a filing
    /// action rather than a second delete — without a way to list these back
    /// out, an inboxed thread is just gone with extra steps.
    func archivedConversations() async throws -> [Conversation]
    func deleteConversation(id: String) async throws
    func setMuted(_ muted: Bool, conversationId: String) async throws
    /// Moves a thread out of the main list without deleting it.
    func archiveConversation(id: String) async throws
    /// Moves an inboxed thread back to the main list.
    func unarchiveConversation(id: String) async throws
}

// MARK: - Live implementations

public struct LiveFeedService: FeedServing {
    private let api: APIClient
    public init(api: APIClient) { self.api = api }

    public func feed() async throws -> [Post] {
        try await api.get("/posts")
    }

    public func posts(forUser userId: String) async throws -> [Post] {
        try await api.get("/posts/user/\(userId)")
    }

    public func createPost(
        challenge: String,
        content: String?,
        media: String?,
        username: String,
        avatar: String?
    ) async throws -> Post {
        struct Body: Encodable {
            let username: String
            let avatar: String?
            let challenge: String
            let content: String?
            let media: String?
        }
        return try await api.post(
            "/posts",
            body: Body(username: username, avatar: avatar, challenge: challenge, content: content, media: media)
        )
    }

    public func reaction(forPost postId: String) async throws -> ReactionType? {
        // Returns a bare string or literal null — see APIClient's trap 1.
        try await api.get("/posts/\(postId)/reaction")
    }

    public func setReaction(_ type: ReactionType, postId: String, username: String, avatar: String?) async throws {
        struct Body: Encodable {
            let username: String
            let avatar: String?
            let type: String
        }
        try await api.post(
            "/posts/\(postId)/reaction",
            body: Body(username: username, avatar: avatar, type: type.rawValue)
        )
    }
}

public struct LiveProfileService: ProfileServing {
    private let api: APIClient
    public init(api: APIClient) { self.api = api }

    public func profile(id: String) async throws -> Profile? {
        try await api.get("/profiles/\(id)")
    }

    public func currentProfile() async throws -> Profile? {
        try await api.get("/profiles")
    }

    public func createProfile(
        username: String,
        email: String?,
        hobbies: [String],
        studyFields: [String]
    ) async throws -> Profile {
        struct Body: Encodable {
            let username: String
            let email: String?
            let hobbies: [String]
            let studyFields: [String]
        }
        return try await api.post(
            "/profiles",
            body: Body(username: username, email: email, hobbies: hobbies, studyFields: studyFields)
        )
    }

    public func updateUsername(_ username: String) async throws {
        struct Body: Encodable { let username: String }
        try await api.patch("/profiles/username", body: Body(username: username))
    }

    public func updatePhoto(url: String) async throws {
        struct Body: Encodable { let photoURL: String }
        try await api.patch("/profiles/picture", body: Body(photoURL: url))
    }

    public func deleteAccount() async throws {
        try await api.delete("/profiles")
    }
}

public struct LiveNotificationService: NotificationServing {
    private let api: APIClient
    public init(api: APIClient) { self.api = api }

    public func notifications() async throws -> [AppNotification] {
        try await api.get("/notifications")
    }

    public func unreadCount() async throws -> Int {
        // Bare integer.
        try await api.get("/notifications/unread-count")
    }

    public func markAllRead() async throws {
        try await api.patch("/notifications/read-all")
    }
}

public struct LiveSocialService: SocialServing {
    private let api: APIClient
    public init(api: APIClient) { self.api = api }

    public func friends() async throws -> [Friend] {
        try await api.get("/social/friends")
    }

    public func pendingRequests() async throws -> [ConnectionRequest] {
        try await api.get("/social/requests")
    }

    public func acceptRequest(from userId: String) async throws {
        // Answers 200 with an empty body.
        try await api.post("/social/requests/\(userId)/accept")
    }

    public func declineRequest(from userId: String) async throws {
        try await api.post("/social/requests/\(userId)/decline")
    }

    public func savedChallenges() async throws -> [SavedChallenge] {
        try await api.get("/challenges/kept/saved")
    }

    public func saveChallenge(_ challenge: String) async throws {
        struct Body: Encodable { let challenge: String }
        try await api.post("/challenges/kept/save", body: Body(challenge: challenge))
    }

    public func spindInbox() async throws -> [SpindChallenge] {
        try await api.get("/challenges/spind/inbox")
    }

    public func acceptSpind(id: String) async throws {
        try await api.post("/challenges/spind/\(id)/accept")
    }

    public func declineSpind(id: String) async throws {
        try await api.post("/challenges/spind/\(id)/decline")
    }

    public func sendSpind(toUserId: String, challenge: String) async throws {
        struct Body: Encodable { let toUserId: String; let challenge: String }
        try await api.post("/challenges/spind/send", body: Body(toUserId: toUserId, challenge: challenge))
    }
}

public struct LiveSearchService: SearchServing {
    private let api: APIClient
    public init(api: APIClient) { self.api = api }

    public func users(matching query: String) async throws -> [SearchUser] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return try await api.get("/search/users?q=\(encoded)")
    }

    public func challenges(matching query: String) async throws -> [Post] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return try await api.get("/search/challenges?q=\(encoded)")
    }
}

/// The backend has no REST API for sending or listing messages — its only
/// chat-related route mints a StreamChat token, and the controller's own
/// comment marks that integration "on hold for now (deprioritized)." Throwing
/// this from `LiveChatService` documents the gap explicitly rather than the
/// alternative of silently returning an empty inbox, which would look like a
/// conversation with no history instead of a feature that isn't wired up yet.
public struct ChatUnavailableError: Error, Sendable, Equatable {
    public let reason = "Messaging isn't connected yet — only the mock chat works right now."
}

public struct LiveChatService: ChatServing {
    private let api: APIClient
    public init(api: APIClient) { self.api = api }

    public func messages(in conversation: AppRouter.ConversationRef) async throws -> [Message] {
        throw ChatUnavailableError()
    }

    public func send(_ text: String, in conversation: AppRouter.ConversationRef) async throws -> Message {
        throw ChatUnavailableError()
    }

    public func conversations() async throws -> [Conversation] {
        throw ChatUnavailableError()
    }

    public func archivedConversations() async throws -> [Conversation] {
        throw ChatUnavailableError()
    }

    public func deleteConversation(id: String) async throws {
        throw ChatUnavailableError()
    }

    public func setMuted(_ muted: Bool, conversationId: String) async throws {
        throw ChatUnavailableError()
    }

    public func archiveConversation(id: String) async throws {
        throw ChatUnavailableError()
    }

    public func unarchiveConversation(id: String) async throws {
        throw ChatUnavailableError()
    }
}

// MARK: - Mock backing store

/// Backing store for the mock backend.
///
/// In-memory arrays remain the hot path every read and mutation goes through —
/// unchanged from before this was persisted. What's new is that every mutation
/// also writes through to `store`, and `init()` loads from `store` instead of
/// reseeding whenever a previous run left something there. The result: mock
/// data behaves like real data now — a post you made, a message you sent, a
/// thread you deleted are all still that way next time the app opens — while
/// staying entirely on-device and free of any network dependency.
///
/// Actor-isolated so the mock services are safely `Sendable` and can be shared
/// across views; also what makes it safe to hold `store` (backed by a
/// non-`Sendable` `ModelContext`) as state at all — nothing here ever crosses
/// an actor boundary except the plain `Codable` structs these methods return.
public actor MockBackend {
    /// The app's one durable backend — the only construction that asks
    /// `PersistentStore` for the real, on-disk store. Every other
    /// `MockBackend()` (tests, previews) gets its own private, in-memory-only
    /// one via the default initializer below.
    public static let shared = MockBackend(store: PersistentStore(persistent: true))

    private let store: PersistentStore

    private var posts: [Post]
    private var notifications: [AppNotification]
    private var requests: [ConnectionRequest]
    private var saved: [SavedChallenge]
    private var spind: [SpindChallenge]
    private var profile: Profile?
    private var reactions: [String: ReactionType] = [:]
    /// Keyed by conversation id, each an append-only message log.
    private var messagesByConversation: [String: [Message]] = [:]
    /// Seeded on first read rather than in `init()`, so a deleted thread stays
    /// deleted instead of being reinstated by the next reload.
    private var conversations: [Conversation] = []
    /// Same lazy-seed treatment as `conversations`.
    private var speedys: [Speedy] = []
    private var favouriteSpeedys: Set<String> = []
    /// Completed sponsored challenges shown on Zone pins. Lazy-seeded like
    /// speedys/conversations, not persisted (fixed demo reference data).
    private var venuePosts: [VenuePost] = []

    /// Seed posts authored by this sentinel are relabelled to the signed-in
    /// Clerk id once known, so "your" posts appear correctly in both the feed
    /// (ownership checks) and the profile grid.
    public static let currentUserSentinel = "__mock_current_user__"

    /// Fixed key for the single-row profile record — there is only ever one,
    /// the signed-in user's.
    private static let profileKey = "current"

    /// Defaults to a private, in-memory-only store — see `PersistentStore`'s
    /// own `persistent` doc comment for why that's the safe default rather
    /// than `.shared`'s real one.
    public init(store: PersistentStore = PersistentStore()) {
        self.store = store

        // First launch ever (or a fresh install): nothing to load, so seed as
        // before and persist that seed immediately, so it's what "load" finds
        // on every later launch rather than being regenerated — and rerolled —
        // each time.
        guard store.hasAnyRecords else {
            posts = MockSeed.posts
            notifications = MockSeed.notifications
            requests = MockSeed.requests
            saved = MockSeed.saved
            spind = MockSeed.spind
            profile = nil

            posts.forEach { store.upsert($0, kind: "post", id: $0.id) }
            notifications.forEach { store.upsert($0, kind: "notification", id: $0.id) }
            requests.forEach { store.upsert($0, kind: "request", id: $0.id) }
            saved.forEach { store.upsert($0, kind: "saved", id: $0.id) }
            spind.forEach { store.upsert($0, kind: "spind", id: $0.id) }
            return
        }

        posts = store.all(kind: "post", as: Post.self)
        notifications = store.all(kind: "notification", as: AppNotification.self)
        requests = store.all(kind: "request", as: ConnectionRequest.self)
        saved = store.all(kind: "saved", as: SavedChallenge.self)
        spind = store.all(kind: "spind", as: SpindChallenge.self)
        profile = store.one(kind: "profile", id: Self.profileKey, as: Profile.self)
        conversations = store.all(kind: "conversation", as: Conversation.self)

        speedys = store.all(kind: "speedy", as: Speedy.self)
        favouriteSpeedys = Set(
            store.one(kind: "speedyFavourites", id: "all", as: FavouriteRecord.self)?.ids ?? []
        )

        let allMessages = store.all(kind: "message", as: Message.self)
        messagesByConversation = Dictionary(grouping: allMessages, by: \.conversationId)

        for (postId, raw) in store.all(kind: "reaction", as: ReactionRecord.self).map({ ($0.postId, $0.type) }) {
            reactions[postId] = raw
        }
    }

    public func bind(userId: String, username: String, email: String?) {
        posts = posts.map { post in
            guard post.userId == Self.currentUserSentinel else { return post }
            var copy = Post(
                id: post.id,
                userId: userId,
                author: username,
                avatar: post.avatar,
                challenge: post.challenge,
                content: post.content,
                media: post.media,
                spinCount: post.spinCount,
                reactions: post.reactions,
                createdAt: post.createdAt
            )
            copy.author = username
            store.upsert(copy, kind: "post", id: copy.id)
            return copy
        }
        if profile == nil {
            let created = Profile(
                id: userId,
                username: username,
                email: email,
                hobbies: ["Photography", "Music"],
                studyFields: ["Design"],
                xp: 2140,
                level: 6,
                spinsLeft: 2,
                streak: 4
            )
            profile = created
            store.upsert(created, kind: "profile", id: Self.profileKey)
        }
    }

    // Explicitly sorted rather than trusting array order: seed data isn't
    // authored in one single chronological run any more (posts were added in
    // topical batches, not by timestamp), and a reload from `store` has no
    // ordering guarantee at all — SwiftData doesn't promise fetch order absent
    // a sort descriptor. Newest-first is a guarantee the *callers* need
    // (`feed()`'s ranking input, and the profile grid via `posts(for:)`
    // downstream), so it belongs here rather than being incidental to
    // insertion order.
    func allPosts() -> [Post] { posts.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) } }
    func posts(for userId: String) -> [Post] {
        allPosts().filter { $0.userId == userId }
    }
    func insert(_ post: Post) {
        posts.insert(post, at: 0)
        store.upsert(post, kind: "post", id: post.id)
    }
    func allNotifications() -> [AppNotification] { notifications }
    func unread() -> Int { notifications.filter { !$0.read }.count }
    func markAllRead() {
        notifications = notifications.map {
            var copy = $0
            copy.read = true
            store.upsert(copy, kind: "notification", id: copy.id)
            return copy
        }
    }
    func allRequests() -> [ConnectionRequest] { requests }
    func removeRequest(_ id: String) {
        requests.removeAll { $0.id == id }
        store.delete(kind: "request", id: id)
    }
    func allSaved() -> [SavedChallenge] { saved }
    func save(_ challenge: String) {
        guard !saved.contains(where: { $0.challenge == challenge }) else { return }
        let record = SavedChallenge(challenge: challenge, expiresAt: Date().addingTimeInterval(48 * 3600))
        saved.append(record)
        store.upsert(record, kind: "saved", id: record.id)
    }
    func allSpind() -> [SpindChallenge] { spind }
    func acceptSpind(_ id: String) {
        guard let index = spind.firstIndex(where: { $0.id == id }) else { return }
        // Accepting keeps it in the inbox — it moves from "decide" to "do", and
        // dropping it here would leave no way back to a challenge you took on.
        spind[index].accepted = true
        store.upsert(spind[index], kind: "spind", id: id)
    }
    func removeSpind(_ id: String) {
        spind.removeAll { $0.id == id }
        store.delete(kind: "spind", id: id)
    }

    func messages(in conversationId: String) -> [Message] {
        // Seeded lazily rather than up front at `init()`, since a conversation
        // id is only known once someone opens that chat. By the time that
        // happens sign-in has already completed, so `profile` — set in
        // `bind(userId:...)` — is a reliable stand-in for "me" without needing
        // the sentinel-and-relabel dance the seed posts use.
        //
        // This still only fires once per conversation ever, not once per
        // launch — a conversation with no persisted messages after the first
        // run really has none (nothing in this app deletes individual
        // messages), so re-seeding it would resurrect the opening exchange
        // after you'd read past it.
        if messagesByConversation[conversationId] == nil {
            let seeded = MockSeed.seedMessages(
                for: conversationId,
                currentUserId: profile?.id ?? Self.currentUserSentinel
            )
            messagesByConversation[conversationId] = seeded
            seeded.forEach { store.upsert($0, kind: "message", id: $0.id) }
        }
        return messagesByConversation[conversationId] ?? []
    }

    func appendMessage(_ message: Message, to conversationId: String) {
        messagesByConversation[conversationId, default: []].append(message)
        store.upsert(message, kind: "message", id: message.id)

        // Keeps the list preview and its ordering in step with what was
        // actually said. Without this a thread you just replied to stays
        // wherever it was, showing its old preview line.
        if let index = conversations.firstIndex(where: { $0.id == conversationId }) {
            conversations[index].lastMessage = message.text
            conversations[index].lastMessageAt = message.sentAt
            store.upsert(conversations[index], kind: "conversation", id: conversationId)
        }
    }

    // MARK: Conversations

    /// Every thread, archived or not — callers filter for the view they need.
    /// Kept as one honestly-named accessor rather than baking "active only"
    /// into its name, since that's exactly the mistake that made inboxed
    /// threads unreachable before: the previous version of this method
    /// already excluded them, silently, with nothing else exposing them.
    func allConversations() -> [Conversation] {
        if conversations.isEmpty {
            conversations = MockSeed.conversations
            conversations.forEach { store.upsert($0, kind: "conversation", id: $0.id) }
        }
        return conversations
    }

    func removeConversation(_ id: String) {
        conversations.removeAll { $0.id == id }
        // The transcript goes with it — unlike archiving, delete means delete,
        // and leaving orphaned message rows around would just be a slow leak
        // in the store with no way to ever reach them again.
        messagesByConversation[id]?.forEach { store.delete(kind: "message", id: $0.id) }
        messagesByConversation[id] = nil
        store.delete(kind: "conversation", id: id)
    }

    func setConversationMuted(_ muted: Bool, id: String) {
        guard let index = conversations.firstIndex(where: { $0.id == id }) else { return }
        conversations[index].isMuted = muted
        store.upsert(conversations[index], kind: "conversation", id: id)
    }

    /// Archiving hides it from the main list but keeps both the record and the
    /// transcript — a flag flip, not a delete, so `archivedConversations()`
    /// (below) has something to find.
    func archiveConversation(_ id: String) {
        setArchived(true, id: id)
    }

    func unarchiveConversation(_ id: String) {
        setArchived(false, id: id)
    }

    private func setArchived(_ archived: Bool, id: String) {
        _ = allConversations() // ensures seeding has happened before the lookup below
        guard let index = conversations.firstIndex(where: { $0.id == id }) else { return }
        conversations[index].isArchived = archived
        store.upsert(conversations[index], kind: "conversation", id: id)
    }

    // MARK: Speedys & Zone

    func allSpeedys() -> [Speedy] {
        if speedys.isEmpty {
            speedys = MockSeed.speedys
            speedys.forEach { store.upsert($0, kind: "speedy", id: $0.id) }
        }
        return speedys.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    /// `previous` matters: the Speedys feed gives you a short window to
    /// change your reaction, and a switch within that window has to move the
    /// count from the old choice to the new one, not add a second increment
    /// on top of the first — otherwise switching felt → thought a few times
    /// would inflate both tallies for a single viewer's single reaction.
    func setSpeedyReaction(_ type: ReactionType, replacing previous: ReactionType?, for id: String) {
        guard let index = speedys.firstIndex(where: { $0.id == id }) else { return }
        if let previous { bump(&speedys[index].reactions, previous, by: -1) }
        bump(&speedys[index].reactions, type, by: 1)
        store.upsert(speedys[index], kind: "speedy", id: id)
    }

    private func bump(_ reactions: inout Reactions, _ type: ReactionType, by delta: Int) {
        switch type {
        case .felt: reactions.felt = max(0, reactions.felt + delta)
        case .thought: reactions.thought = max(0, reactions.thought + delta)
        case .intrigued: reactions.intrigued = max(0, reactions.intrigued + delta)
        }
    }

    func toggleSpeedyFavourite(_ id: String) -> Bool {
        let nowFavourited: Bool
        if favouriteSpeedys.contains(id) {
            favouriteSpeedys.remove(id)
            nowFavourited = false
        } else {
            favouriteSpeedys.insert(id)
            nowFavourited = true
        }
        store.upsert(FavouriteRecord(ids: Array(favouriteSpeedys)), kind: "speedyFavourites", id: "all")
        return nowFavourited
    }

    func speedyFavourites() -> Set<String> { favouriteSpeedys }

    /// Venues are fixed reference data — a sponsor list, not user content — so
    /// they're read straight from the seed rather than persisted. Nothing in
    /// the app mutates them, so there'd be nothing for a stored copy to hold
    /// that the seed doesn't already say.
    func allVenues() -> [Venue] { MockSeed.venues }

    func allVenuePosts() -> [VenuePost] {
        if venuePosts.isEmpty { venuePosts = MockSeed.venuePosts }
        return venuePosts
    }

    func currentProfile() -> Profile? { profile }
    func setProfile(_ value: Profile) {
        profile = value
        store.upsert(value, kind: "profile", id: Self.profileKey)
    }
    func reaction(for postId: String) -> ReactionType? { reactions[postId] }
    func setReaction(_ type: ReactionType, for postId: String) {
        reactions[postId] = type
        store.upsert(ReactionRecord(postId: postId, type: type), kind: "reaction", id: postId)
    }
}

/// Wraps a reaction with the post id it belongs to, so it round-trips through
/// the store as one self-describing record instead of relying on the record's
/// storage key (which `PersistentStore` treats as opaque) to carry meaning.
private struct ReactionRecord: Codable {
    let postId: String
    let type: ReactionType
}

/// Favourited Speedy ids as one record. A set this small isn't worth a row
/// per entry — and storing it whole means toggling one off is an upsert rather
/// than a delete-by-id the store would have to look up first.
private struct FavouriteRecord: Codable {
    let ids: [String]
}

// MARK: - Mock implementations

public struct MockFeedService: FeedServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    // Ranked, not raw storage order — `allPosts()` still returns them
    // newest-first (that's what `posts(forUser:)` and the profile grid want,
    // where recency *is* the right order), but the main feed is where an
    // "algorithm" is expected, so this is the one place `FeedRanking` runs.
    public func feed() async throws -> [Post] { FeedRanking.rank(await backend.allPosts()) }
    public func posts(forUser userId: String) async throws -> [Post] { await backend.posts(for: userId) }

    public func createPost(
        challenge: String,
        content: String?,
        media: String?,
        username: String,
        avatar: String?
    ) async throws -> Post {
        let post = Post(
            id: "mock-post-\(UUID().uuidString.prefix(8))",
            userId: await backend.currentProfile()?.id ?? MockBackend.currentUserSentinel,
            author: username,
            avatar: avatar,
            challenge: challenge,
            content: content,
            media: media,
            spinCount: 1,
            reactions: Reactions(),
            createdAt: Date()
        )
        await backend.insert(post)
        return post
    }

    public func reaction(forPost postId: String) async throws -> ReactionType? {
        await backend.reaction(for: postId)
    }

    public func setReaction(_ type: ReactionType, postId: String, username: String, avatar: String?) async throws {
        await backend.setReaction(type, for: postId)
    }
}

public struct MockProfileService: ProfileServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func profile(id: String) async throws -> Profile? { await backend.currentProfile() }
    public func currentProfile() async throws -> Profile? { await backend.currentProfile() }

    public func createProfile(
        username: String,
        email: String?,
        hobbies: [String],
        studyFields: [String]
    ) async throws -> Profile {
        let profile = Profile(
            id: MockBackend.currentUserSentinel,
            username: username,
            email: email,
            hobbies: hobbies,
            studyFields: studyFields,
            xp: 0,
            level: 1,
            spinsLeft: 2,
            streak: 0
        )
        await backend.setProfile(profile)
        return profile
    }

    public func updateUsername(_ username: String) async throws {
        guard var profile = await backend.currentProfile() else { return }
        profile.username = username
        await backend.setProfile(profile)
    }

    public func updatePhoto(url: String) async throws {
        guard var profile = await backend.currentProfile() else { return }
        profile.photoURL = url
        await backend.setProfile(profile)
    }

    // No-op in mock: sign-out already resets the session, and there's no real
    // account to remove on-device.
    public func deleteAccount() async throws {}
}

public struct MockNotificationService: NotificationServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func notifications() async throws -> [AppNotification] { await backend.allNotifications() }
    public func unreadCount() async throws -> Int { await backend.unread() }
    public func markAllRead() async throws { await backend.markAllRead() }
}

public struct MockSocialService: SocialServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func friends() async throws -> [Friend] { MockSeed.friends }
    public func pendingRequests() async throws -> [ConnectionRequest] { await backend.allRequests() }
    public func acceptRequest(from userId: String) async throws { await backend.removeRequest(userId) }
    public func declineRequest(from userId: String) async throws { await backend.removeRequest(userId) }
    public func savedChallenges() async throws -> [SavedChallenge] { await backend.allSaved() }
    public func saveChallenge(_ challenge: String) async throws { await backend.save(challenge) }
    public func spindInbox() async throws -> [SpindChallenge] { await backend.allSpind() }
    public func acceptSpind(id: String) async throws { await backend.acceptSpind(id) }
    public func declineSpind(id: String) async throws { await backend.removeSpind(id) }
    // No-op in mock: there's only one local user, and the seeded inbox already
    // covers accept/decline testing. The send simply succeeds so the picker's
    // "Sent" confirmation shows.
    public func sendSpind(toUserId: String, challenge: String) async throws {}
}

public struct MockSpeedyService: SpeedyServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func speedys() async throws -> [Speedy] {
        await backend.allSpeedys()
    }

    public func setReaction(_ type: ReactionType, replacing previous: ReactionType?, speedyId: String) async throws {
        await backend.setSpeedyReaction(type, replacing: previous, for: speedyId)
    }

    public func toggleFavourite(speedyId: String) async throws -> Bool {
        await backend.toggleSpeedyFavourite(speedyId)
    }

    public func favourites() async throws -> Set<String> {
        await backend.speedyFavourites()
    }
}

public struct MockZoneService: ZoneServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func venues() async throws -> [Venue] { await backend.allVenues() }
    public func venuePosts() async throws -> [VenuePost] { await backend.allVenuePosts() }
}

public struct MockSearchService: SearchServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func users(matching query: String) async throws -> [SearchUser] {
        let q = query.lowercased()
        guard !q.isEmpty else { return [] }
        return MockSeed.users
            .filter { $0.username.lowercased().contains(q) }
            .map { SearchUser(id: $0.id, username: $0.username, photoURL: $0.avatar) }
    }

    public func challenges(matching query: String) async throws -> [Post] {
        let q = query.lowercased()
        guard !q.isEmpty else { return [] }
        return await backend.allPosts().filter {
            $0.challenge.lowercased().contains(q) || ($0.content ?? "").lowercased().contains(q)
        }
    }
}

public struct MockChatService: ChatServing {
    private let backend: MockBackend
    public init(backend: MockBackend = .shared) { self.backend = backend }

    public func messages(in conversation: AppRouter.ConversationRef) async throws -> [Message] {
        await backend.messages(in: conversation.id)
    }

    public func send(_ text: String, in conversation: AppRouter.ConversationRef) async throws -> Message {
        let message = Message(
            id: UUID().uuidString,
            conversationId: conversation.id,
            senderId: await backend.currentProfile()?.id ?? MockBackend.currentUserSentinel,
            text: text,
            sentAt: Date()
        )
        await backend.appendMessage(message, to: conversation.id)
        return message
    }

    public func conversations() async throws -> [Conversation] {
        await backend.allConversations().filter { !$0.isArchived }
    }

    public func archivedConversations() async throws -> [Conversation] {
        await backend.allConversations().filter(\.isArchived)
    }

    public func deleteConversation(id: String) async throws {
        await backend.removeConversation(id)
    }

    public func setMuted(_ muted: Bool, conversationId: String) async throws {
        await backend.setConversationMuted(muted, id: conversationId)
    }

    public func archiveConversation(id: String) async throws {
        await backend.archiveConversation(id)
    }

    public func unarchiveConversation(id: String) async throws {
        await backend.unarchiveConversation(id)
    }
}
