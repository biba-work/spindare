import Foundation
import Observation

// Debounced search over the same service layer everything else uses.
//
// The first version of this fabricated its results from the query string
// ("Drink foo", "@foofan") and never touched `SearchServing` at all, so search
// appeared to work while matching nothing real. It also spawned a fresh
// unstructured Task per keystroke and relied on `Task.isCancelled` to debounce —
// but nothing ever cancelled those tasks, so every keystroke ran a full search
// 300ms later. Holding the previous task and cancelling it is what actually
// makes a debounce a debounce.

@MainActor
@Observable
public final class SearchViewModel {

    public enum State: Equatable {
        /// Below the minimum query length — the prompt, not a result.
        case idle
        case loading
        case results(users: [SearchUser], challenges: [Post])
        case empty
        case failed(String)
    }

    public private(set) var state: State = .idle

    /// Two characters. One matches most of the database and makes the dropdown
    /// noise; requiring three loses real two-letter usernames.
    public static let minimumQueryLength = 2
    public static let debounce: Duration = .milliseconds(500)

    private let service: any SearchServing
    private var inFlight: Task<Void, Never>?

    public init(service: any SearchServing = AppEnvironment.searchService) {
        self.service = service
    }

    // No `deinit` cancel — `deinit` is nonisolated and can't touch main-actor
    // state. The pending task captures `self` weakly and does nothing once the
    // view model is gone, so there is nothing to clean up; the view calls
    // `clear()` on disappear regardless.

    /// Call on every keystroke. Cheap — the work is deferred and superseded.
    public func query(_ raw: String) {
        // Cancelling first is what collapses a burst of keystrokes into one
        // search rather than one search per character.
        inFlight?.cancel()

        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= Self.minimumQueryLength else {
            state = .idle
            return
        }

        state = .loading
        inFlight = Task { [weak self] in
            try? await Task.sleep(for: Self.debounce)
            guard !Task.isCancelled else { return }
            await self?.run(trimmed)
        }
    }

    public func clear() {
        inFlight?.cancel()
        inFlight = nil
        state = .idle
    }

    private func run(_ query: String) async {
        do {
            // Both queries at once — they hit independent endpoints and running
            // them in series doubles the time to first result for no reason.
            async let users = service.users(matching: query)
            async let challenges = service.challenges(matching: query)
            let (foundUsers, foundChallenges) = try await (users, challenges)

            guard !Task.isCancelled else { return }

            state = foundUsers.isEmpty && foundChallenges.isEmpty
                ? .empty
                : .results(users: foundUsers, challenges: foundChallenges)
        } catch {
            guard !Task.isCancelled else { return }
            state = .failed("Couldn't search. Check your connection.")
        }
    }
}
