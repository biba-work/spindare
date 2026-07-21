import SwiftUI
import PhotosUI
import AVKit
import UniformTypeIdentifiers

// One composer for every route into posting.
//
// The RN app had two: this one, and a second five-state machine buried in the
// profile spinner that posted directly with fewer capabilities (no video, no
// private send, no confirmation). The spinner now routes here instead.

public struct ComposerView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var caption = ""
    @State private var pickerItem: PhotosPickerItem?
    @State private var mediaData: Data?
    /// Set instead of `mediaData` when the proof is a video — camera capture
    /// or a picked clip. Exactly one of the two is ever non-nil.
    @State private var mediaVideoURL: URL?
    @State private var isSubmitting = false
    @State private var showSuccess = false
    @State private var showCamera = false
    @State private var postError: String?

    private let feedService: any FeedServing

    public init(feedService: any FeedServing = AppEnvironment.feedService) {
        self.feedService = feedService
    }

    private var canPost: Bool {
        !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || mediaData != nil
            || mediaVideoURL != nil
    }

    public var body: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Spindare.Spacing.lg) {
                    dareCard
                    mediaSection
                    captionField
                }
                .padding(.horizontal, Spindare.Spacing.gutter)
                .padding(.top, Spindare.Spacing.lg)
            }
            .scrollIndicators(.hidden)

            if showSuccess {
                SuccessBurst().transition(.opacity)
            }
        }
        .safeAreaInset(edge: .top) { navBar }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: Spindare.Spacing.sm) {
                if let postError {
                    Text(postError)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spindare.Spacing.sm)
                        .padding(.horizontal, Spindare.Spacing.md)
                        .background {
                            RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                .fill(Color.red.opacity(0.9))
                        }
                        .padding(.horizontal, Spindare.Spacing.gutter)
                        .transition(.opacity)
                }
                footer
            }
        }
        .onChange(of: pickerItem) { _, item in
            Task {
                guard let item else { return }
                // Tried as a video first: `PhotosPickerItem` can satisfy
                // either `Data` (an image) or `MovieFile` (a file-backed
                // transfer) depending on what was actually picked, and
                // there's no cheap way to ask "which kind is this" up front.
                if let movie = try? await item.loadTransferable(type: MovieFile.self) {
                    mediaVideoURL = movie.url
                    mediaData = nil
                } else if let raw = try? await item.loadTransferable(type: Data.self) {
                    mediaData = Self.processed(raw)
                    mediaVideoURL = nil
                }
            }
        }
        #if os(iOS)
        .fullScreenCover(isPresented: $showCamera) {
            CameraCapture { image, video in
                showCamera = false
                if let image {
                    mediaData = Self.processed(image)
                    mediaVideoURL = nil
                } else if let video {
                    mediaVideoURL = video
                    mediaData = nil
                }
            }
            .ignoresSafeArea()
        }
        #endif
    }

    /// Everything entering `mediaData` goes through here, whichever source it
    /// came from — compressing at the picker but not at the camera is exactly
    /// the kind of split that quietly stops holding.
    private static func processed(_ raw: Data) -> Data {
        #if canImport(UIKit)
        return ImageCompression.compress(raw) ?? raw
        #else
        return raw
        #endif
    }

    // MARK: - Chrome

    private var navBar: some View {
        HStack {
            Button { router.pop() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            Spacer()
            Text("Completed challenge")
                .spindareLabel(size: 10, weight: .medium, tracking: 2)
            Spacer()
            Color.clear.frame(width: 40, height: 40)
        }
        .foregroundStyle(Color.spindarePrimary(scheme))
        .padding(.horizontal, Spindare.Spacing.sm)
        .background(Color.spindareBackground(scheme))
    }

    /// Two exits, not a share sheet. Posting publicly and sending privately are
    /// different intentions, and the original treated them as equals.
    private var footer: some View {
        HStack(spacing: Spindare.Spacing.sm) {
            Button {
                submit(private: true)
            } label: {
                Text("Send privately")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background {
                        RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                            .fill(Spindare.Hairline.color(scheme, emphasis: 1.2))
                    }
                    .foregroundStyle(Color.spindarePrimary(scheme))
            }
            .buttonStyle(PressableStyle())

            Button {
                submit(private: false)
            } label: {
                Text("Post to feed")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background {
                        RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                            .fill(Spindare.Palette.ink)
                    }
                    .foregroundStyle(.white)
            }
            .buttonStyle(PressableStyle())
        }
        .opacity(canPost && !isSubmitting ? 1 : 0.4)
        .disabled(!canPost || isSubmitting)
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.top, Spindare.Spacing.sm)
        .padding(.bottom, Spindare.Spacing.md)
        .background(Color.spindareBackground(scheme))
    }

    // MARK: - Content

    private var dareCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("The challenge")
                .spindareLabel(size: 9, weight: .medium, tracking: 2)
                .foregroundStyle(Color.spindareAccent(scheme))

            Text(router.challenge ?? "Freestyle")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.spindarePrimary(scheme))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Spindare.Palette.accent.opacity(scheme == .dark ? 0.12 : 0.16))
        }
    }

    @ViewBuilder
    private var mediaSection: some View {
        if let mediaVideoURL {
            Color.black
                .frame(height: 320)
                .overlay { VideoPlayer(player: AVPlayer(url: mediaVideoURL)) }
                .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous))
                .overlay(alignment: .topTrailing) { removeMediaButton }
        } else if let mediaData, let image = Self.image(from: mediaData) {
            Color.clear
                .frame(height: 320)
                .overlay { image.resizable().scaledToFill() }
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous))
                .overlay(alignment: .topTrailing) { removeMediaButton }
        } else {
            // Resolved up front: PhotosPicker's label closure is not
            // main-actor isolated, so it can't read @Environment directly.
            let foreground = Color.spindareSecondary(scheme)
            let fill = Spindare.Hairline.color(scheme, emphasis: 0.7)

            // Two ways in, not one. The old single tile opened the library —
            // the camera icon on it promised a capture that wasn't reachable
            // anywhere in the flow, which for a "go do this in the physical
            // world" app is the wrong half to be missing.
            HStack(spacing: Spindare.Spacing.sm) {
                #if os(iOS)
                Button {
                    showCamera = true
                } label: {
                    ProofTile(icon: "camera.fill", title: "Take photo or video", foreground: foreground, fill: fill)
                }
                .buttonStyle(.plain)
                #endif

                // `.any(of:)` rather than `.images` alone — this is the whole
                // fix for "can't attach my own videos": the picker only ever
                // offered stills before.
                PhotosPicker(selection: $pickerItem, matching: .any(of: [.images, .videos])) {
                    ProofTile(icon: "photo.on.rectangle", title: "Choose", foreground: foreground, fill: fill)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var removeMediaButton: some View {
        Button {
            withAnimation(Spindare.Motion.enter) {
                mediaData = nil
                mediaVideoURL = nil
                pickerItem = nil
            }
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(.black.opacity(0.5)))
                .padding(Spindare.Spacing.sm)
        }
        .buttonStyle(.plain)
    }

    private var captionField: some View {
        VStack(alignment: .leading, spacing: 6) {
            TextField("How did it go?", text: $caption, axis: .vertical)
                .lineLimit(3...8)
                .font(Spindare.Typography.bodyLarge)
                .foregroundStyle(Color.spindarePrimary(scheme))

            Text("\(caption.count)/300")
                .font(.system(size: 11))
                .foregroundStyle(Color.spindareSecondary(scheme))
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Color.spindareSurface(scheme))
                .overlay {
                    RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                        .strokeBorder(Spindare.Hairline.color(scheme), lineWidth: Spindare.Hairline.width)
                }
        }
        .onChange(of: caption) { _, new in
            if new.count > 300 { caption = String(new.prefix(300)) }
        }
    }

    // MARK: - Submit

    private func submit(private isPrivate: Bool) {
        guard canPost, !isSubmitting else { return }
        isSubmitting = true
        postError = nil

        Task {
            // Media is uploaded to R2 *before* the post is created, so
            // `Post.media` points at a real, everyone-can-load URL rather than
            // a `file://` path that only exists on this device. A failed upload
            // aborts the post instead of publishing a dead link.
            let media: String?
            do {
                media = try await resolvedMediaURL()
            } catch {
                isSubmitting = false
                postError = "Couldn't upload your media. Check your connection and try again."
                return
            }

            _ = try? await feedService.createPost(
                challenge: router.challenge ?? "Freestyle",
                content: caption.isEmpty ? nil : caption,
                media: media,
                username: router.username ?? "you",
                avatar: router.avatarURL
            )

            withAnimation(.easeOut(duration: 0.15)) { showSuccess = true }
            try? await Task.sleep(for: .milliseconds(1600))

            router.challenge = nil
            router.clearProof()
            router.pop()
        }
    }

    /// Turns whatever proof was attached into a URL `Post.media` can point at.
    ///
    /// Live: uploads to R2 (video via presigned direct-PUT, image via the
    /// base64 endpoint) and returns the public URL. Mock/offline (no uploader
    /// configured): falls back to a local file URL so posting still works
    /// without a backend. Throws only when a live upload actually fails.
    private func resolvedMediaURL() async throws -> String? {
        if let mediaVideoURL {
            if let uploader = AppEnvironment.mediaUploader {
                return try await uploader.uploadFile(
                    at: mediaVideoURL, contentType: "video/quicktime", folder: "posts"
                )
            }
            return mediaVideoURL.absoluteString
        }

        guard let mediaData else { return nil }
        if let uploader = AppEnvironment.mediaUploader {
            return try await uploader.uploadData(
                mediaData, contentType: "image/jpeg", folder: "posts"
            )
        }
        // A photo only exists as in-memory `Data`, so it needs a file to point at.
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("post-\(UUID().uuidString).jpg")
        guard (try? mediaData.write(to: url)) != nil else { return nil }
        return url.absoluteString
    }
}

/// Its own view rather than a method on `ComposerView`, because `PhotosPicker`'s
/// label builder is not main-actor isolated and so can't call one.
private struct ProofTile: View {
    let icon: String
    let title: String
    let foreground: Color
    let fill: Color

    var body: some View {
        VStack(spacing: Spindare.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .light))
            Text(title)
                .font(.system(size: 13, weight: .medium))
        }
        .foregroundStyle(foreground)
        .frame(maxWidth: .infinity)
        .frame(height: 160)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(fill)
        }
    }
}

// MARK: - Success burst
//
// Ten bubbles on fixed angles — no randomness anywhere. The choreography is
// what sells it: the check lands 120ms after the circle, and the bubbles stagger
// 30ms apart rather than firing together.

struct SuccessBurst: View {
    // Old state removed as we use KeyframeAnimator

    private let bubbleColors: [Color] = [
        Color(hex: 0xA7BBC7), Color(hex: 0xC7A7BC), Color(hex: 0xA7C7B0),
        Color(hex: 0xC7BBA7), Color(hex: 0xB0C7E8), Color(hex: 0xE8C7B0),
        Color(hex: 0xC7E8B0), Color(hex: 0xB0B0E8), Color(hex: 0xE8B0C7),
        Color(hex: 0xB0E8D4),
    ]

    struct BurstState {
        var circleScale: Double = 0.3
        var checkScale: Double = 0.2
        var checkOpacity: Double = 0
        var textOpacity: Double = 0
        var bubblesScale: Double = 0.1
        var bubblesOpacity: Double = 1
        var bubblesTravel: Double = 0
    }

    @State private var start = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea()
            
            KeyframeAnimator(initialValue: BurstState(), trigger: start) { state in
                ZStack {
                    ForEach(0..<10, id: \.self) { i in
                        let angle = Double(i) / 10 * 2 * .pi
                        let distance = (65 + Double(i % 3) * 28) * state.bubblesTravel
                        let size = 8 + Double(i % 3) * 4

                        Circle()
                            .fill(bubbleColors[i])
                            .frame(width: size, height: size)
                            .scaleEffect(state.bubblesScale)
                            .offset(
                                x: cos(angle) * distance,
                                y: sin(angle) * distance
                            )
                            .opacity(state.bubblesOpacity)
                    }

                    Circle()
                        .fill(Spindare.Palette.success)
                        .frame(width: 100, height: 100)
                        .spindareShadow(.successGlow)
                        .scaleEffect(state.circleScale)
                        .overlay {
                            Image(systemName: "checkmark")
                                .font(.system(size: 40, weight: .bold))
                                .foregroundStyle(.white)
                                .scaleEffect(state.checkScale)
                                .opacity(state.checkOpacity)
                        }

                    Text("Posted")
                        .font(.system(size: 18, weight: .bold))
                        .kerning(-0.3)
                        .foregroundStyle(.white)
                        .offset(y: 90)
                        .opacity(state.textOpacity)
                }
            } keyframes: { _ in
                KeyframeTrack(\.circleScale) {
                    SpringKeyframe(1.0, duration: 0.5, spring: .snappy)
                }
                KeyframeTrack(\.checkScale) {
                    LinearKeyframe(0.2, duration: 0.12)
                    SpringKeyframe(1.0, duration: 0.4, spring: .bouncy)
                }
                KeyframeTrack(\.checkOpacity) {
                    LinearKeyframe(0.0, duration: 0.12)
                    LinearKeyframe(1.0, duration: 0.1)
                }
                KeyframeTrack(\.textOpacity) {
                    LinearKeyframe(0.0, duration: 0.12)
                    LinearKeyframe(1.0, duration: 0.2)
                }
                KeyframeTrack(\.bubblesTravel) {
                    LinearKeyframe(0.0, duration: 0.12)
                    CubicKeyframe(1.0, duration: 0.6)
                }
                KeyframeTrack(\.bubblesScale) {
                    LinearKeyframe(0.1, duration: 0.12)
                    CubicKeyframe(1.0, duration: 0.4)
                }
                KeyframeTrack(\.bubblesOpacity) {
                    LinearKeyframe(1.0, duration: 0.4)
                    LinearKeyframe(0.0, duration: 0.3)
                }
            }
        }
        .onAppear {
            start = true
        }
    }
}

// MARK: - Picked video

/// Lets a `PhotosPickerItem` load as a video file rather than raw `Data` —
/// loading a video as `Data` pulls the whole clip into memory at once, which
/// is the kind of thing that's fine for a test video and a real problem for
/// an actual one. `FileRepresentation` streams to disk instead.
struct MovieFile: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            // Copied out for the same reason `CameraCapture` copies its own
            // capture: the picker's received file isn't guaranteed to
            // survive past this transfer.
            let copy = FileManager.default.temporaryDirectory
                .appendingPathComponent("picked-\(UUID().uuidString).mov")
            try? FileManager.default.copyItem(at: received.file, to: copy)
            return Self(url: copy)
        }
    }
}

// MARK: - Platform image

extension ComposerView {
    /// Decodes picked data into an `Image`. Split by platform so the package
    /// still builds for macOS, where `UIImage` doesn't exist.
    static func image(from data: Data) -> Image? {
        #if canImport(UIKit)
        UIImage(data: data).map(Image.init(uiImage:))
        #elseif canImport(AppKit)
        NSImage(data: data).map(Image.init(nsImage:))
        #else
        nil
        #endif
    }
}
