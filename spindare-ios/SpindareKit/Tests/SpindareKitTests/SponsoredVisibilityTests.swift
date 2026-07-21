import Testing
import Foundation
@testable import SpindareKit

// The delay exists so a sponsored post can't broadcast that its author is
// standing at a specific venue *right now*. That makes every test here a
// safety test, not a behaviour test: the interesting direction is always
// "could this leak early", and the assertions are written to catch a
// permissive bug rather than a restrictive one.

@Suite("Sponsored post visibility")
struct SponsoredVisibilityTests {
    private let now = Date(timeIntervalSince1970: 1_700_000_000)
    private let me = "user_me"
    private let them = "user_them"

    private func speedy(
        author: String,
        secondsAgo: TimeInterval?,
        sponsored: Bool
    ) -> Speedy {
        Speedy(
            id: "s1",
            userId: author,
            author: author,
            challenge: "c",
            detail: "d",
            createdAt: secondsAgo.map { now.addingTimeInterval(-$0) },
            sponsor: sponsored ? Sponsor(id: "sp", name: "Iron Yard", venueId: "venue-1") : nil
        )
    }

    // MARK: The gate

    @Test("An unsponsored post is never delayed, however new")
    func unsponsoredIsAlwaysVisible() {
        let fresh = speedy(author: them, secondsAgo: 0, sponsored: false)
        #expect(SponsoredVisibility.isVisible(fresh, viewerId: me, now: now))
    }

    @Test("Someone else's brand-new sponsored post is hidden")
    func othersFreshSponsoredIsHidden() {
        let fresh = speedy(author: them, secondsAgo: 5, sponsored: true)
        #expect(!SponsoredVisibility.isVisible(fresh, viewerId: me, now: now))
    }

    @Test("Someone else's sponsored post becomes visible after five minutes")
    func othersAgedSponsoredIsVisible() {
        let aged = speedy(author: them, secondsAgo: 301, sponsored: true)
        #expect(SponsoredVisibility.isVisible(aged, viewerId: me, now: now))
    }

    @Test("You always see your own sponsored post immediately")
    func ownSponsoredIsImmediate() {
        let mine = speedy(author: me, secondsAgo: 0, sponsored: true)
        #expect(SponsoredVisibility.isVisible(mine, viewerId: me, now: now))
    }

    // MARK: Boundaries and the fail-closed direction

    @Test("One second short of the window is still hidden")
    func justUnderTheWindowIsHidden() {
        let almost = speedy(author: them, secondsAgo: 299, sponsored: true)
        #expect(!SponsoredVisibility.isVisible(almost, viewerId: me, now: now))
    }

    @Test("Exactly five minutes counts as elapsed")
    func exactBoundaryIsVisible() {
        let exact = speedy(author: them, secondsAgo: 300, sponsored: true)
        #expect(SponsoredVisibility.isVisible(exact, viewerId: me, now: now))
    }

    @Test("A sponsored post with no timestamp stays hidden rather than being waved through")
    func missingTimestampFailsClosed() {
        // We cannot prove five minutes elapsed, so the only safe answer is no.
        let undated = speedy(author: them, secondsAgo: nil, sponsored: true)
        #expect(!SponsoredVisibility.isVisible(undated, viewerId: me, now: now))
    }

    @Test("A future-dated post is hidden, not accidentally treated as very old")
    func futureDateFailsClosed() {
        // A clock skew or a bad server timestamp must not invert the check —
        // this is the classic sign-error that turns a delay into an instant
        // reveal.
        let future = speedy(author: them, secondsAgo: -600, sponsored: true)
        #expect(!SponsoredVisibility.isVisible(future, viewerId: me, now: now))
    }

    @Test("An unidentified viewer gets no early access to anyone's post")
    func nilViewerIsTreatedAsAStranger() {
        // Signed out, or an id we failed to load. Matching `nil` against the
        // author must never succeed.
        let fresh = speedy(author: them, secondsAgo: 5, sponsored: true)
        #expect(!SponsoredVisibility.isVisible(fresh, viewerId: nil, now: now))
    }

    @Test("An empty viewer id never matches an author, even an empty one")
    func emptyViewerIdIsNotAnAuthorMatch() {
        // Defends against `router.userId ?? ""` at a call site quietly turning
        // "nobody" into "the author" for a post whose userId is also blank.
        let orphan = speedy(author: "", secondsAgo: 5, sponsored: true)
        #expect(!SponsoredVisibility.isVisible(orphan, viewerId: "", now: now))
    }

    // MARK: Feed filtering

    @Test("Filtering a feed holds only the sponsored posts that aren't ready")
    func filteringHoldsOnlyWhatItShould() {
        let feed = [
            speedy(author: them, secondsAgo: 5, sponsored: false),    // fine, unsponsored
            speedy(author: them, secondsAgo: 5, sponsored: true),     // held
            speedy(author: them, secondsAgo: 600, sponsored: true),   // released
            speedy(author: me, secondsAgo: 1, sponsored: true),       // own, immediate
        ]

        let visible = SponsoredVisibility.visible(feed, viewerId: me, now: now)
        #expect(visible.count == 3)
    }

    @Test("Countdown reports remaining time while held, and nothing once released")
    func countdownTracksRemaining() {
        let held = speedy(author: them, secondsAgo: 60, sponsored: true)
        #expect(SponsoredVisibility.secondsUntilVisible(held, now: now) == 240)

        let released = speedy(author: them, secondsAgo: 600, sponsored: true)
        #expect(SponsoredVisibility.secondsUntilVisible(released, now: now) == nil)

        let unsponsored = speedy(author: them, secondsAgo: 1, sponsored: false)
        #expect(SponsoredVisibility.secondsUntilVisible(unsponsored, now: now) == nil)
    }
}

@Suite("Reaction shuffling")
struct ReactionLayoutTests {

    @Test("Every order contains all three reactions exactly once")
    func ordersArePermutations() {
        // A shuffle that drops or duplicates a reaction would silently make one
        // un-pickable on some posts.
        for id in (0..<200).map({ "post-\($0)" }) {
            let order = ReactionLayout.order(for: id)
            #expect(order.count == 3)
            #expect(Set(order) == Set(ReactionType.allCases))
        }
    }

    @Test("The same id always produces the same order")
    func orderIsStableForAnId() {
        // Buttons must not move under a finger between renders.
        let first = ReactionLayout.order(for: "speedy-42")
        for _ in 0..<50 {
            #expect(ReactionLayout.order(for: "speedy-42") == first)
        }
    }

    @Test("Different ids produce genuinely different orders")
    func ordersVaryAcrossIds() {
        // If this collapsed to one ordering the whole feature would be a no-op
        // that still *looked* implemented.
        let orders = Set((0..<200).map { ReactionLayout.order(for: "post-\($0)").map(\.rawValue).joined() })
        #expect(orders.count > 1)
        #expect(orders.count <= 6, "There are only six possible orderings of three items")
    }

    @Test("All six orderings are reachable")
    func everyPermutationGetsUsed() {
        // A weak hash could leave some positions never used, which would make
        // the shuffle partially predictable.
        let seen = Set((0..<600).map { ReactionLayout.order(for: "id-\($0)").map(\.rawValue).joined() })
        #expect(seen.count == 6)
    }

    @Test("The hash is a fixed algorithm, not Swift's per-process-seeded one")
    func hashIsStableAcrossProcesses() {
        // Pinned literals. `String.hashValue` is randomly seeded per launch, so
        // if someone swaps FNV-1a back out for it, reaction positions would
        // silently change on every app restart — and every other test here
        // would still pass, because they all run in one process. These values
        // are what catches that.
        #expect(ReactionLayout.stableHash("") == 2_166_136_261)
        #expect(ReactionLayout.stableHash("a") == 0xE40C_292C)
        #expect(ReactionLayout.stableHash("foobar") == 0xBF9C_F968)
    }

    @Test("Exactly six permutations are generated, with no duplicates")
    func permutationTableIsComplete() {
        #expect(ReactionLayout.permutations.count == 6)
        #expect(Set(ReactionLayout.permutations.map { $0.map(\.rawValue).joined() }).count == 6)
    }
}
