import Foundation

// The staged warning before a voice note auto-sends.
//
// A hard cutoff with no warning ("recording just stops at 31s") reads as a
// glitch the first time it happens to you. The staging exists so it reads as
// a deliberate limit instead: a brief heads-up banner, then a running
// countdown you can actually watch reach zero, matching how a phone call
// warns you it's about to drop rather than just hanging up.

public enum VoiceRecordingPhase: Equatable, Sendable {
    case recording
    /// The heads-up banner window — appears once, holds briefly, then gives
    /// way to the numeric countdown below.
    case endingSoon
    case countdown(secondsRemaining: Int)
    case done
}

public enum VoiceRecordingLimit {
    /// Hard cap. At this point the note stops and sends automatically.
    public static let maxDuration: TimeInterval = 31
    /// The banner appears this long before the cap — "11 seconds before".
    public static let warningLeadTime: TimeInterval = 11
    /// How long the banner itself stays up before the countdown takes over —
    /// long enough to actually read it, per the "3 to 4 seconds" ask.
    public static let warningBannerDuration: TimeInterval = 3.5

    /// When the banner first appears.
    static var warningStart: TimeInterval { maxDuration - warningLeadTime }
    /// When the banner gives way to the numeric countdown.
    static var countdownStart: TimeInterval { warningStart + warningBannerDuration }

    /// The phase for a recording that has run `elapsed` seconds.
    public static func phase(elapsed: TimeInterval) -> VoiceRecordingPhase {
        if elapsed >= maxDuration { return .done }
        if elapsed >= countdownStart {
            let remaining = maxDuration - elapsed
            // Rounded up: showing "0s" for even an instant reads as an error
            // ("why does it say zero but not send"), not as the last tick of
            // a countdown.
            return .countdown(secondsRemaining: Int(remaining.rounded(.up)))
        }
        if elapsed >= warningStart { return .endingSoon }
        return .recording
    }
}
