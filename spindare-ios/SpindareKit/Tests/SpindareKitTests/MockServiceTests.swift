import Testing
import Foundation
@testable import SpindareKit

// Each test gets its own MockBackend rather than sharing `.shared`, so they
// stay order-independent and can run in parallel.

@Suite
struct MockBackendTests {
    @Test("Seed feed is fully populated")
    func seedFeedIsPopulated() async throws {
        let feed = try await MockFeedService(backend: MockBackend()).feed()
        #expect(feed.count == 30)
    }

    @Test("A user's own posts stay in storage order (newest first), unranked")
    func userPostsAreNotRanked() async throws {
        // Only the main feed runs `FeedRanking` — a profile grid should show
        // exactly what you posted, in the order you posted it, not reshuffled
        // by how well each one did.
        let backend = MockBackend()
        await backend.bind(userId: "user_real", username: "kodi", email: nil)
        let posts = try await MockFeedService(backend: backend).posts(forUser: "user_real")

        let dates = posts.compactMap(\.createdAt)
        #expect(dates == dates.sorted(by: >))
    }

    @Test("Binding a Clerk id relabels the sentinel-authored seed posts")
    func bindingRewritesSentinelPosts() async throws {
        let backend = MockBackend()
        let service = MockFeedService(backend: backend)

        // Before binding, "your" posts are parked under the sentinel and would
        // fail an ownership check in the feed.
        let before = try await service.posts(forUser: "user_real")
        #expect(before.isEmpty)

        await backend.bind(userId: "user_real", username: "kodi", email: "k@example.com")

        let after = try await service.posts(forUser: "user_real")
        #expect(after.count == 4)
        #expect(after.allSatisfy { $0.author == "kodi" })

        // And nothing is left holding the sentinel.
        let feed = try await service.feed()
        #expect(!feed.contains { $0.userId == MockBackend.currentUserSentinel })
    }

    @Test("Binding twice does not duplicate or re-overwrite the profile")
    func bindingIsIdempotent() async throws {
        let backend = MockBackend()
        await backend.bind(userId: "user_real", username: "kodi", email: nil)
        await backend.bind(userId: "user_real", username: "someone_else", email: nil)

        let profile = try await MockProfileService(backend: backend).currentProfile()
        #expect(profile?.username == "kodi", "First bind should win")
    }

    @Test("Creating a post adds it to the feed and to the author's own posts")
    func createPostAppears() async throws {
        let backend = MockBackend()
        await backend.bind(userId: "user_real", username: "kodi", email: nil)
        let service = MockFeedService(backend: backend)

        let feedBefore = try await service.feed().count
        let ownBefore = try await service.posts(forUser: "user_real").count

        let created = try await service.createPost(
            challenge: "Stare at the sky",
            content: "did it",
            media: nil,
            username: "kodi",
            avatar: nil
        )

        let feed = try await service.feed()
        // Present, not necessarily first — `feed()` is ranked, and a
        // brand-new post with no engagement yet legitimately loses to
        // something both recent *and* already popular. "First" stopped being
        // the right thing to assert the moment ranking became real.
        #expect(feed.contains { $0.id == created.id })
        #expect(feed.count == feedBefore + 1)

        let own = try await service.posts(forUser: "user_real")
        #expect(own.count == ownBefore + 1)
        // `posts(forUser:)` is the profile grid — that one stays strictly
        // chronological regardless of engagement, so a just-created post
        // really is first there.
        #expect(own.first?.id == created.id)
    }

    @Test("Unread count drops to zero after marking all read")
    func markAllRead() async throws {
        let service = MockNotificationService(backend: MockBackend())
        #expect(try await service.unreadCount() == 3)

        try await service.markAllRead()
        #expect(try await service.unreadCount() == 0)
        #expect(try await service.notifications().allSatisfy(\.read))
    }

    @Test("Accepting a connection request removes it from the pending list")
    func acceptRequest() async throws {
        let backend = MockBackend()
        let service = MockSocialService(backend: backend)

        let pending = try await service.pendingRequests()
        #expect(pending.count == 1)

        try await service.acceptRequest(from: pending[0].id)
        #expect(try await service.pendingRequests().isEmpty)
    }

    @Test("Saving a challenge is idempotent")
    func saveChallengeDeduplicates() async throws {
        let service = MockSocialService(backend: MockBackend())
        #expect(try await service.savedChallenges().count == 2)

        try await service.saveChallenge("Stare at the sky for exactly 60 seconds.")
        try await service.saveChallenge("Stare at the sky for exactly 60 seconds.")
        #expect(try await service.savedChallenges().count == 3)
    }

    @Test("Reactions round-trip through the store")
    func reactionRoundTrip() async throws {
        let service = MockFeedService(backend: MockBackend())
        #expect(try await service.reaction(forPost: "mock-post-1") == nil)

        try await service.setReaction(.felt, postId: "mock-post-1", username: "kodi", avatar: nil)
        #expect(try await service.reaction(forPost: "mock-post-1") == .felt)
    }
}

@Suite
struct MockSearchTests {
    @Test("User search matches on a username substring")
    func userSearch() async throws {
        let results = try await MockSearchService(backend: MockBackend()).users(matching: "len")
        #expect(results.map(\.username) == ["lena.w"])
    }

    @Test("Challenge search covers both title and body")
    func challengeSearch() async throws {
        let service = MockSearchService(backend: MockBackend())
        #expect(try await !service.challenges(matching: "shadow").isEmpty)
        #expect(try await !service.challenges(matching: "pierogi").isEmpty)
    }

    @Test("Empty query returns nothing rather than everything")
    func emptyQuery() async throws {
        let service = MockSearchService(backend: MockBackend())
        #expect(try await service.users(matching: "   ".trimmingCharacters(in: .whitespaces)).isEmpty)
        #expect(try await service.challenges(matching: "").isEmpty)
    }
}

@Suite("Inboxing conversations")
struct ConversationArchiveTests {
    @Test("Archiving hides a thread from the main list without deleting it")
    func archiveHidesFromMainList() async throws {
        let service = MockChatService(backend: MockBackend())
        let before = try await service.conversations()
        let target = try #require(before.first)

        try await service.archiveConversation(id: target.id)

        let after = try await service.conversations()
        #expect(!after.contains { $0.id == target.id })
        #expect(after.count == before.count - 1)
    }

    @Test("An archived thread shows up in the archive — this is the actual fix")
    func archivedThreadIsFindable() async throws {
        let service = MockChatService(backend: MockBackend())
        let target = try #require(try await service.conversations().first)

        try await service.archiveConversation(id: target.id)

        let archived = try await service.archivedConversations()
        #expect(archived.contains { $0.id == target.id })
    }

    @Test("Unarchiving moves a thread back to the main list")
    func unarchiveRestoresToMainList() async throws {
        let service = MockChatService(backend: MockBackend())
        let target = try #require(try await service.conversations().first)

        try await service.archiveConversation(id: target.id)
        try await service.unarchiveConversation(id: target.id)

        let main = try await service.conversations()
        let archived = try await service.archivedConversations()
        #expect(main.contains { $0.id == target.id })
        #expect(!archived.contains { $0.id == target.id })
    }

    @Test("The transcript survives archiving — this is what makes it 'inbox', not 'delete'")
    func transcriptSurvivesArchiving() async throws {
        let backend = MockBackend()
        let service = MockChatService(backend: backend)
        let target = try #require(try await service.conversations().first)
        let ref = target.ref

        // Establish a transcript before archiving it away.
        let sent = try await service.send("hold onto this", in: ref)

        try await service.archiveConversation(id: target.id)

        let messages = try await service.messages(in: ref)
        #expect(messages.contains { $0.id == sent.id })
    }

    @Test("Deleting an archived thread removes it from the archive too, not just the main list")
    func deletingAnArchivedThreadRemovesItEntirely() async throws {
        let service = MockChatService(backend: MockBackend())
        let target = try #require(try await service.conversations().first)

        try await service.archiveConversation(id: target.id)
        try await service.deleteConversation(id: target.id)

        let archived = try await service.archivedConversations()
        #expect(!archived.contains { $0.id == target.id })
    }
}
