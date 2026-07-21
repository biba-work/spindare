import SwiftUI
import AVFoundation

// Playback for one voice note.
//
// One player per bubble rather than a shared singleton: the state this drives
// (play/pause icon, waveform progress) belongs to a specific message, and a
// shared player would need every bubble to observe it and filter by url anyway.
// The cost is a few idle AVAudioPlayers in a long conversation, which is
// cheaper than the bookkeeping.

@MainActor
@Observable
public final class AudioNotePlayer {
    public private(set) var isPlaying = false
    public private(set) var elapsed: TimeInterval = 0
    /// 0...1 through the note, for the waveform.
    public private(set) var progress: CGFloat = 1

    #if canImport(AVFAudio) && !os(macOS)
    private var player: AVAudioPlayer?
    private var tick: Task<Void, Never>?

    public init() {}

    public func toggle(url: URL) {
        if isPlaying {
            pause()
        } else {
            play(url: url)
        }
    }

    private func play(url: URL) {
        if player == nil {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try? AVAudioSession.sharedInstance().setActive(true)
            player = try? AVAudioPlayer(contentsOf: url)
        }

        guard let player else { return }
        player.play()
        isPlaying = true

        tick = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(60))
                // No `await`: this `Task` was created from a `@MainActor`
                // method (the whole class is `@MainActor`), so it already
                // inherits that isolation — `advance()` is a synchronous
                // method on the same actor, not a hop, so there's nothing
                // here for `await` to suspend on.
                self?.advance()
            }
        }
    }

    private func advance() {
        guard let player else { return }
        elapsed = player.currentTime
        progress = player.duration > 0 ? CGFloat(player.currentTime / player.duration) : 1

        guard !player.isPlaying else { return }
        // Reached the end: reset so a second tap replays from the start rather
        // than sitting at the finish doing nothing.
        stop()
    }

    public func pause() {
        player?.pause()
        isPlaying = false
        tick?.cancel()
        tick = nil
    }

    public func stop() {
        tick?.cancel()
        tick = nil
        player?.stop()
        player = nil
        isPlaying = false
        elapsed = 0
        progress = 1
    }
    #else
    public init() {}
    public func toggle(url: URL) {}
    public func pause() {}
    public func stop() {}
    #endif
}
