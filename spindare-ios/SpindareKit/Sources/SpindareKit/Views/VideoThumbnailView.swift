import SwiftUI
import AVFoundation

/// Renders a still frame from a remote video — `AsyncImage` can't decode
/// video URLs at all, which is what left video posts blank in the profile
/// grid and showing a generic icon in the feed. Frames are cached in memory
/// since generating one means downloading + decoding video data, too slow to
/// redo on every scroll.
///
/// Uses `CGImage` rather than `UIImage` throughout — SwiftUI's `Image(decorative:scale:)`
/// takes a `CGImage` directly on every Apple platform, so this needs no `#if
/// canImport(UIKit)` split the way `LogoImage` does for its own loose-file loading.
public struct VideoThumbnailView: View {
    let url: URL

    @State private var frame: CGImage?
    @State private var failed = false

    public init(url: URL) {
        self.url = url
    }

    public var body: some View {
        Group {
            if let frame {
                Image(decorative: frame, scale: 1)
                    .resizable()
                    .scaledToFill()
            } else {
                Color.clear
            }
        }
        .task(id: url) { await load() }
    }

    @MainActor
    private func load() async {
        if let cached = VideoThumbnailCache.shared[url] {
            frame = cached
            return
        }
        guard !failed else { return }

        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 480, height: 480)

        do {
            // A hair after zero — the literal first frame of some encodes is black.
            let result = try await generator.image(at: CMTime(seconds: 0.1, preferredTimescale: 600))
            VideoThumbnailCache.shared[url] = result.image
            frame = result.image
        } catch {
            failed = true
        }
    }
}

@MainActor
private final class VideoThumbnailCache {
    static let shared = VideoThumbnailCache()
    private let cache = NSCache<NSURL, CGImage>()

    subscript(url: URL) -> CGImage? {
        get { cache.object(forKey: url as NSURL) }
        set {
            if let newValue {
                cache.setObject(newValue, forKey: url as NSURL)
            }
        }
    }
}
