import Testing
@testable import SpindareKit

@Suite("Voice memo recording limit")
struct VoiceRecordingLimitTests {

    @Test("Ordinary recording, well under the limit")
    func earlyRecordingIsJustRecording() {
        #expect(VoiceRecordingLimit.phase(elapsed: 0) == .recording)
        #expect(VoiceRecordingLimit.phase(elapsed: 10) == .recording)
        #expect(VoiceRecordingLimit.phase(elapsed: 19.9) == .recording)
    }

    @Test("The banner appears exactly 11 seconds before the cap")
    func bannerAppearsAtTheRightMoment() {
        // 31 - 11 = 20.
        #expect(VoiceRecordingLimit.phase(elapsed: 19.99) == .recording)
        #expect(VoiceRecordingLimit.phase(elapsed: 20) == .endingSoon)
    }

    @Test("The banner holds for its full duration before the countdown takes over")
    func bannerHoldsForItsWindow() {
        #expect(VoiceRecordingLimit.phase(elapsed: 20) == .endingSoon)
        #expect(VoiceRecordingLimit.phase(elapsed: 23.4) == .endingSoon)
    }

    @Test("The countdown takes over once the banner's window elapses")
    func countdownTakesOverAfterBanner() {
        // 20 + 3.5 = 23.5.
        guard case .countdown = VoiceRecordingLimit.phase(elapsed: 23.5) else {
            Issue.record("Expected countdown phase at 23.5s")
            return
        }
    }

    @Test("Countdown seconds count down toward zero, rounded up")
    func countdownSecondsDecrease() {
        guard case .countdown(let atStart) = VoiceRecordingLimit.phase(elapsed: 23.5) else {
            Issue.record("Expected countdown")
            return
        }
        guard case .countdown(let nearEnd) = VoiceRecordingLimit.phase(elapsed: 30.5) else {
            Issue.record("Expected countdown")
            return
        }
        #expect(atStart > nearEnd)
        #expect(nearEnd >= 1, "Rounding up must never show 0 before the cap actually hits")
    }

    @Test("Reaching the cap is done, not still counting down")
    func capIsDone() {
        #expect(VoiceRecordingLimit.phase(elapsed: 31) == .done)
        #expect(VoiceRecordingLimit.phase(elapsed: 45) == .done, "Past the cap must still read as done, not undefined")
    }

    @Test("The four phases are visited in order as elapsed time increases")
    func phasesProgressInOrder() {
        let samples = stride(from: 0.0, through: 32, by: 0.5).map { VoiceRecordingLimit.phase(elapsed: $0) }

        // Collapse consecutive duplicates so only the sequence of distinct
        // phases remains, and assert it's exactly the expected order — this
        // catches a threshold being miscalculated into visiting a phase out
        // of order, or skipping one entirely.
        var distinctOrder: [String] = []
        for sample in samples {
            let label = "\(sample)"
            let normalized = label.hasPrefix("countdown") ? "countdown" : label
            if distinctOrder.last != normalized { distinctOrder.append(normalized) }
        }

        #expect(distinctOrder == ["recording", "endingSoon", "countdown", "done"])
    }
}
