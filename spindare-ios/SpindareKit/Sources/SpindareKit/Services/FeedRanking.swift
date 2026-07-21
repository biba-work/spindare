import Foundation

// A rough stand-in for what a real ranked feed does: instead of the strict
// reverse-chronological order the mock backend stores posts in, weigh recency
// against engagement so a post that's taking off can surface ahead of
// something merely newer, the way Instagram's feed (recency + predicted
// interest, engagement as its proxy here) behaves — then run a short pass so
// the same author doesn't appear twice in a row, which a pure score sort alone
// doesn't guarantee.
//
// This only ever reorders what `MockBackend` already has; it invents nothing
// and drops nothing; there is still an explicit "mock data" boundary — this is
// the mock feed's ranking, not a claim about what a real backend would do.

public enum FeedRanking {
    /// Hours for the recency component to halve. Long enough that a post from
    /// this morning still clearly outranks one from three days ago on recency
    /// alone; short enough that a week-old post's recency contribution is
    /// effectively zero, leaving engagement to decide whether it's still
    /// worth surfacing at all.
    static let recencyHalfLifeHours: Double = 30

    static let recencyWeight: Double = 1.0
    static let engagementWeight: Double = 1.0

    // Reaction weights favour the two reactions that mean someone stopped and
    // considered the post, over the equivalent of a like — mirroring how real
    // feed algorithms weigh comments/saves above a tap-through like.
    static let feltWeight: Double = 1.0
    static let thoughtWeight: Double = 1.6
    static let intriguedWeight: Double = 1.4

    /// Higher is more relevant now. Unbounded above, so it composes cleanly
    /// with `sorted(by:)` rather than needing normalisation against the rest
    /// of the feed first.
    public static func score(for post: Post, now: Date) -> Double {
        let ageHours = max(0, now.timeIntervalSince(post.createdAt ?? now) / 3600)
        let recency = exp(-ageHours / recencyHalfLifeHours)

        let weightedReactions = Double(post.reactions.felt) * feltWeight
            + Double(post.reactions.thought) * thoughtWeight
            + Double(post.reactions.intrigued) * intriguedWeight
        // log-compressed so one runaway-popular post doesn't make engagement
        // the only axis that matters — the gap between 10 and 100 reactions
        // should count for more than the gap between 1000 and 1090.
        let engagement = log(1 + weightedReactions)

        return recencyWeight * recency + engagementWeight * engagement
    }

    /// Scores every post against `now`, sorts, then de-clusters by author.
    /// `now` is a parameter rather than read internally so the ordering is
    /// reproducible in a test — the score itself is a function of elapsed
    /// time, so the only way to pin it is to fix what "now" was.
    public static func rank(_ posts: [Post], now: Date = Date()) -> [Post] {
        let scored = posts
            .enumerated()
            .sorted { a, b in
                let scoreA = score(for: a.element, now: now)
                let scoreB = score(for: b.element, now: now)
                // Ties keep their original relative order rather than being
                // decided by id or left to `sorted`'s unspecified tie-breaking
                // — otherwise the exact same input can rank differently across
                // two calls with no score actually having changed.
                if scoreA != scoreB { return scoreA > scoreB }
                return a.offset < b.offset
            }
            .map(\.element)

        return declustered(scored)
    }

    /// Whenever a post's author matches the one directly above it, swaps in
    /// the nearest upcoming post by a different author, within a short
    /// lookahead. Deliberately a small nudge on top of the score order, not a
    /// second competing sort — swapping across the *whole* remaining feed to
    /// find "the best" alternate author would undo the ranking pass to fix
    /// what is otherwise a one-in-a-row cosmetic issue.
    static func declustered(_ posts: [Post], lookahead: Int = 4) -> [Post] {
        guard posts.count > 2 else { return posts }
        var result = posts

        for index in 1..<result.count {
            guard result[index].userId == result[index - 1].userId else { continue }

            let searchEnd = min(result.count, index + 1 + lookahead)
            guard let swapIndex = (index + 1..<searchEnd)
                .first(where: { result[$0].userId != result[index - 1].userId })
            else { continue }

            result.swapAt(index, swapIndex)
        }

        return result
    }
}
