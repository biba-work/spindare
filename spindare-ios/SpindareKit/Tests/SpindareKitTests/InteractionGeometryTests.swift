import Testing
import Foundation
import SwiftUI
@testable import SpindareKit

// The maths behind this round of interaction work.
//
// All of it shares a property that makes it worth pinning: it's only ever wrong
// *during* a gesture. A tab indicator that lags the page, a swipe that arms
// before its ring fills, a photo that resists in the wrong direction — none of
// these are visible in a screenshot of the resting state, which is the only
// state a screenshot can capture.

@Suite("Tab indicator")
struct TabIndicatorTests {

    @Test("Sits over each tab at rest")
    func restsOnTabs() {
        let bar = TabIndicator.at(progress: 0, totalWidth: 300, tabCount: 3)
        #expect(bar.offset == 0)
        #expect(bar.width == 100)

        #expect(TabIndicator.at(progress: 1, totalWidth: 300, tabCount: 3).offset == 100)
        #expect(TabIndicator.at(progress: 2, totalWidth: 300, tabCount: 3).offset == 200)
    }

    @Test("Tracks continuously between tabs rather than snapping")
    func interpolates() {
        // The actual bug: bound to a committed selection, this value could only
        // ever be 0, 100 or 200. Half a swipe has to land halfway.
        let midway = TabIndicator.at(progress: 0.5, totalWidth: 300, tabCount: 3)
        #expect(midway.offset == 50)

        let quarter = TabIndicator.at(progress: 1.25, totalWidth: 300, tabCount: 3)
        #expect(quarter.offset == 125)
    }

    @Test("Inset narrows the bar and shifts it inward")
    func respectsInset() {
        let bar = TabIndicator.at(progress: 0, totalWidth: 300, tabCount: 3, inset: 10)
        #expect(bar.offset == 10)
        #expect(bar.width == 80)
    }

    @Test("An over-scroll bounce can't push it off the end of the bar")
    func clampsOverscroll() {
        // A paged scroll view reports negative offsets while rubber-banding at
        // the first page, and past the last index at the other end.
        #expect(TabIndicator.at(progress: -0.4, totalWidth: 300, tabCount: 3).offset == 0)
        #expect(TabIndicator.at(progress: 2.6, totalWidth: 300, tabCount: 3).offset == 200)
    }

    @Test("Degenerate geometry doesn't divide by zero")
    func handlesEmptyLayout() {
        #expect(TabIndicator.at(progress: 1, totalWidth: 0, tabCount: 3) == TabIndicator(offset: 0, width: 0))
        #expect(TabIndicator.at(progress: 1, totalWidth: 300, tabCount: 0) == TabIndicator(offset: 0, width: 0))
    }
}

@Suite("Image viewer gestures")
struct ImageViewerGestureTests {

    @Test("Panning inside the bounds tracks the finger exactly")
    func oneToOneInsideBounds() {
        let content = CGSize(width: 400, height: 400)
        let container = CGSize(width: 200, height: 200)
        // At 2×, the image is 800pt across in a 200pt window: 300pt of travel
        // each way.
        let resisted = ZoomGeometry.resisted(
            CGSize(width: 100, height: 0),
            contentSize: content,
            scale: 2,
            container: container
        )
        #expect(resisted.width == 100, "Inside the limit the image must not lag the touch")
    }

    @Test("Past the bounds it resists instead of stopping dead")
    func resistsOutsideBounds() {
        let content = CGSize(width: 400, height: 400)
        let container = CGSize(width: 200, height: 200)
        let limit = ZoomGeometry.panLimit(contentSize: content, scale: 2, container: container)

        let resisted = ZoomGeometry.resisted(
            CGSize(width: limit.width + 200, height: 0),
            contentSize: content,
            scale: 2,
            container: container
        )

        // The old behaviour was a hard clamp — exactly `limit.width`, image
        // frozen under a moving finger. It has to keep moving...
        #expect(resisted.width > limit.width, "Motion must continue past the bound")
        // ...but not keep up.
        #expect(resisted.width < limit.width + 200, "Motion past the bound must be damped")
    }

    @Test("Resistance is symmetric")
    func resistsBothDirections() {
        #expect(ZoomGeometry.rubberBand(100, dimension: 400) == -ZoomGeometry.rubberBand(-100, dimension: 400))
    }

    @Test("Resistance grows sub-linearly")
    func resistanceDecays() {
        let near = ZoomGeometry.rubberBand(50, dimension: 400)
        let far = ZoomGeometry.rubberBand(100, dimension: 400)
        // Twice the pull must give less than twice the travel, or it isn't
        // resistance — it's just a slower constant.
        #expect(far < near * 2)
        #expect(far > near)
    }

    @Test("Nothing to resist at rest")
    func noResistanceAtZero() {
        #expect(ZoomGeometry.rubberBand(0, dimension: 400) == 0)
    }

    @Test("Dismiss progress ramps from untouched to fully pulled")
    func dismissProgressRamps() {
        #expect(ZoomGeometry.dismissProgress(pullDown: 0) == 0)
        #expect(ZoomGeometry.dismissProgress(pullDown: 200, reference: 400) == 0.5)
        // Clamped: past the reference it stays at 1 rather than fading the
        // backdrop through transparent into a negative opacity.
        #expect(ZoomGeometry.dismissProgress(pullDown: 900, reference: 400) == 1)
    }

    @Test("Pulling up reads as a dismissal too")
    func dismissProgressIsSymmetric() {
        #expect(ZoomGeometry.dismissProgress(pullDown: -200, reference: 400) == 0.5)
    }
}

@Suite("Swipe actions")
struct SwipeActionGeometryTests {
    private let rowWidth: CGFloat = 400
    private let actionCount = 3

    // Scanned rather than computed from a duplicated formula: the internal
    // resistance constant is private on purpose, so these walk the public
    // `state(translation:rowWidth:actionCount:)` function itself to find where
    // each stage transition actually happens. That's also what makes them
    // robust to retuning the constants without becoming a change-detector.
    private func scan(step: CGFloat = 1, upTo maxPull: CGFloat = 900) -> [(pull: CGFloat, state: SwipeActionState)] {
        stride(from: CGFloat(0), through: maxPull, by: step).map {
            ($0, SwipeActionGeometry.state(translation: -$0, rowWidth: rowWidth, actionCount: actionCount))
        }
    }

    @Test("A rightward drag on a closed row does nothing")
    func ignoresWrongDirection() {
        let state = SwipeActionGeometry.state(translation: 80, rowWidth: rowWidth, actionCount: actionCount)
        #expect(state.revealed == 0)
        #expect(state.isDestructive == false)
    }

    @Test("Stage one opens fully before the finger has travelled the buttons' own width")
    func stageOneIsAccelerated() {
        // This is the fix: a full swipe has to show the actions immediately,
        // not have them trail in at 1:1 while you're still dragging.
        let resting = SwipeActionGeometry.restingWidth(actionCount: actionCount)
        let openPull = SwipeActionGeometry.openPull(actionCount: actionCount)

        #expect(openPull < resting, "Opening must accelerate, or there is nothing to fix")

        let atOpen = SwipeActionGeometry.state(translation: -openPull, rowWidth: rowWidth, actionCount: actionCount)
        #expect(abs(atOpen.revealed - resting) < 0.01)
        #expect(atOpen.isDestructive == false)
        #expect(atOpen.armProgress == 0)
    }

    @Test("Past full reveal, the row resists rather than tracking 1:1")
    func stageTwoIsDamped() {
        let openPull = SwipeActionGeometry.openPull(actionCount: actionCount)
        let resting = SwipeActionGeometry.restingWidth(actionCount: actionCount)

        let pulledFurther = openPull + 60
        let state = SwipeActionGeometry.state(translation: -pulledFurther, rowWidth: rowWidth, actionCount: actionCount)

        // The extra travel beyond `openPull` must show up as less than 60pt of
        // extra reveal — some resistance, not a 1:1 continuation.
        #expect(state.revealed > resting)
        #expect(state.revealed - resting < 60)
    }

    @Test("Reaching the destructive stage never arms it immediately")
    func armingHasRoomToNotice() {
        // Find the first pull, scanning coarsely, where the row goes
        // destructive — that's the moment the spec cares about: the ring must
        // still read as empty right then, not already filling.
        guard let takeover = scan().first(where: { $0.state.isDestructive }) else {
            Issue.record("Never reached the destructive stage within the scan range")
            return
        }
        #expect(takeover.state.armProgress < 0.15, "Arming must not begin the instant the red stage takes over")
        #expect(takeover.state.isArmed == false)
    }

    @Test("Arm progress climbs monotonically and only reaches 1 with real distance")
    func armingIsGradual() {
        let progressions = scan(step: 4).map(\.state.armProgress)
        #expect(progressions == progressions.sorted(), "A further pull must never un-arm the row")

        guard let firstFull = progressions.firstIndex(where: { $0 >= 1 }) else {
            Issue.record("Ring never reaches full within the scan range")
            return
        }
        // It has to take *some* distance to fill, not complete on the same
        // pull that crossed into the destructive stage.
        #expect(firstFull > 5, "Fully arming on the very first destructive sample means there's no time to notice")
    }

    @Test("Arm progress never exceeds a full ring")
    func armProgressClamps() {
        let absurd = SwipeActionGeometry.state(translation: -5000, rowWidth: rowWidth, actionCount: actionCount)
        #expect(absurd.armProgress == 1)
        #expect(absurd.isArmed)
    }

    @Test("A small wobble closes; a real reveal stays open")
    func restingPullSnapsToIntent() {
        let wobble = SwipeActionGeometry.state(translation: -5, rowWidth: rowWidth, actionCount: actionCount)
        #expect(SwipeActionGeometry.restingPull(for: wobble, actionCount: actionCount) == 0)

        let openPull = SwipeActionGeometry.openPull(actionCount: actionCount)
        let opened = SwipeActionGeometry.state(translation: -openPull, rowWidth: rowWidth, actionCount: actionCount)
        #expect(SwipeActionGeometry.restingPull(for: opened, actionCount: actionCount) == openPull)
    }

    @Test("A released over-swipe that never armed drops back to plain-open, not closed")
    func abandonedOverSwipeReopensRatherThanCloses() {
        // Pulled well past takeover but short of arming.
        guard let short = scan().first(where: { $0.state.isDestructive && $0.state.armProgress < 0.5 }) else {
            Issue.record("No sample landed in the destructive-but-unarmed range")
            return
        }
        let resting = SwipeActionGeometry.restingPull(for: short.state, actionCount: actionCount)
        #expect(resting == SwipeActionGeometry.openPull(actionCount: actionCount))
    }
}

@Suite("Conversation ordering")
struct ConversationOrderingTests {
    private func conversation(_ name: String, minutesAgo: Double) -> Conversation {
        Conversation(
            id: "conv-\(name)",
            otherUserId: name,
            otherUsername: name,
            lastMessageAt: Date().addingTimeInterval(-minutesAgo * 60)
        )
    }

    @Test("Most recent first")
    func sortsByRecency() {
        let sorted = [
            conversation("old", minutesAgo: 500),
            conversation("newest", minutesAgo: 1),
            conversation("middle", minutesAgo: 60),
        ].sortedByRecency()

        #expect(sorted.map(\.otherUsername) == ["newest", "middle", "old"])
    }

    @Test("Ties break deterministically rather than reshuffling on reload")
    func stableOnTies() {
        let sameMoment = Date()
        let threads = [
            Conversation(id: "b", otherUserId: "b", otherUsername: "bea", lastMessageAt: sameMoment),
            Conversation(id: "a", otherUserId: "a", otherUsername: "abe", lastMessageAt: sameMoment),
        ]

        #expect(threads.sortedByRecency().map(\.otherUsername) == ["abe", "bea"])
        #expect(threads.reversed().sortedByRecency().map(\.otherUsername) == ["abe", "bea"])
    }
}

@Suite("Image compression")
struct ImageCompressionTests {

    @Test("Oversized images are scaled to the long edge, keeping aspect ratio")
    func scalesDownPreservingRatio() {
        let fitted = ImageCompression.fittedSize(for: CGSize(width: 4032, height: 3024))
        #expect(fitted.width == 1200)
        #expect(fitted.height == 900, "4:3 must stay 4:3")
    }

    @Test("Portrait scales on its own long edge")
    func scalesPortrait() {
        let fitted = ImageCompression.fittedSize(for: CGSize(width: 3024, height: 4032))
        #expect(fitted.height == 1200)
        #expect(fitted.width == 900)
    }

    @Test("Small images are left alone rather than upscaled")
    func leavesSmallImagesAlone() {
        let small = CGSize(width: 600, height: 400)
        #expect(ImageCompression.fittedSize(for: small) == small)
    }

    @Test("An image exactly at the limit isn't resized")
    func boundaryIsNotResized() {
        let exact = CGSize(width: 1200, height: 800)
        #expect(ImageCompression.fittedSize(for: exact) == exact)
    }

    @Test("Degenerate sizes pass through instead of dividing by zero")
    func handlesZeroSize() {
        #expect(ImageCompression.fittedSize(for: .zero) == .zero)
    }
}

@Suite("Hold-to-grow send")
struct SendEmphasisTests {

    @Test("A tap sends at the base size")
    func tapIsBaseSize() {
        #expect(SendEmphasis.size(heldFor: 0) == SendEmphasis.base)
        #expect(SendEmphasis.isEmphasised(SendEmphasis.base) == false)
    }

    @Test("Holding grows the text, and stops at the ceiling")
    func growsThenCaps() {
        let brief = SendEmphasis.size(heldFor: 0.4)
        let longer = SendEmphasis.size(heldFor: 1.0)

        #expect(brief > SendEmphasis.base)
        #expect(longer > brief)
        #expect(SendEmphasis.size(heldFor: 10) == SendEmphasis.max, "Holding forever must not grow forever")
    }

    @Test("The ramp eases in, so small increases are actually selectable")
    func rampIsEased() {
        // Linear would put the halfway point at exactly half the range. Eased,
        // the first half of the hold covers much less than half the growth,
        // which is what makes a small bump possible to stop on.
        let half = SendEmphasis.size(heldFor: SendEmphasis.rampDuration / 2)
        let linearHalf = (SendEmphasis.base + SendEmphasis.max) / 2
        #expect(half < linearHalf)
    }
}

@Suite("Voice metering")
struct VoiceMeteringTests {

    @Test("Silence still draws a visible bar")
    func silenceHasFloor() {
        let quiet = VoiceRecorder.normalise(-160)
        #expect(quiet > 0, "A zero-height bar reads as missing data, not as silence")
        #expect(quiet < 0.1)
    }

    @Test("Loud input reaches the top of the scale")
    func loudReachesCeiling() {
        #expect(VoiceRecorder.normalise(0) == 1)
    }

    @Test("Speech-level input lands in the usable middle of the range")
    func speechIsLegible() {
        // The reason for clamping at -50dB rather than the true -160 floor: on
        // the full range, ordinary speech compresses into the top few percent
        // and the waveform draws as a flat line.
        let speech = VoiceRecorder.normalise(-25)
        #expect(speech > 0.3)
        #expect(speech < 0.95)
    }

    @Test("Louder input always draws a taller bar")
    func isMonotonic() {
        let steps: [Float] = [-60, -40, -30, -20, -10, 0]
        let heights = steps.map { VoiceRecorder.normalise($0) }
        #expect(heights == heights.sorted())
    }
}
