import Foundation

// When a sponsored post becomes visible to other people.
//
// A sponsored challenge is tied to a physical venue on the Zone map. That
// means a post completing one is, implicitly, a statement that its author was
// standing in a specific real place — and if it appeared the instant it was
// posted, anyone watching the feed would know they are *there right now*.
// Holding other people's sponsored posts for five minutes breaks the live
// link between "this post exists" and "this person is at this address".
//
// This is a safety gate, so it is written to fail *closed*: every branch that
// can't positively establish "enough time has passed" hides the post. A bug
// that hides a post too long is a cosmetic annoyance; a bug that reveals one
// too early defeats the entire reason this exists. Every rule below is chosen
// with that asymmetry in mind, and the tests pin the closed direction
// specifically.

public enum SponsoredVisibility {
    /// How long a sponsored post stays hidden from everyone else.
    public static let delay: TimeInterval = 5 * 60

    /// Whether `speedy` should be shown to `viewerId` at `now`.
    ///
    /// - Parameters:
    ///   - viewerId: the signed-in user. `nil` (not signed in, or unknown) is
    ///     treated as "not the author" — a viewer we can't identify must not
    ///     be given the author's early access.
    public static func isVisible(_ speedy: Speedy, viewerId: String?, now: Date) -> Bool {
        // Unsponsored posts are ordinary content and aren't gated at all —
        // they carry no venue, so there's no location to protect.
        guard speedy.isSponsored else { return true }
        return isVisible(authorId: speedy.userId, createdAt: speedy.createdAt, viewerId: viewerId, now: now)
    }

    /// The core gate, independent of what kind of item is being shown — a
    /// sponsored Speedy or a completed-challenge venue pin. Both a Speedy and a
    /// `VenuePost` reduce to "whose is it, and how old is it," so the rule lives
    /// here once. Venue posts are always sponsored (tied to a place), so they
    /// call this directly rather than through the Speedy overload's guard.
    public static func isVisible(authorId: String, createdAt: Date?, viewerId: String?, now: Date) -> Bool {
        // You always see your own immediately. You already know where you are;
        // withholding it would just look broken to the one person the delay
        // cannot protect.
        if let viewerId, !viewerId.isEmpty, authorId == viewerId { return true }

        // Someone else's sponsored item: it has to be old enough. A missing
        // timestamp means we cannot prove five minutes have passed, so it
        // stays hidden rather than being waved through on a guess.
        guard let createdAt else { return false }

        // `>=` so the boundary itself counts as elapsed, and a clock that
        // reports a *future* creation date yields a negative interval — which
        // correctly fails this check rather than wrapping into a large
        // positive one.
        return now.timeIntervalSince(createdAt) >= delay
    }

    /// Convenience filter for a whole feed.
    public static func visible(_ speedys: [Speedy], viewerId: String?, now: Date = Date()) -> [Speedy] {
        speedys.filter { isVisible($0, viewerId: viewerId, now: now) }
    }

    /// Seconds until `speedy` becomes visible, or nil if it already is (or
    /// never will be, for the missing-timestamp case). Drives the "posting in
    /// N minutes" note the author sees on their own pending post.
    public static func secondsUntilVisible(_ speedy: Speedy, now: Date) -> TimeInterval? {
        guard speedy.isSponsored, let createdAt = speedy.createdAt else { return nil }
        let remaining = delay - now.timeIntervalSince(createdAt)
        return remaining > 0 ? remaining : nil
    }
}
