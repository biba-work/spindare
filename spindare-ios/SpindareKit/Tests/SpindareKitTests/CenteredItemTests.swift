import Testing
import CoreGraphics
@testable import SpindareKit

// The scroll haptic has no visual signal to screenshot-verify, so the pure
// selection logic it depends on gets pinned here instead.

@Suite("Centered scroll item")
struct CenteredItemTests {

    private let viewportHeight: CGFloat = 800

    @Test("Picks the frame whose centre is closest to the viewport midpoint")
    func picksClosestToMidpoint() {
        // Viewport midpoint is 400. "b" straddles it; "a" and "c" don't.
        let frames = [
            "a": CGRect(x: 0, y: -900, width: 300, height: 300),
            "b": CGRect(x: 0, y: 250, width: 300, height: 300),
            "c": CGRect(x: 0, y: 900, width: 300, height: 300),
        ]
        #expect(centeredItem(among: frames, viewportHeight: viewportHeight) == "b")
    }

    @Test("An empty feed has no centered item")
    func emptyFeedHasNoCenter() {
        #expect(centeredItem(among: [:], viewportHeight: viewportHeight) == nil)
    }

    @Test("A frame entirely off-screen above is excluded even if numerically closest")
    func offscreenAboveExcluded() {
        // "above" never overlaps the viewport at all; "visible" does, however
        // imperfectly, and must win even though its centre is farther in raw
        // distance from the midpoint than "above"'s would be if it were let in.
        let frames = [
            "above": CGRect(x: 0, y: -2000, width: 300, height: 300),
            "visible": CGRect(x: 0, y: 700, width: 300, height: 300),
        ]
        #expect(centeredItem(among: frames, viewportHeight: viewportHeight) == "visible")
    }

    @Test("A frame entirely off-screen below is excluded")
    func offscreenBelowExcluded() {
        let frames = [
            "visible": CGRect(x: 0, y: 100, width: 300, height: 300),
            "below": CGRect(x: 0, y: 5000, width: 300, height: 300),
        ]
        #expect(centeredItem(among: frames, viewportHeight: viewportHeight) == "visible")
    }

    @Test("A frame merely touching the viewport edge is excluded, not just near-zero overlap")
    func edgeTouchingIsExcluded() {
        // maxY == 0 means the frame's bottom edge exactly meets the top of the
        // viewport — zero actual overlap, should not qualify.
        let frames = [
            "touching": CGRect(x: 0, y: -300, width: 300, height: 300),
            "real": CGRect(x: 0, y: 100, width: 300, height: 300),
        ]
        #expect(centeredItem(among: frames, viewportHeight: viewportHeight) == "real")
    }

    @Test("A single on-screen item is always the answer regardless of distance")
    func singleItemAlwaysWins() {
        let frames = ["only": CGRect(x: 0, y: 780, width: 300, height: 300)]
        #expect(centeredItem(among: frames, viewportHeight: viewportHeight) == "only")
    }

    @Test("A tall item spanning the whole viewport still wins over a sliver")
    func tallItemSpanningViewport() {
        let frames = [
            "tall": CGRect(x: 0, y: -100, width: 300, height: 1000),
            "sliver": CGRect(x: 0, y: 790, width: 300, height: 20),
        ]
        // "tall"'s midY is 400 (dead centre); "sliver"'s is 800, far off.
        #expect(centeredItem(among: frames, viewportHeight: viewportHeight) == "tall")
    }
}
