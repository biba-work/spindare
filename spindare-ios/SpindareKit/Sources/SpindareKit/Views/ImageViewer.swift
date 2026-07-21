import SwiftUI

// Full-screen photo viewer.
//
// The zoom maths lives in `ZoomGeometry` as pure functions so it can be tested
// without a running view — the pan-bound clamping in particular has no visual
// tell when it's subtly wrong, it just lets you drag the photo somewhere it
// shouldn't go.

/// Pure geometry for a zoomable, pannable image. No SwiftUI state.
public struct ZoomGeometry: Sendable {
    /// Size the image occupies at 1×, letterboxed inside the container.
    public static func fittedSize(aspectRatio: CGFloat, in container: CGSize) -> CGSize {
        guard aspectRatio > 0, container.width > 0, container.height > 0 else { return .zero }

        let containerRatio = container.width / container.height
        return aspectRatio > containerRatio
            // Wider than the container: pinned to the sides, bars top and bottom.
            ? CGSize(width: container.width, height: container.width / aspectRatio)
            : CGSize(width: container.height * aspectRatio, height: container.height)
    }

    /// How far the image may be panned from centre before an edge would come
    /// inside the container. Zero on an axis where the scaled image still fits,
    /// which is what keeps a zoomed-in portrait from sliding sideways.
    public static func panLimit(contentSize: CGSize, scale: CGFloat, container: CGSize) -> CGSize {
        CGSize(
            width: max(0, (contentSize.width * scale - container.width) / 2),
            height: max(0, (contentSize.height * scale - container.height) / 2)
        )
    }

    /// Constrains an offset to the pan limits, so the photo can never be
    /// dragged away from under the finger and leave empty space on one side.
    public static func clamp(_ offset: CGSize, contentSize: CGSize, scale: CGFloat, container: CGSize) -> CGSize {
        let limit = panLimit(contentSize: contentSize, scale: scale, container: container)
        return CGSize(
            width: min(limit.width, max(-limit.width, offset.width)),
            height: min(limit.height, max(-limit.height, offset.height))
        )
    }

    /// Offset that brings `point` (in container coordinates) to the centre after
    /// scaling by `scale` — this is what makes a double-tap zoom into the thing
    /// you tapped rather than always into the middle of the photo.
    public static func offsetToCenter(
        on point: CGPoint,
        scale: CGFloat,
        contentSize: CGSize,
        container: CGSize
    ) -> CGSize {
        let dx = (container.width / 2 - point.x) * scale
        let dy = (container.height / 2 - point.y) * scale
        return clamp(
            CGSize(width: dx, height: dy),
            contentSize: contentSize,
            scale: scale,
            container: container
        )
    }

    /// Resistance past a pan limit, matching how a system scroll view behaves
    /// at its edge: motion continues but decays, so the bound announces itself
    /// by feel instead of by the image stopping dead under a moving finger.
    ///
    /// The hard `clamp` above is still right for *resting* position — this is
    /// only for the live gesture, and every drag ends by springing back to the
    /// clamped value.
    public static func rubberBand(_ excess: CGFloat, dimension: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        guard dimension > 0, excess != 0 else { return 0 }
        let magnitude = abs(excess)
        let resisted = (1 - (1 / (magnitude * coefficient / dimension + 1))) * dimension
        return excess < 0 ? -resisted : resisted
    }

    /// Live pan position: 1:1 with the finger inside the bounds, resisted past
    /// them.
    public static func resisted(
        _ offset: CGSize,
        contentSize: CGSize,
        scale: CGFloat,
        container: CGSize
    ) -> CGSize {
        let limit = panLimit(contentSize: contentSize, scale: scale, container: container)

        func axis(_ value: CGFloat, _ bound: CGFloat, _ dimension: CGFloat) -> CGFloat {
            if value > bound { return bound + rubberBand(value - bound, dimension: dimension) }
            if value < -bound { return -bound + rubberBand(value + bound, dimension: dimension) }
            return value
        }

        return CGSize(
            width: axis(offset.width, limit.width, container.width),
            height: axis(offset.height, limit.height, container.height)
        )
    }

    public static let minScale: CGFloat = 1
    public static let maxScale: CGFloat = 4
    /// Below this, a pinch-out is treated as "meant to go back to 1×" and the
    /// image springs the rest of the way rather than resting slightly zoomed.
    public static let snapBackScale: CGFloat = 1.1
    public static let doubleTapScale: CGFloat = 2
    /// Pull-down past this commits to dismissing.
    public static let dismissThreshold: CGFloat = 150

    /// How far along the dismissal a pull is, 0...1. Drives the backdrop fade
    /// and the shrink together, so the photo reads as receding toward the feed
    /// rather than as two effects that happen to co-occur.
    public static func dismissProgress(pullDown: CGFloat, reference: CGFloat = 400) -> CGFloat {
        guard reference > 0 else { return 0 }
        return min(1, max(0, abs(pullDown) / reference))
    }
}

public struct ImageViewer: View {
    let url: URL
    /// Shown over the photo at 1× and hidden the moment you zoom — you zoomed in
    /// to look at the picture, so the text gets out of the way until you come
    /// back out or leave.
    let caption: String?
    @Binding var isPresented: Bool

    @State private var scale: CGFloat = 1
    @State private var steadyScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var steadyOffset: CGSize = .zero
    @State private var dismissDrag: CGSize = .zero
    @State private var aspectRatio: CGFloat = 1
    @State private var captionExpanded = false
    /// Set once the exit is committed, so the photo keeps flying while the
    /// cover is still mounted. Without it, flipping `isPresented` immediately
    /// hands the exit to `fullScreenCover`, which slides the whole sheet down
    /// from wherever it *started* — the "goofy" jump back up mid-gesture.
    @State private var isDismissing = false

    public init(url: URL, caption: String? = nil, isPresented: Binding<Bool>) {
        self.url = url
        self.caption = caption
        self._isPresented = isPresented
    }

    private var isZoomed: Bool { scale > ZoomGeometry.minScale + 0.01 }

    public var body: some View {
        GeometryReader { proxy in
            let container = proxy.size
            let contentSize = ZoomGeometry.fittedSize(aspectRatio: aspectRatio, in: container)

            ZStack {
                // Fades out as you fling it away, so the photo appears to fall
                // back toward the feed rather than the screen simply cutting.
                Color.black
                    .opacity(backdropOpacity)
                    .ignoresSafeArea()

                image(contentSize: contentSize, container: container)
            }
            .frame(width: container.width, height: container.height)
            .contentShape(Rectangle())
            .gesture(dismissGesture(contentSize: contentSize, container: container))
            .overlay(alignment: .bottom) { captionOverlay }
            .overlay(alignment: .topTrailing) { closeButton }
        }
        .background(Color.black.opacity(backdropOpacity).ignoresSafeArea())
        #if os(iOS)
        .statusBarHidden()
        #endif
    }

    /// 0 at rest, 1 fully pulled away.
    private var dismissProgress: CGFloat {
        ZoomGeometry.dismissProgress(pullDown: dismissDrag.height)
    }

    private var backdropOpacity: Double {
        isDismissing ? 0 : Double(1 - dismissProgress)
    }

    /// Fades out quickly during the initial 25% of a drag-to-dismiss gesture.
    private var chromeOpacity: Double {
        let fade = Double(max(0, 1 - dismissProgress * 4))
        return isDismissing ? 0 : fade
    }

    /// Shrinks as it's pulled away — the photo recedes rather than sliding flat
    /// off the bottom, which is what makes it read as going *back* to the feed.
    /// Bottoms out at 0.86 so it never becomes a thumbnail mid-drag.
    private var dismissScale: CGFloat {
        1 - 0.14 * dismissProgress
    }

    // MARK: - Image

    @ViewBuilder
    private func image(contentSize: CGSize, container: CGSize) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let loaded):
                loaded
                    .resizable()
                    .scaledToFit()
                    .task {
                        // Drives the pan bounds. Without the real aspect ratio
                        // the limits are computed against a square and the photo
                        // can be dragged past its own edge.
                        if let ratio = await Self.aspectRatio(of: url) { aspectRatio = ratio }
                    }
            case .failure:
                Image(systemName: "photo")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(.white.opacity(0.4))
            default:
                ProgressView().tint(.white)
            }
        }
        .scaleEffect(scale * dismissScale)
        // Applied *after* the scale, so a point of finger travel is a point of
        // image travel at every zoom level. Offsetting before scaling would
        // multiply pan speed by the zoom factor.
        .offset(x: offset.width + dismissDrag.width, y: offset.height + dismissDrag.height)
        .gesture(magnify(contentSize: contentSize, container: container))
        // Declared before the single tap so the single-tap recogniser defers.
        // Reversed, one tap always wins and double-tap zoom never fires.
        .gesture(doubleTap(contentSize: contentSize, container: container))
        .gesture(singleTap)
        .animation(Spindare.Motion.enter, value: scale)
    }

    // MARK: - Gestures

    private func magnify(contentSize: CGSize, container: CGSize) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let proposed = steadyScale * value.magnification
                // Hard ceiling, soft floor — you can pull slightly under 1× and
                // feel it resist, which is how you learn the bound exists.
                scale = min(ZoomGeometry.maxScale, max(0.7, proposed))
                offset = ZoomGeometry.clamp(
                    steadyOffset,
                    contentSize: contentSize,
                    scale: scale,
                    container: container
                )
            }
            .onEnded { _ in
                withAnimation(Spindare.Motion.enter) {
                    if scale < ZoomGeometry.snapBackScale {
                        scale = ZoomGeometry.minScale
                        offset = .zero
                    }
                    offset = ZoomGeometry.clamp(
                        offset,
                        contentSize: contentSize,
                        scale: scale,
                        container: container
                    )
                }
                steadyScale = scale
                steadyOffset = offset
            }
    }

    /// Pans while zoomed; swipes to dismiss while not. One gesture rather than
    /// two, because two drag recognisers on the same view fight over the touch.
    private func dismissGesture(contentSize: CGSize, container: CGSize) -> some Gesture {
        DragGesture()
            .onChanged { value in
                if isZoomed {
                    // Resisted, not clamped. Clamping stops the photo dead
                    // under a still-moving finger, which is the "hard snapping
                    // and coordinate jumps" — the image and the touch stop
                    // agreeing about where they are. Resistance keeps them
                    // agreeing, just increasingly reluctantly, and `onEnded`
                    // springs back to a legal position.
                    offset = ZoomGeometry.resisted(
                        CGSize(
                            width: steadyOffset.width + value.translation.width,
                            height: steadyOffset.height + value.translation.height
                        ),
                        contentSize: contentSize,
                        scale: scale,
                        container: container
                    )
                } else {
                    dismissDrag = value.translation
                }
            }
            .onEnded { value in
                if isZoomed {
                    // Committed here rather than accumulated every frame. The
                    // previous version added the *cumulative* translation on
                    // each change, so a slow drag travelled many times further
                    // than the finger did.
                    let settled = ZoomGeometry.clamp(
                        offset,
                        contentSize: contentSize,
                        scale: scale,
                        container: container
                    )
                    withAnimation(Spindare.Motion.settle) { offset = settled }
                    steadyOffset = settled
                } else {
                    let flung = value.predictedEndTranslation.height > 400
                    if value.translation.height > ZoomGeometry.dismissThreshold || flung {
                        dismiss(container: container, velocity: value.predictedEndTranslation)
                    } else {
                        withAnimation(Spindare.Motion.settle) { dismissDrag = .zero }
                    }
                }
            }
    }

    /// Finishes the throw before unmounting.
    ///
    /// `isPresented = false` on its own hands the exit to `fullScreenCover`,
    /// which animates the sheet down from its *presented* position — so a
    /// photo already dragged halfway down visibly snaps back up before sliding
    /// away. Flying it the rest of the way first, then unmounting once it's
    /// off-screen and the backdrop is clear, means the system's own dismissal
    /// has nothing visible left to animate.
    private func dismiss(container: CGSize, velocity: CGSize) {
        guard !isDismissing else { return }
        isDismissing = true

        withAnimation(Spindare.Motion.commit) {
            // Continues along the direction of the throw rather than straight
            // down, so a diagonal flick leaves the way it was thrown.
            dismissDrag = CGSize(
                width: velocity.width * 0.4,
                height: max(container.height, velocity.height)
            )
        }

        Task {
            try? await Task.sleep(for: .milliseconds(260))
            isPresented = false
        }
    }

    private func doubleTap(contentSize: CGSize, container: CGSize) -> some Gesture {
        SpatialTapGesture(count: 2)
            .onEnded { value in
                withAnimation(Spindare.Motion.enter) {
                    if isZoomed {
                        scale = ZoomGeometry.minScale
                        offset = .zero
                    } else {
                        scale = ZoomGeometry.doubleTapScale
                        offset = ZoomGeometry.offsetToCenter(
                            on: value.location,
                            scale: scale,
                            contentSize: contentSize,
                            container: container
                        )
                    }
                }
                steadyScale = scale
                steadyOffset = offset
            }
    }

    private var singleTap: some Gesture {
        TapGesture()
            .onEnded {
                // At 1× a tap leaves; zoomed in it collapses an expanded caption
                // instead, so you can't accidentally exit while inspecting.
                if isZoomed {
                    withAnimation(Spindare.Motion.enter) { captionExpanded = false }
                } else {
                    isPresented = false
                }
            }
    }

    // MARK: - Chrome

    @ViewBuilder
    private var captionOverlay: some View {
        if let caption, !caption.isEmpty, !isZoomed {
            ScrollView {
                Text(caption)
                    .font(Spindare.Typography.bodyLarge)
                    .lineSpacing(Spindare.Typography.bodyLineSpacing)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDisabled(!captionExpanded)
            .frame(maxHeight: captionExpanded ? 260 : 96)
            .padding(.horizontal, Spindare.Spacing.lg)
            .padding(.bottom, Spindare.Spacing.xl)
            .background {
                LinearGradient(
                    colors: [.clear, .black.opacity(0.75)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .padding(.top, -60)
                .allowsHitTesting(false)
            }
            .onTapGesture {
                withAnimation(Spindare.Motion.enter) { captionExpanded.toggle() }
            }
            .transition(.opacity)
            .opacity(chromeOpacity)
        }
    }

    @ViewBuilder
    private var closeButton: some View {
        Button {
            isPresented = false
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(Circle().fill(.black.opacity(0.4)))
                .padding(Spindare.Spacing.md)
        }
        .buttonStyle(.plain)
        .opacity(isZoomed ? 0 : chromeOpacity)
        .allowsHitTesting(!isZoomed && chromeOpacity > 0.5)
    }

    // MARK: - Aspect ratio

    /// Reads the image's intrinsic size so the pan bounds match the photo rather
    /// than the container. Nil on failure, leaving the 1:1 default in place.
    private static func aspectRatio(of url: URL) async -> CGFloat? {
        #if canImport(UIKit)
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let image = UIImage(data: data),
              image.size.height > 0
        else { return nil }
        return image.size.width / image.size.height
        #else
        return nil
        #endif
    }
}

// MARK: - Feed Image Cell with Matched Geometry & Solid Black Placeholder

public struct FeedImageCell: View {
    let imageURL: URL
    @Binding var activeFullscreenID: String?
    var animationNamespace: Namespace.ID

    public init(imageURL: URL, activeFullscreenID: Binding<String?>, animationNamespace: Namespace.ID) {
        self.imageURL = imageURL
        self._activeFullscreenID = activeFullscreenID
        self.animationNamespace = animationNamespace
    }

    public var body: some View {
        ZStack {
            if activeFullscreenID == imageURL.absoluteString {
                // Keep feed placeholder black while image is popped into fullscreen
                Color.black
                    .frame(height: 380)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            } else {
                AsyncImage(url: imageURL) { image in
                    image.resizable()
                        .scaledToFill()
                        .frame(height: 380)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .matchedGeometryEffect(id: imageURL.absoluteString, in: animationNamespace)
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
            }
        }
    }
}
