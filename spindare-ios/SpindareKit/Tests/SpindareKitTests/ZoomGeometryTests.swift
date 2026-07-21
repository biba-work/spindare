import Testing
import CoreGraphics
@testable import SpindareKit

// The zoom maths is the part of the viewer with no visual tell when it's wrong —
// a slightly-off pan bound just lets the photo drift somewhere it shouldn't,
// which is easy to miss by eye and obvious to assert.

@Suite("Zoom geometry")
struct ZoomGeometryTests {

    private let screen = CGSize(width: 400, height: 800)

    // MARK: - Fitting

    @Test("A wide photo pins to the container's width")
    func wideFits() {
        // 2:1 into a 1:2 container — width-limited, so bars top and bottom.
        let size = ZoomGeometry.fittedSize(aspectRatio: 2, in: screen)
        #expect(size.width == 400)
        #expect(size.height == 200)
    }

    @Test("A tall photo pins to the container's height")
    func tallFits() {
        // 1:4 is narrower than the 1:2 container, so height is the limit.
        let size = ZoomGeometry.fittedSize(aspectRatio: 0.25, in: screen)
        #expect(size.height == 800)
        #expect(size.width == 200)
    }

    @Test("A degenerate aspect ratio yields zero rather than a divide-by-zero")
    func degenerateFit() {
        #expect(ZoomGeometry.fittedSize(aspectRatio: 0, in: screen) == .zero)
        #expect(ZoomGeometry.fittedSize(aspectRatio: 2, in: .zero) == .zero)
    }

    // MARK: - Pan bounds

    @Test("At 1x there is nowhere to pan")
    func noPanAtRest() {
        let content = ZoomGeometry.fittedSize(aspectRatio: 2, in: screen)
        let limit = ZoomGeometry.panLimit(contentSize: content, scale: 1, container: screen)
        #expect(limit == .zero)
    }

    @Test("Panning is limited to the overhang on each axis")
    func limitIsHalfTheOverhang() {
        // 400x200 at 2x is 800x400 inside a 400x800 container: 400pt of
        // horizontal overhang (200 each side), none vertically.
        let content = CGSize(width: 400, height: 200)
        let limit = ZoomGeometry.panLimit(contentSize: content, scale: 2, container: screen)
        #expect(limit.width == 200)
        #expect(limit.height == 0)
    }

    @Test("An axis that still fits cannot be panned even when the other can")
    func perAxisIndependence() {
        // This is the case that a single scalar bound gets wrong: a zoomed wide
        // photo must slide sideways but stay locked vertically.
        let content = CGSize(width: 400, height: 200)
        let panned = ZoomGeometry.clamp(
            CGSize(width: 1000, height: 1000),
            contentSize: content,
            scale: 2,
            container: screen
        )
        #expect(panned.width == 200)
        #expect(panned.height == 0)
    }

    @Test("Clamping is symmetric in both directions")
    func clampSymmetry() {
        let content = CGSize(width: 400, height: 200)
        let negative = ZoomGeometry.clamp(
            CGSize(width: -1000, height: 0),
            contentSize: content,
            scale: 2,
            container: screen
        )
        #expect(negative.width == -200)
    }

    @Test("An offset already inside the bounds passes through untouched")
    func inBoundsUnchanged() {
        let content = CGSize(width: 400, height: 200)
        let offset = CGSize(width: 50, height: 0)
        let clamped = ZoomGeometry.clamp(offset, contentSize: content, scale: 2, container: screen)
        #expect(clamped == offset)
    }

    // MARK: - Tap-anchored zoom

    @Test("Double-tapping dead centre does not shift the photo")
    func centreTapIsNeutral() {
        let content = ZoomGeometry.fittedSize(aspectRatio: 0.5, in: screen)
        let offset = ZoomGeometry.offsetToCenter(
            on: CGPoint(x: 200, y: 400),
            scale: 2,
            contentSize: content,
            container: screen
        )
        #expect(offset == .zero)
    }

    @Test("Double-tapping off-centre pulls that point toward the middle")
    func offCentreTapPullsIn() {
        // A 1:2 photo exactly fills the container, so at 2x there is 400pt of
        // vertical overhang and 200pt of pan available each way.
        let content = ZoomGeometry.fittedSize(aspectRatio: 0.5, in: screen)
        let offset = ZoomGeometry.offsetToCenter(
            on: CGPoint(x: 200, y: 200),
            scale: 2,
            contentSize: content,
            container: screen
        )
        // Tapped 200pt above centre → the image moves down to bring it in.
        #expect(offset.height > 0)
        #expect(offset.width == 0)
    }

    @Test("A tap near the edge is clamped rather than exposing a gap")
    func edgeTapStaysBounded() {
        // Without clamping, tapping the very corner would translate the image
        // far enough to leave background showing on the opposite side.
        let content = ZoomGeometry.fittedSize(aspectRatio: 0.5, in: screen)
        let offset = ZoomGeometry.offsetToCenter(
            on: CGPoint(x: 0, y: 0),
            scale: 2,
            contentSize: content,
            container: screen
        )
        let limit = ZoomGeometry.panLimit(contentSize: content, scale: 2, container: screen)
        #expect(abs(offset.width) <= limit.width)
        #expect(abs(offset.height) <= limit.height)
    }

    // MARK: - Scale rules

    @Test("Snap-back sits between rest and the double-tap step")
    func scaleConstantsAreOrdered() {
        // If snapBack ever exceeded doubleTapScale, a double-tap would
        // immediately spring back and zoom would appear broken.
        #expect(ZoomGeometry.minScale < ZoomGeometry.snapBackScale)
        #expect(ZoomGeometry.snapBackScale < ZoomGeometry.doubleTapScale)
        #expect(ZoomGeometry.doubleTapScale < ZoomGeometry.maxScale)
    }
}
