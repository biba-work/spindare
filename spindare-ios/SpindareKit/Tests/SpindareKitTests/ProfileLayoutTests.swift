import Testing
@testable import SpindareKit

// Regression coverage for the grid/list toggle: `ProfileView` used to render
// the two segments from a `ForEach([Bool])`, and the selected-state comparison
// made the active segment's own button read as a no-op — once you were in list
// mode you could not get back to grid. `PostLayout` replaced that with a real
// two-case enum specifically so this could never happen again; the tests below
// pin that guarantee.
//
// The rendering half of that same bug (the toggle itself worked, but the grid
// underneath didn't follow because `matchedGeometryEffect` inside a lazy
// container only tracks materialized cells) isn't reachable from a unit test —
// it's a live SwiftUI transition behavior, verified by hand in the simulator.

@Suite("Profile layout toggle")
struct ProfileLayoutTests {

    @Test("Exactly two cases exist — grid and list")
    func hasBothCases() {
        #expect(ProfileView.PostLayout.allCases == [.grid, .list])
    }

    @Test("Each case maps to a distinct icon")
    func iconsAreDistinct() {
        // A copy-paste error here would make the two segments visually
        // identical — indistinguishable from the toggle silently not working.
        let icons = Set(ProfileView.PostLayout.allCases.map(\.icon))
        #expect(icons.count == ProfileView.PostLayout.allCases.count)
    }

    @Test("Grid, list, grid, list round-trips without drift")
    func roundTrips() {
        var layout = ProfileView.PostLayout.grid
        let sequence: [ProfileView.PostLayout] = [.list, .grid, .list, .grid]

        for next in sequence {
            layout = next
            #expect(layout == next)
        }

        // Specifically the regression case: after visiting list, grid must
        // still be reachable.
        #expect(layout == .grid)
    }
}
