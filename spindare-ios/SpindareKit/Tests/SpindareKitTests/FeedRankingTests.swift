import Testing
import Foundation
@testable import SpindareKit

@Suite("Feed ranking")
struct FeedRankingTests {
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    private func post(
        id: String,
        userId: String = "u",
        hoursAgo: Double,
        felt: Int = 0,
        thought: Int = 0,
        intrigued: Int = 0
    ) -> Post {
        Post(
            id: id,
            userId: userId,
            author: userId,
            challenge: "test",
            reactions: Reactions(felt: felt, thought: thought, intrigued: intrigued),
            createdAt: now.addingTimeInterval(-hoursAgo * 3600)
        )
    }

    @Test("With equal engagement, the newer post ranks higher")
    func recencyBreaksEngagementTies() {
        let older = post(id: "old", hoursAgo: 20, felt: 10)
        let newer = post(id: "new", hoursAgo: 1, felt: 10)

        let ranked = FeedRanking.rank([older, newer], now: now)
        #expect(ranked.map(\.id) == ["new", "old"])
    }

    @Test("A big engagement gap can outrank a small recency gap")
    func engagementCanOutrankRecency() {
        // Two posts an hour apart in age — a small recency difference — but
        // one has vastly more engagement. The algorithm exists specifically so
        // this can happen; if it can't, it's just chronological order with
        // extra steps.
        let quiet = post(id: "quiet", hoursAgo: 1, felt: 1)
        let loud = post(id: "loud", hoursAgo: 3, felt: 300, thought: 150, intrigued: 80)

        let ranked = FeedRanking.rank([quiet, loud], now: now)
        #expect(ranked.first?.id == "loud")
    }

    @Test("A week-old post with no engagement sinks below everything fresher")
    func staleAndQuietSinksToTheBottom() {
        let stale = post(id: "stale", hoursAgo: 7 * 24, felt: 1)
        let fresh = [
            post(id: "a", hoursAgo: 1, felt: 2),
            post(id: "b", hoursAgo: 5, felt: 1),
            post(id: "c", hoursAgo: 12, felt: 3),
        ]

        let ranked = FeedRanking.rank(fresh + [stale], now: now)
        #expect(ranked.last?.id == "stale")
    }

    @Test("Reactions that mean more than a tap are weighted higher than plain felt")
    func deeperReactionsWeighMoreThanFelt() {
        // Same total reaction count, same age — the composition should still
        // matter, or the three reaction types are cosmetic.
        let broad = post(id: "broad", hoursAgo: 5, thought: 10)
        let shallow = post(id: "shallow", hoursAgo: 5, felt: 10)

        #expect(FeedRanking.score(for: broad, now: now) > FeedRanking.score(for: shallow, now: now))
    }

    @Test("Score never goes negative or undefined for a post with zero engagement")
    func handlesZeroEngagement() {
        let empty = post(id: "empty", hoursAgo: 2)
        let score = FeedRanking.score(for: empty, now: now)
        #expect(score.isFinite)
        #expect(score > 0, "Recency alone must still contribute something")
    }

    @Test("A post with no createdAt is treated as posted right now, not as infinitely old")
    func missingDateDefaultsToNow() {
        let noDate = Post(id: "nodate", userId: "u", author: "u", challenge: "test", createdAt: nil)
        let score = FeedRanking.score(for: noDate, now: now)
        #expect(score.isFinite)
        // Should score the same as a post genuinely stamped `now` with the
        // same reactions — not silently discard the post to a score of zero.
        let stampedNow = post(id: "now", hoursAgo: 0)
        #expect(abs(score - FeedRanking.score(for: stampedNow, now: now)) < 0.0001)
    }

    @Test("Ranking is a reordering, never drops or invents posts")
    func rankingPreservesTheSetOfPosts() {
        let posts = (0..<12).map { post(id: "p\($0)", userId: "u\($0 % 4)", hoursAgo: Double($0)) }
        let ranked = FeedRanking.rank(posts, now: now)
        #expect(Set(ranked.map(\.id)) == Set(posts.map(\.id)))
        #expect(ranked.count == posts.count)
    }

    @Test("Same input scored against the same instant always ranks the same way")
    func rankingIsDeterministic() {
        let posts = (0..<10).map { post(id: "p\($0)", hoursAgo: Double($0) * 3, felt: $0 * 7 % 5) }
        let first = FeedRanking.rank(posts, now: now).map(\.id)
        let second = FeedRanking.rank(posts, now: now).map(\.id)
        #expect(first == second)
    }

    @Suite("Author de-clustering")
    struct DeclusteringTests {
        private func stub(_ id: String, userId: String) -> Post {
            Post(id: id, userId: userId, author: userId, challenge: "test")
        }

        @Test("Two-in-a-row from the same author is broken up when an alternative exists nearby")
        func breaksUpAdjacentSameAuthor() {
            let posts = [
                stub("1", userId: "a"),
                stub("2", userId: "a"),
                stub("3", userId: "b"),
                stub("4", userId: "c"),
            ]

            let result = FeedRanking.declustered(posts)
            #expect(result[0].userId != result[1].userId)
        }

        @Test("Leaves an already-alternating order untouched")
        func leavesGoodOrderAlone() {
            let posts = [
                stub("1", userId: "a"),
                stub("2", userId: "b"),
                stub("3", userId: "a"),
                stub("4", userId: "c"),
            ]

            #expect(FeedRanking.declustered(posts).map(\.id) == ["1", "2", "3", "4"])
        }

        @Test("No alternative within the lookahead window is left as-is rather than forced")
        func leavesItWhenNoAlternativeIsNear() {
            // Every post is the same author — there is nothing to swap toward,
            // at any lookahead.
            let posts = (0..<6).map { stub("\($0)", userId: "solo") }
            let result = FeedRanking.declustered(posts, lookahead: 4)
            #expect(result.map(\.id) == posts.map(\.id))
        }

        @Test("Never changes the set of posts, only their order")
        func preservesSetOfPosts() {
            let posts = [
                stub("1", userId: "a"), stub("2", userId: "a"), stub("3", userId: "a"),
                stub("4", userId: "b"), stub("5", userId: "c"),
            ]
            let result = FeedRanking.declustered(posts)
            #expect(Set(result.map(\.id)) == Set(posts.map(\.id)))
        }
    }
}
