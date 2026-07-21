import Testing
import Foundation
@testable import SpindareKit

// Counts how many times the service is actually hit, which is the only way to
// tell a real debounce from the previous one — that version looked identical
// from the outside but ran a full search per keystroke.
private actor CountingSearchService: SearchServing {
    private(set) var userCalls = 0
    private(set) var queriesSeen: [String] = []
    private let users: [SearchUser]
    private let challenges: [Post]
    private let failure: Bool

    init(users: [SearchUser] = [], challenges: [Post] = [], failure: Bool = false) {
        self.users = users
        self.challenges = challenges
        self.failure = failure
    }

    struct Boom: Error {}

    func users(matching query: String) async throws -> [SearchUser] {
        userCalls += 1
        queriesSeen.append(query)
        if failure { throw Boom() }
        return users
    }

    func challenges(matching query: String) async throws -> [Post] {
        if failure { throw Boom() }
        return challenges
    }

    func callCount() -> Int { userCalls }
    func queries() -> [String] { queriesSeen }
}

private func sampleUser(_ name: String) -> SearchUser {
    SearchUser(id: "u-\(name)", username: name)
}

/// Comfortably longer than the 500ms debounce. Used only where a test is
/// asserting that something *didn't* happen — waiting longer than necessary
/// can't invalidate "no search was ever issued", so a fixed sleep is safe
/// there.
private let settleTime: Duration = .milliseconds(750)

/// Polls until `condition` holds, up to `timeout`.
///
/// Replaces a fixed `sleep(750ms)` in the tests that wait for a debounced
/// search to *land*. Those had 250ms of headroom over the 500ms debounce,
/// which is plenty on an idle machine and not nearly enough when the whole
/// suite runs in parallel — `Task.sleep` guarantees a minimum delay, not a
/// maximum, so under CPU contention the 500ms timer routinely resolved after
/// the 750ms one and the assertions ran against a still-loading view model.
/// Polling asserts the same conditions without racing the scheduler: the fast
/// path returns in ~20ms rather than always burning 750.
private func eventually(
    timeout: Duration = .seconds(10),
    _ condition: @MainActor () async -> Bool
) async {
    let deadline = ContinuousClock.now.advanced(by: timeout)
    while ContinuousClock.now < deadline {
        if await condition() { return }
        try? await Task.sleep(for: .milliseconds(20))
    }
}

@MainActor
@Suite("Search debounce and states")
struct SearchViewModelTests {

    @Test("A query below the minimum length never reaches the service")
    func tooShortStaysIdle() async throws {
        let service = CountingSearchService(users: [sampleUser("ada")])
        let vm = SearchViewModel(service: service)

        vm.query("a")
        try await Task.sleep(for: settleTime)

        #expect(vm.state == .idle)
        #expect(await service.callCount() == 0)
    }

    @Test("A burst of keystrokes produces exactly one search")
    func burstCollapsesToOne() async throws {
        // The regression this guards: without cancelling the prior task, this
        // ran five searches and the results of the *first* could land last.
        let service = CountingSearchService(users: [sampleUser("ada")])
        let vm = SearchViewModel(service: service)

        for prefix in ["sp", "spi", "spin", "spind", "spinda"] {
            vm.query(prefix)
        }
        // Once one search has landed the earlier four are already cancelled —
        // they were superseded before their debounce elapsed — so waiting for
        // the first is enough to assert there was exactly one.
        await eventually { await service.callCount() >= 1 }

        #expect(await service.callCount() == 1)
        #expect(await service.queries() == ["spinda"])
    }

    @Test("Results are reported once both queries return")
    func resultsPopulate() async throws {
        let service = CountingSearchService(users: [sampleUser("ada"), sampleUser("adam")])
        let vm = SearchViewModel(service: service)

        vm.query("ad")
        await eventually { vm.state != .loading }

        guard case .results(let users, _) = vm.state else {
            Issue.record("Expected results, got \(vm.state)")
            return
        }
        #expect(users.count == 2)
    }

    @Test("No matches reports empty rather than an blank results list")
    func emptyIsDistinctFromResults() async throws {
        let vm = SearchViewModel(service: CountingSearchService())

        vm.query("zzz")
        await eventually { vm.state != .loading }

        #expect(vm.state == .empty)
    }

    @Test("A failing service surfaces a message instead of an empty state")
    func failureIsDistinctFromEmpty() async throws {
        // These two are easy to conflate and mean opposite things to the user:
        // "nothing matched" versus "we couldn't look".
        let vm = SearchViewModel(service: CountingSearchService(failure: true))

        vm.query("ada")
        await eventually { vm.state != .loading }

        guard case .failed = vm.state else {
            Issue.record("Expected failure, got \(vm.state)")
            return
        }
    }

    @Test("Query goes to loading immediately, before the debounce elapses")
    func loadingIsImmediate() {
        // Feedback has to be instant even though the work is deferred.
        let vm = SearchViewModel(service: CountingSearchService())
        vm.query("ada")
        #expect(vm.state == .loading)
    }

    @Test("Falling back below the minimum cancels a pending search")
    func backspaceCancels() async throws {
        let service = CountingSearchService(users: [sampleUser("ada")])
        let vm = SearchViewModel(service: service)

        vm.query("ada")
        vm.query("a")           // backspaced before the debounce fired
        try await Task.sleep(for: settleTime)

        #expect(vm.state == .idle)
        #expect(await service.callCount() == 0)
    }

    @Test("Clearing resets to idle and drops pending work")
    func clearResets() async throws {
        let service = CountingSearchService(users: [sampleUser("ada")])
        let vm = SearchViewModel(service: service)

        vm.query("ada")
        vm.clear()
        try await Task.sleep(for: settleTime)

        #expect(vm.state == .idle)
        #expect(await service.callCount() == 0)
    }

    @Test("Whitespace is trimmed before the length check")
    func whitespaceDoesNotCount() async throws {
        let service = CountingSearchService()
        let vm = SearchViewModel(service: service)

        vm.query("  a  ")
        try await Task.sleep(for: settleTime)

        #expect(vm.state == .idle)
        #expect(await service.callCount() == 0)
    }
}
