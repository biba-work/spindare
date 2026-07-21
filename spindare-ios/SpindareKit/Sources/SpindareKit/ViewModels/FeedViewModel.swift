import SwiftUI

// Port of src/screens/FeedScreen.tsx (1061 LOC).
//
// The RN version is a FlatList of PostItems with pull-to-refresh, reaction
// handling, and navigation to profiles/challenges. This is the SwiftUI
// equivalent using LazyVStack in a ScrollView.

@MainActor
@Observable
public final class FeedViewModel {
    public var posts: [Post] = []
    public var isLoading = false
    public var isRefreshing = false
    public var error: String?

    private let feedService: any FeedServing
    private let socialService: any SocialServing

    public var savedChallenges: [SavedChallenge] = []

    /// The signed-in user's own reaction per post. The backend enforces one
    /// reaction per user per post (`@@unique([userId, postId])`), so the local
    /// optimistic counts have to model a swap, not an unbounded increment.
    public private(set) var myReactions: [String: ReactionType] = [:]

    public init(
        feedService: any FeedServing = AppEnvironment.feedService,
        socialService: any SocialServing = AppEnvironment.socialService
    ) {
        self.feedService = feedService
        self.socialService = socialService
    }

    @MainActor
    public func loadFeed() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            async let fetchedPosts = feedService.feed()
            async let fetchedSaved = socialService.savedChallenges()
            posts = try await fetchedPosts
            savedChallenges = try await fetchedSaved
        } catch {
            self.error = "Couldn't load feed. Pull to retry."
        }

        isLoading = false
    }

    @MainActor
    public func refresh() async {
        isRefreshing = true
        do {
            posts = try await feedService.feed()
        } catch {
            self.error = "Refresh failed."
        }
        isRefreshing = false
    }

    @MainActor
    public func react(to postId: String, type: ReactionType, username: String, avatar: String?) async {
        let previous = myReactions[postId]

        // Tapping the reaction you already hold is a no-op rather than another
        // increment — otherwise five taps read as +5 locally while the server
        // still records exactly one.
        guard previous != type else { return }

        // Apply optimistically first so the tap feels instant, then reconcile.
        applyReaction(type, replacing: previous, on: postId)
        myReactions[postId] = type

        do {
            try await feedService.setReaction(type, postId: postId, username: username, avatar: avatar)
        } catch {
            // Roll back rather than leaving the UI asserting something the
            // server rejected.
            applyReaction(previous, replacing: type, on: postId)
            myReactions[postId] = previous
        }
    }

    /// Moves one reaction from `old` to `new` on a post, either side optional.
    private func applyReaction(_ new: ReactionType?, replacing old: ReactionType?, on postId: String) {
        guard let index = posts.firstIndex(where: { $0.id == postId }) else { return }
        var post = posts[index]

        if let old { bump(&post.reactions, old, by: -1) }
        if let new { bump(&post.reactions, new, by: 1) }

        posts[index] = post
    }

    private func bump(_ reactions: inout Reactions, _ type: ReactionType, by delta: Int) {
        switch type {
        case .felt: reactions.felt = max(0, reactions.felt + delta)
        case .thought: reactions.thought = max(0, reactions.thought + delta)
        case .intrigued: reactions.intrigued = max(0, reactions.intrigued + delta)
        }
    }

    public func saveChallenge(_ challenge: String) async {
        do {
            try await socialService.saveChallenge(challenge)
            savedChallenges = try await socialService.savedChallenges()
        } catch {
            // Non-critical
        }
    }
}
