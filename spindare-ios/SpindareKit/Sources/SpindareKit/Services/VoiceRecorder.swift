import SwiftUI
import AVFoundation

// Voice note capture.
//
// `AVAudioRecorder` rather than the newer engine APIs: this records one file,
// start to stop, with no mixing or live processing. Metering is polled while
// recording to build the waveform, because the alternative — reading the file
// back and decoding it afterwards — means the bubble can't show a waveform
// until after the send, and the recording UI can't show levels at all.

@MainActor
@Observable
public final class VoiceRecorder {
    public private(set) var isRecording = false
    public private(set) var duration: TimeInterval = 0
    /// Normalised 0...1 loudness, one sample per poll.
    public private(set) var samples: [CGFloat] = []
    public private(set) var permissionDenied = false

    /// Enough to draw a waveform across a bubble without the array growing
    /// without bound on a long recording — older samples are dropped, so a
    /// two-minute note shows its most recent stretch rather than a solid block.
    private static let maxSamples = 48

    #if canImport(AVFAudio) && !os(macOS)
    private var recorder: AVAudioRecorder?
    private var meterTask: Task<Void, Never>?
    private var fileURL: URL?

    public init() {}

    public func start() async {
        guard !isRecording else { return }

        guard await Self.requestPermission() else {
            permissionDenied = true
            return
        }

        let session = AVAudioSession.sharedInstance()
        // `.playAndRecord` rather than `.record`, so playing a note back
        // doesn't require tearing the session down and rebuilding it.
        try? session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try? session.setActive(true)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("voice-\(UUID().uuidString).m4a")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            // Mono: a voice note is one person talking into one microphone, and
            // stereo doubles the file for nothing.
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]

        guard let recorder = try? AVAudioRecorder(url: url, settings: settings) else { return }
        recorder.isMeteringEnabled = true
        recorder.record()

        self.recorder = recorder
        self.fileURL = url
        isRecording = true
        duration = 0
        samples = []

        meterTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(90))
                // No `await` — same reasoning as `AudioNotePlayer`'s tick
                // loop: this `Task` already inherits `@MainActor` isolation
                // from where it was created, and `poll()` is a synchronous
                // method on that same actor.
                self?.poll()
            }
        }
    }

    /// Stops and returns the finished note, or nil if it was too short to be
    /// anything but an accidental tap.
    public func stop() -> (url: URL, duration: TimeInterval, samples: [CGFloat])? {
        guard isRecording, let recorder, let fileURL else { return nil }

        meterTask?.cancel()
        meterTask = nil
        recorder.stop()
        self.recorder = nil
        isRecording = false

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        guard duration >= 0.5 else {
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }

        return (fileURL, duration, samples)
    }

    public func cancel() {
        meterTask?.cancel()
        meterTask = nil
        recorder?.stop()
        recorder = nil
        isRecording = false
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
        fileURL = nil
        duration = 0
        samples = []
    }

    private func poll() {
        guard let recorder, recorder.isRecording else { return }
        recorder.updateMeters()
        duration = recorder.currentTime

        samples.append(Self.normalise(recorder.averagePower(forChannel: 0)))
        if samples.count > Self.maxSamples { samples.removeFirst() }
    }

    private static func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            if #available(iOS 17, *) {
                AVAudioApplication.requestRecordPermission { continuation.resume(returning: $0) }
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) }
            }
        }
    }
    #else
    // macOS builds this package for `swift test` without Xcode; recording isn't
    // reachable there and the AVAudioSession API doesn't exist.
    public init() {}
    public func start() async { permissionDenied = true }
    public func stop() -> (url: URL, duration: TimeInterval, samples: [CGFloat])? { nil }
    public func cancel() {}
    #endif

    /// dBFS (-160...0) to a 0...1 bar height.
    ///
    /// Clamped at -50dB rather than the full floor because everything below
    /// that is room tone: mapping the true range puts all of human speech in
    /// the top fifth of the scale and draws a flat line.
    /// `nonisolated` because it's pure arithmetic — it touches no recorder
    /// state, and requiring the main actor to compute a bar height would mean
    /// it couldn't be tested without hopping onto it.
    nonisolated static func normalise(_ decibels: Float) -> CGFloat {
        let floor: Float = -50
        guard decibels > floor else { return 0.04 }
        let linear = (decibels - floor) / -floor
        // Slight curve so quiet speech still shows visible movement.
        return CGFloat(min(1, max(0.04, pow(linear, 0.7))))
    }
}
