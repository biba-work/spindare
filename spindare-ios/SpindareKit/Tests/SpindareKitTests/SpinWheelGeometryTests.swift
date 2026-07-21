import Testing
import Foundation
@testable import SpindareKit

// Exercises the real WheelGeometry rather than a copy of its maths.
//
// The RN original computed the visual wheel from a 48-segment constant and the
// winning result from `options.length`, so the pointer and the announced
// outcome were resolved on different geometries and silently disagreed. These
// tests exist so that can't return.

@Suite
struct WheelGeometryTests {
    private let twenty = WheelGeometry(optionCount: 20)

    @Test("Ticks and outcomes are independent")
    func ticksAreDecorative() {
        // 48 ticks regardless of how many outcomes there are — that's the point,
        // the dial is abstract.
        #expect(WheelGeometry.tickCount == 48)
        #expect(WheelGeometry(optionCount: 8).segmentAngle == 45)
        #expect(WheelGeometry(optionCount: 20).segmentAngle == 18)
    }

    @Test("Four cardinal accent ticks")
    func accentTicks() {
        let accents = (0..<WheelGeometry.tickCount)
            .filter { $0 % WheelGeometry.accentEvery == 0 }
        #expect(accents.count == 4)
    }

    @Test("A whole turn lands on the same outcome")
    func fullTurnIsIdentity() {
        for rotation in stride(from: 0.0, to: 360.0, by: 7.5) {
            #expect(
                twenty.landedIndex(atRotation: rotation)
                    == twenty.landedIndex(atRotation: rotation + 360),
                "rotation \(rotation) should match \(rotation + 360)"
            )
        }
    }

    @Test("Many turns behave like the final offset alone")
    func multipleTurnsIgnored() {
        for turns in 4...8 {
            let extra = Double(turns) * 360
            #expect(twenty.landedIndex(atRotation: 42 + extra)
                    == twenty.landedIndex(atRotation: 42))
        }
    }

    @Test("Every rotation resolves to an in-bounds index")
    func alwaysInBounds() {
        // Guards the subscript in land() — out of range would crash.
        for count in [3, 8, 20, 175] {
            let geo = WheelGeometry(optionCount: count)
            for rotation in stride(from: -2000.0, through: 5000.0, by: 13.7) {
                let index = geo.landedIndex(atRotation: rotation)
                #expect(index >= 0 && index < count,
                        "count \(count), rotation \(rotation) gave \(index)")
            }
        }
    }

    @Test("Negative rotation normalises rather than going out of range")
    func negativeRotation() {
        #expect(twenty.landedIndex(atRotation: -360) == twenty.landedIndex(atRotation: 0))
        #expect(twenty.landedIndex(atRotation: -18) >= 0)
    }

    @Test("Landing is stable across the width of a segment")
    func stableWithinSegment() {
        let base = twenty.segmentAngle * 3 + twenty.segmentAngle / 2
        let expected = twenty.landedIndex(atRotation: base)
        for delta in stride(from: -7.0, through: 7.0, by: 1.0) {
            #expect(twenty.landedIndex(atRotation: base + delta) == expected)
        }
    }

    @Test("A single-option wheel never goes out of range")
    func degenerateWheel() {
        let one = WheelGeometry(optionCount: 1)
        #expect(one.landedIndex(atRotation: 123.4) == 0)
        // Guards against a divide-by-zero if options is ever empty.
        #expect(WheelGeometry(optionCount: 0).landedIndex(atRotation: 99) == 0)
    }
}

@Suite
struct WheelAngleTests {
    @Test("Degrees wrap into 0..<360")
    func wrapping() {
        #expect(0.0.wrappedDegrees == 0)
        #expect(370.0.wrappedDegrees == 10)
        #expect((-10.0).wrappedDegrees == 350)
        #expect((-730.0).wrappedDegrees == 350)
    }

    @Test("Angle delta takes the short way round the seam")
    func seamCrossing() {
        // Dragging from 350° to 10° is +20°, not -340°. Getting this wrong
        // makes the wheel jump a full turn as your finger crosses the top.
        #expect(350.0.angleDelta(to: 10) == 20)
        #expect(10.0.angleDelta(to: 350) == -20)
        #expect(0.0.angleDelta(to: 90) == 90)
        #expect(0.0.angleDelta(to: 180).magnitude == 180)
    }

    @Test("Delta is always within ±180")
    func deltaBounded() {
        for a in stride(from: -720.0, through: 720.0, by: 17.0) {
            for b in stride(from: -720.0, through: 720.0, by: 53.0) {
                #expect(a.angleDelta(to: b).magnitude <= 180.0001)
            }
        }
    }
}

@Suite
struct WheelPhysicsTests {
    @Test("A slow flick is a tap, not a spin")
    func tapThreshold() {
        // Below the threshold the wheel should not move at all — the original
        // treats a gentle touch as a press on the dial.
        let gentle = WheelPhysics.velocityMagnitude(vx: 40, vy: 30)   // → 5
        #expect(gentle < WheelPhysics.tapVelocityThreshold)

        let flick = WheelPhysics.velocityMagnitude(vx: 900, vy: 1200) // → 150
        #expect(flick > WheelPhysics.tapVelocityThreshold)
    }

    @Test("Velocity decays monotonically toward rest")
    func decayConverges() {
        var v = 600.0
        var steps = 0
        while v > WheelPhysics.restingVelocity, steps < 10_000 {
            let next = WheelPhysics.decayed(v, over: 1.0 / 60)
            #expect(next < v, "decay must be strictly decreasing")
            v = next
            steps += 1
        }
        #expect(v <= WheelPhysics.restingVelocity, "spin must eventually stop")
        #expect(steps < 10_000, "and stop in reasonable time")
    }

    @Test("Coasts noticeably longer than the RN default would")
    func decelerationTuning() {
        // 0.998/ms against RN's 0.997 default — about twice the coast.
        let ours = WheelPhysics.decayed(600, over: 1.0)
        let rnDefault = 600 * pow(0.997, 1000.0)
        #expect(ours > rnDefault)
    }
}
