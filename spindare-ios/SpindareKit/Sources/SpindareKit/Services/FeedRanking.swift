import Foundation

// A rough stand-in for what a real ranked feed does: instead of strict
// reverse-chronological order, weigh recency against engagement so a post
// that's taking off can surface ahead of something merely newer, the way
// Instagram's feed (recency + predicted interest, engagement as its proxy
// here) behaves — then run a short pass so the same author doesn't appear
// twice in a row, which a pure score sort alone doesn't guarantee.
//
// Generic over `Rankable` rather than tied to `Post` so the same engine
// scores Speedys too — a short-video FYP and a photo/text feed both reduce to
// "how recent, how engaged with, whose content is this," and duplicating the
// scoring math per surface would just mean the two silently drift out of sync
// as one gets tuned and the other doesn't.
public protocol Rankable {
    var userId: String { get }
    var reactions: Reactions { get }
    var createdAt: Date? { get }
}

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
    public static func score(for item: some Rankable, now: Date) -> Double {
        let ageHours = max(0, now.timeIntervalSince(item.createdAt ?? now) / 3600)
        let recency = exp(-ageHours / recencyHalfLifeHours)

        let weightedReactions = Double(item.reactions.felt) * feltWeight
            + Double(item.reactions.thought) * thoughtWeight
            + Double(item.reactions.intrigued) * intriguedWeight
        // log-compressed so one runaway-popular post doesn't make engagement
        // the only axis that matters — the gap between 10 and 100 reactions
        // should count for more than the gap between 1000 and 1090.
        let engagement = log(1 + weightedReactions)

        return recencyWeight * recency + engagementWeight * engagement
    }

    /// Scores every item against `now`, sorts, then de-clusters by author.
    /// `now` is a parameter rather than read internally so the ordering is
    /// reproducible in a test — the score itself is a function of elapsed
    /// time, so the only way to pin it is to fix what "now" was.
    public static func rank<T: Rankable>(_ items: [T], now: Date = Date()) -> [T] {
        let scored = items
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

    /// Whenever an item's author matches the one directly above it, swaps in
    /// the nearest upcoming item by a different author, within a short
    /// lookahead. Deliberately a small nudge on top of the score order, not a
    /// second competing sort — swapping across the *whole* remaining feed to
    /// find "the best" alternate author would undo the ranking pass to fix
    /// what is otherwise a one-in-a-row cosmetic issue.
    static func declustered<T: Rankable>(_ items: [T], lookahead: Int = 4) -> [T] {
        guard items.count > 2 else { return items }
        var result = items

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
