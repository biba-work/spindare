import Testing
import Foundation
@testable import SpindareKit

// Covers the optimistic-reaction bookkeeping. The backend enforces one reaction
// per user per post, so the local counts must model a swap rather than an
// unbounded increment.

/// Fails every write, to exercise the rollback path.
private struct FailingFeedService: FeedServing {
    struct Boom: Error {}
    private let inner = MockFeedService(backend: MockBackend())

    func feed() async throws -> [Post] { try await inner.feed() }
    func posts(forUser userId: String) async throws -> [Post] { try await inner.posts(forUser: userId) }
    func createPost(challenge: String, content: String?, media: String?, username: String, avatar: String?) async throws -> Post {
        try await inner.createPost(challenge: challenge, content: content, media: media, username: username, avatar: avatar)
    }
    func reaction(forPost postId: String) async throws -> ReactionType? { nil }
    func setReaction(_ type: ReactionType, postId: String, username: String, avatar: String?) async throws {
        throw Boom()
    }
}

@MainActor
@Suite
struct FeedViewModelReactionTests {
    private func loadedModel() async -> FeedViewModel {
        let model = FeedViewModel(
            feedService: MockFeedService(backend: MockBackend()),
            socialService: MockSocialService(backend: MockBackend())
        )
        await model.loadFeed()
        return model
    }

    private func counts(_ model: FeedViewModel, _ postId: String) -> Reactions {
        model.posts.first { $0.id == postId }?.reactions ?? Reactions()
    }

    @Test("First reaction increments exactly once")
    func firstReaction() async {
        let model = await loadedModel()
        let before = counts(model, "mock-post-1").felt

        await model.react(to: "mock-post-1", type: .felt, username: "kodi", avatar: nil)

        #expect(counts(model, "mock-post-1").felt == before + 1)
        #expect(model.myReactions["mock-post-1"] == .felt)
    }

    @Test("Tapping the same reaction repeatedly does not keep incrementing")
    func repeatedTapsDoNotAccumulate() async {
        let model = await loadedModel()
        let before = counts(model, "mock-post-1").felt

        for _ in 0..<5 {
            await model.react(to: "mock-post-1", type: .felt, username: "kodi", avatar: nil)
        }

        // The server records one reaction, so the UI must too.
        #expect(counts(model, "mock-post-1").felt == before + 1)
    }

    @Test("Switching reaction moves the count instead of adding a second")
    func switchingReactionMovesTheCount() async {
        let model = await loadedModel()
        let feltBefore = counts(model, "mock-post-1").felt
        let thoughtBefore = counts(model, "mock-post-1").thought

        await model.react(to: "mock-post-1", type: .felt, username: "kodi", avatar: nil)
        await model.react(to: "mock-post-1", type: .thought, username: "kodi", avatar: nil)

        #expect(counts(model, "mock-post-1").felt == feltBefore)
        #expect(counts(model, "mock-post-1").thought == thoughtBefore + 1)
        #expect(model.myReactions["mock-post-1"] == .thought)
    }

    @Test("Reactions on different posts are tracked independently")
    func perPostIsolation() async {
        let model = await loadedModel()

        await model.react(to: "mock-post-1", type: .felt, username: "kodi", avatar: nil)
        await model.react(to: "mock-post-2", type: .intrigued, username: "kodi", avatar: nil)

        #expect(model.myReactions["mock-post-1"] == .felt)
        #expect(model.myReactions["mock-post-2"] == .intrigued)
    }

    @Test("A failed write rolls the optimistic count back")
    func rollbackOnFailure() async {
        let model = FeedViewModel(
            feedService: FailingFeedService(),
            socialService: MockSocialService(backend: MockBackend())
        )
        await model.loadFeed()
        let before = counts(model, "mock-post-1").felt

        await model.react(to: "mock-post-1", type: .felt, username: "kodi", avatar: nil)

        #expect(counts(model, "mock-post-1").felt == before, "Count should revert")
        #expect(model.myReactions["mock-post-1"] == nil, "Reaction should not be recorded")
    }

    @Test("Counts never go negative")
    func noNegativeCounts() async {
        let model = await loadedModel()
        // mock-post-4 has thought: 41; drive a swap chain and confirm sanity.
        await model.react(to: "mock-post-4", type: .thought, username: "kodi", avatar: nil)
        await model.react(to: "mock-post-4", type: .felt, username: "kodi", avatar: nil)
        await model.react(to: "mock-post-4", type: .intrigued, username: "kodi", avatar: nil)

        let final = counts(model, "mock-post-4")
        #expect(final.felt >= 0 && final.thought >= 0 && final.intrigued >= 0)
        #expect(final.intrigued == 17 + 1)
        #expect(final.thought == 41)
    }
}
