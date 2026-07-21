import Testing
import Foundation
@testable import SpindareKit

// The countdown drives whether a saved challenge reads as calm or as about to
// lapse, so the six-hour boundary and the unit rollovers are worth pinning.
// Every case passes an explicit `now` — reading the wall clock in a test makes
// the six-hour cases flaky by construction.

@Suite("Countdown formatting")
struct CountdownTests {

    private let now = Date(timeIntervalSinceReferenceDate: 800_000_000)

    private func at(_ hours: Double, minutes: Double = 0) -> Date {
        now.addingTimeInterval(hours * 3600 + minutes * 60)
    }

    @Test("No expiry reads as no deadline and is never urgent")
    func noDeadline() {
        let result = Countdown.remaining(until: nil, now: now)
        #expect(result.label == "No deadline")
        #expect(result.urgent == false)
    }

    @Test("A past expiry reads as expired")
    func expired() {
        let result = Countdown.remaining(until: at(-1), now: now)
        #expect(result.label == "Expired")
        #expect(result.urgent)
    }

    @Test("Over a day shows days and hours")
    func daysAndHours() {
        let result = Countdown.remaining(until: at(30), now: now)
        #expect(result.label == "1d 6h left")
        #expect(result.urgent == false)
    }

    @Test("Under a day shows hours and minutes")
    func hoursAndMinutes() {
        let result = Countdown.remaining(until: at(7, minutes: 30), now: now)
        #expect(result.label == "7h 30m left")
        #expect(result.urgent == false)
    }

    @Test("Under an hour drops to minutes and is always urgent")
    func minutesOnly() {
        let result = Countdown.remaining(until: at(0, minutes: 42), now: now)
        #expect(result.label == "42m left")
        #expect(result.urgent)
    }

    // MARK: - The six-hour boundary

    @Test("Just outside six hours is not yet urgent")
    func justOutsideThreshold() {
        // 6h 1m — the calm side of the boundary.
        let result = Countdown.remaining(until: at(6, minutes: 1), now: now)
        #expect(result.urgent == false)
    }

    @Test("Just inside six hours is urgent")
    func justInsideThreshold() {
        // 5h 59m — this is the flip, and an inclusive-versus-exclusive slip here
        // would leave the pill calm right up to the last five hours.
        let result = Countdown.remaining(until: at(5, minutes: 59), now: now)
        #expect(result.urgent)
        #expect(result.label == "5h 59m left")
    }

    @Test("Exactly six hours stays calm")
    func exactlyThreshold() {
        // Boundary convention: urgency begins strictly *under* six hours.
        let result = Countdown.remaining(until: at(6), now: now)
        #expect(result.urgent == false)
    }

    // MARK: - Rollovers

    @Test("Exactly 24 hours rolls into the days form")
    func dayRollover() {
        let result = Countdown.remaining(until: at(24), now: now)
        #expect(result.label == "1d 0h left")
    }

    @Test("Exactly one hour uses the hours form, not minutes")
    func hourRollover() {
        let result = Countdown.remaining(until: at(1), now: now)
        #expect(result.label == "1h 0m left")
        // Inside six hours, so urgent — the hours form is not a calm signal.
        #expect(result.urgent)
    }

    @Test("A whole 48-hour save starts calm at two days")
    func freshSave() {
        let result = Countdown.remaining(until: at(48), now: now)
        #expect(result.label == "2d 0h left")
        #expect(result.urgent == false)
    }
}
