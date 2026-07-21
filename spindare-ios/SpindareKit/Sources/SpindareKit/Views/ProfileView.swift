import SwiftUI
import PhotosUI

// Your own space — and, deliberately, where the wheel lives.
//
// Spinning is buried two levels deep (feed → profile → spinner) rather than
// promoted to a tab or a floating button. That's a product decision, not an
// oversight: a challenge is something you give yourself in private, not a
// destination you flip to.

public struct ProfileView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var posts: [Post] = []
    @State private var profile: Profile?
    @State private var showSpinner = false
    /// `-openSettings` opens straight into settings, so it can be screenshotted
    /// without driving the pull-past-top gesture.
    @State private var showSettings = ProcessInfo.processInfo.arguments.contains("-openSettings")
    @State private var layout: PostLayout = .grid
    @State private var pullDistance: CGFloat = 0
    @State private var contentHeight: CGFloat = 0
    @State private var isLoading = true
    /// The post currently open full-screen, as a `Speedy` so it renders
    /// through the same card the Speedys feed uses.
    @State private var fullscreen: Speedy?
    /// The pencil badge on the avatar was purely decorative — no `Button`, no
    /// `.onTapGesture`, nothing — so tapping it did precisely nothing. The
    /// backend side of this (`ProfileServing.updatePhoto`) already existed
    /// and already worked; it just had no caller anywhere in the app.
    @State private var pfpPickerItem: PhotosPickerItem?
    @State private var isUploadingPhoto = false
    private let profileScrollSpace = "profile"

    /// How the post archive is laid out. An enum rather than a Bool so the
    /// segmented control can iterate cases and stay in sync with the content.
    enum PostLayout: CaseIterable, Hashable {
        case grid, list

        var icon: String {
            switch self {
            case .grid: "square.grid.2x2"
            case .list: "rectangle.grid.1x2"
            }
        }
    }

    private var totalReactions: Int {
        posts.reduce(0) { $0 + $1.reactions.total }
    }

    private let feedService: any FeedServing
    private let profileService: any ProfileServing

    public init(
        feedService: any FeedServing = AppEnvironment.feedService,
        profileService: any ProfileServing = AppEnvironment.profileService
    ) {
        self.feedService = feedService
        self.profileService = profileService
    }

    public var body: some View {
        GeometryReader { viewport in
            ZStack {
                Color.spindareBackground(scheme).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        identity
                        spinButton
                        stats
                        streakChip
                        layoutToggle
                        postGrid
                    }
                    .padding(.bottom, 40)
                    .background {
                        GeometryReader { proxy in
                            Color.clear.preference(
                                key: ScrollOffsetKey.self,
                                value: -proxy.frame(in: .named(profileScrollSpace)).minY
                            )
                        }
                    }
                    .reportsContentHeight()
                }
                .scrollIndicators(.hidden)
                .coordinateSpace(name: profileScrollSpace)
                .onPreferenceChange(ScrollOffsetKey.self) { offset in
                    pullDistance = offset
                    checkBottomOverscroll(viewportHeight: viewport.size.height)
                }
                .onPreferenceChange(ContentHeightKey.self) { height in
                    contentHeight = height
                    checkBottomOverscroll(viewportHeight: viewport.size.height)
                }
                .sensoryFeedback(.impact(weight: .medium), trigger: showSettings) { _, shown in shown }
            }
        }
        .safeAreaInset(edge: .top) { navBar }
        // A local overlay rather than `.sheet` — a system sheet defaults to
        // covering nearly the whole screen, which is wrong for something as
        // small as a dial. It's also a separate presentation context that
        // snapshots the ambient colour scheme at open time rather than
        // tracking it live; living in this view's own hierarchy sidesteps
        // that for free.
        .overlay {
            if showSpinner {
                spinnerPopup
            }
        }
        // Your own post, full-screen, in the same card the Speedys feed uses —
        // so it can't drift into a second near-identical layout. The card
        // itself switches to the owner treatment (reaction results in their
        // colours, "Do again" instead of "Do this") off `isOwn`.
        .spindareFullScreen(item: $fullscreen) { speedy in
            OwnSpeedyViewer(speedy: speedy) { fullscreen = nil }
        }
        .task { await load() }
        .onChange(of: pfpPickerItem) { _, item in
            guard let item else { return }
            Task { await uploadPhoto(item) }
        }
    }

    /// The whole missing feature: load whatever was picked, compress it,
    /// give it a real local URL, then actually call the service method that
    /// already existed for this — `ProfileServing.updatePhoto` was fully
    /// implemented and worked, it just had no caller anywhere in the app.
    private func uploadPhoto(_ item: PhotosPickerItem) async {
        guard let raw = try? await item.loadTransferable(type: Data.self) else { return }

        isUploadingPhoto = true
        defer {
            isUploadingPhoto = false
            pfpPickerItem = nil
        }

        #if canImport(UIKit)
        let compressed = ImageCompression.compress(raw) ?? raw
        #else
        let compressed = raw
        #endif

        // Resolve to a URL the backend (and every other device) can load:
        // upload the compressed bytes to R2 when live, or fall back to a local
        // file in mock/offline mode so the picker still visibly works.
        let photoURL: String
        if let uploader = AppEnvironment.mediaUploader {
            guard let uploaded = try? await uploader.uploadData(
                compressed, contentType: "image/jpeg", folder: "profile"
            ) else { return }
            photoURL = uploaded
        } else {
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("pfp-\(UUID().uuidString).jpg")
            guard (try? compressed.write(to: url)) != nil else { return }
            photoURL = url.absoluteString
        }

        do {
            try await profileService.updatePhoto(url: photoURL)
            // Optimistic-after-success rather than before: a photo upload is
            // the one place on this screen where showing the *old* photo a
            // little longer is better than flashing to a new one that then
            // has to revert if the call actually failed.
            profile?.photoURL = photoURL
            // Propagate to the session identity so the new photo shows in the
            // header and on new posts, not only on this screen.
            router.updateAvatar(photoURL)
        } catch {
            // Non-fatal — same treatment `saveChallenge` and other
            // best-effort writes elsewhere in this app already get.
        }
    }

    @ViewBuilder
    private var spinnerPopup: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(Color.black.opacity(0.25))
                .ignoresSafeArea()
                .onTapGesture { dismissSpinner() }

            SpinnerCard(onDismiss: dismissSpinner)
                .padding(.horizontal, Spindare.Spacing.xl)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.94)))
    }

    private func dismissSpinner() {
        withAnimation(Spindare.Motion.enter) { showSpinner = false }
    }

    /// Keep pulling past the *bottom* bounce, not the top — the only spare
    /// direction, since scrolling further down is otherwise meaningless once
    /// you're already at the end of your posts.
    private func checkBottomOverscroll(viewportHeight: CGFloat) {
        guard !showSettings else { return }
        let maxScroll = max(0, contentHeight - viewportHeight)
        let overscrollPastBottom = pullDistance - maxScroll
        guard overscrollPastBottom > 70 else { return }
        showSettings = true
    }

    // MARK: - Chrome

    private var navBar: some View {
        HStack {
            Button { router.navigate(to: .feed) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            Spacer()
            Text("Profile")
                .spindareLabel(size: 11, weight: .semibold, tracking: 3)
            Spacer()
            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 17))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
        }
        .foregroundStyle(Color.spindarePrimary(scheme))
        .padding(.horizontal, Spindare.Spacing.sm)
        .background(Color.spindareBackground(scheme))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Spindare.Hairline.color(scheme))
                .frame(height: Spindare.Hairline.width)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }

    // MARK: - Identity

    private var identity: some View {
        // Resolved to plain values *before* the picker, not read inside its
        // label closure — that closure is inferred `@Sendable`, and
        // `@Environment`/`@State` can't cross into one directly (same shape
        // as the `PhotosPicker` fixes already applied in ComposerView and
        // ChatView's composer).
        let avatarURL = profile?.photoURL ?? router.avatarURL
        let backgroundColor = Color.spindareBackground(scheme)
        let uploading = isUploadingPhoto

        return VStack(spacing: Spindare.Spacing.sm) {
            PhotosPicker(selection: $pfpPickerItem, matching: .images) {
                AvatarEditBadge(url: avatarURL, isUploading: uploading, backgroundColor: backgroundColor)
            }
            .buttonStyle(.plain)
            .disabled(uploading)
            .padding(.top, Spindare.Spacing.lg)

            Text("@\(profile?.username ?? router.username ?? "you")")
                .font(.system(size: 22, weight: .bold))
                .kerning(-0.5)
                .foregroundStyle(Color.spindarePrimary(scheme))

            Text("Creative Explorer")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.spindareSecondary(scheme))
        }
    }

    private var spinButton: some View {
        Button {
            showSpinner = true
        } label: {
            HStack(spacing: Spindare.Spacing.sm) {
                Image(systemName: "arrow.trianglehead.2.counterclockwise")
                    .font(.system(size: 15, weight: .bold))
                Text("SPIN WHEEL")
                    .spindareLabel(size: 12, weight: .bold, tracking: 1.5)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 28)
            .padding(.vertical, 14)
            .background(Capsule().fill(Spindare.Palette.ink))
            .spindareShadow(Spindare.Shadow(color: Spindare.Palette.ink.opacity(0.25), radius: 12, y: 4))
        }
        .buttonStyle(PressableStyle())
        .padding(.top, Spindare.Spacing.lg)
    }

    /// Totals only. The per-type split belongs on individual posts — up here it
    /// is noise, because an aggregate of three numbers across every post you've
    /// ever made doesn't tell you anything actionable.
    private var stats: some View {
        HStack(spacing: Spindare.Spacing.xl) {
            stat(value: posts.count, label: "Posts")
            Rectangle()
                .fill(Spindare.Hairline.color(scheme, emphasis: 1.6))
                .frame(width: 1, height: 36)
            stat(value: totalReactions, label: "Reactions")
        }
        .padding(.top, Spindare.Spacing.lg)
    }

    private func stat(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.spindarePrimary(scheme))
                .contentTransition(.numericText())
            Text(label)
                .spindareLabel(size: 11, weight: .semibold, tracking: 1)
                .foregroundStyle(Color.spindareSecondary(scheme))
        }
    }

    @ViewBuilder
    private var streakChip: some View {
        let streak = profile?.streak ?? 0
        // SF Symbol rather than an emoji — emoji render inconsistently across
        // font fallbacks and don't take the tint.
        Label(
            streak > 0 ? "\(streak)-day streak" : "Start your first streak",
            systemImage: "flame.fill"
        )
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Spindare.Palette.accentDeep)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Capsule().fill(Spindare.Palette.accent.opacity(0.18)))
        .padding(.top, Spindare.Spacing.md)
    }

    // MARK: - Layout switch

    /// An explicit two-case control rather than a `ForEach` over `[true, false]`.
    /// The old version rendered both segments from a Bool collection, and the
    /// selected-state comparison made the active segment's own button read as a
    /// no-op — so once you were in list mode you could not get back to grid.
    private var layoutToggle: some View {
        HStack(spacing: 0) {
            ForEach(PostLayout.allCases, id: \.self) { option in
                Button {
                    withAnimation(.snappy(duration: 0.32, extraBounce: 0.1)) {
                        layout = option
                    }
                } label: {
                    Image(systemName: option.icon)
                        .font(.system(size: 15, weight: .medium))
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .foregroundStyle(layout == option
                                         ? Color.spindarePrimary(scheme)
                                         : Color.spindareSecondary(scheme))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .background {
            // The selection indicator slides between segments rather than
            // popping, which is what makes a segmented control feel physical.
            GeometryReader { proxy in
                RoundedRectangle(cornerRadius: Spindare.Radius.control - 2, style: .continuous)
                    .fill(Color.spindareSurface(scheme))
                    .spindareElevation(.card)
                    .padding(3)
                    .frame(width: proxy.size.width / CGFloat(PostLayout.allCases.count))
                    .offset(x: layout == .grid ? 0 : proxy.size.width / CGFloat(PostLayout.allCases.count))
            }
        }
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                .fill(Spindare.Hairline.color(scheme, emphasis: 1.2))
        }
        .sensoryFeedback(.selection, trigger: layout)
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.top, Spindare.Spacing.lg)
    }

    // MARK: - Posts

    @ViewBuilder
    private var postGrid: some View {
        if isLoading {
            GridSkeleton().padding(.top, Spindare.Spacing.md)
        } else if posts.isEmpty {
            VStack(spacing: Spindare.Spacing.sm) {
                Image(systemName: "circle.dashed")
                    .font(.system(size: 34, weight: .light))
                Text("No challenges yet")
                    .font(.system(size: 15, weight: .medium))
                Text("Spin the wheel to start.")
                    .font(.system(size: 13))
            }
            .foregroundStyle(Color.spindareSecondary(scheme))
            .padding(.top, 60)
        } else {
            // A plain crossfade rather than a matchedGeometryEffect morph. The
            // morph was tried first — cells sharing an id between gridContent's
            // LazyVGrid and listContent's LazyVStack — but matchedGeometryEffect
            // inside a lazy container only registers a geometry anchor for
            // currently-materialized cells. Once you'd scrolled past the first
            // switch, the reverse transition silently failed to commit: the
            // toggle's own state still flipped (the pill slid, the haptic
            // fired) but the grid underneath didn't follow, which read exactly
            // like the button not working. A crossfade has no such dependency.
            Group {
                switch layout {
                case .grid: gridContent
                case .list: listContent
                }
            }
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 0.98)),
                removal: .opacity
            ))
            .animation(.snappy(duration: 0.32, extraBounce: 0.1), value: layout)
            .padding(.top, Spindare.Spacing.md)
        }
    }

    private var gridContent: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 3), spacing: 3) {
            ForEach(posts) { post in
                Button {
                    fullscreen = Speedy(post: post)
                } label: {
                    Color.clear
                        .aspectRatio(1, contentMode: .fit)
                        .overlay { thumbnail(for: post) }
                        .clipped()
                        .overlay(alignment: .bottomTrailing) {
                            // Totals only at thumbnail scale — the per-type split
                            // is unreadable this small and lives in the list view.
                            if post.reactions.total > 0 {
                                Label("\(post.reactions.total)", systemImage: "sparkles")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 3)
                                    .background(Capsule().fill(.black.opacity(0.45)))
                                    .padding(5)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 3)
    }

    private var listContent: some View {
        LazyVStack(spacing: Spindare.Spacing.md) {
            ForEach(posts) { post in
                VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                    Color.clear
                        .frame(height: 260)
                        .overlay { thumbnail(for: post) }
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous))

                    Text(post.challenge)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.spindareAccent(scheme))

                    if let content = post.content, !content.isEmpty {
                        Text(content)
                            .font(Spindare.Typography.body)
                            .lineSpacing(4)
                            .foregroundStyle(Color.spindarePrimary(scheme))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    // Per-post is exactly where the exact breakdown belongs.
                    HStack(spacing: Spindare.Spacing.sm) {
                        ForEach(ReactionType.allCases, id: \.self) { type in
                            HStack(spacing: 5) {
                                ReactionGlyph(type: type, isActive: true)
                                    .frame(width: 14, height: 14)
                                Text("\(count(of: type, in: post))")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Color.spindarePrimary(scheme))
                                Text(type.rawValue)
                                    .spindareLabel(size: 8, weight: .medium, tracking: 1)
                                    .foregroundStyle(Color.spindareSecondary(scheme))
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background { Capsule().fill(Spindare.Hairline.color(scheme, emphasis: 0.8)) }
                        }
                        Spacer(minLength: 0)
                        Text(post.createdAt.relativeShort)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                }
                .padding(.bottom, Spindare.Spacing.sm)
            }
        }
        .padding(.horizontal, Spindare.Spacing.gutter)
    }

    @ViewBuilder
    private func thumbnail(for post: Post) -> some View {
        if let media = post.media, let url = URL(string: media) {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Color.spindareSurface(scheme)
            }
        } else {
            ZStack {
                Color.spindareSurface(scheme)
                Text(post.content ?? post.challenge)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.spindareSecondary(scheme))
                    .lineLimit(5)
                    .padding(10)
            }
        }
    }

    private func count(of type: ReactionType, in post: Post) -> Int {
        switch type {
        case .felt: post.reactions.felt
        case .thought: post.reactions.thought
        case .intrigued: post.reactions.intrigued
        }
    }

    private func load() async {
        guard let userId = router.userId else { return }
        posts = (try? await feedService.posts(forUser: userId)) ?? []
        profile = try? await profileService.currentProfile()
        isLoading = false
    }
}

// MARK: - Avatar edit badge

/// Its own view rather than inline content, because `PhotosPicker`'s label
/// builder is not main-actor isolated and so can't read `@Environment` or
/// `@State` directly — everything it needs arrives as plain parameters.
private struct AvatarEditBadge: View {
    let url: String?
    let isUploading: Bool
    let backgroundColor: Color

    var body: some View {
        Avatar(url: url, size: 96)
            .overlay {
                if isUploading {
                    Circle().fill(.black.opacity(0.35))
                    ProgressView().tint(.white)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                Circle()
                    .fill(Spindare.Palette.ink)
                    .frame(width: 30, height: 30)
                    .overlay {
                        Image(systemName: "pencil")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .overlay {
                        Circle().strokeBorder(backgroundColor, lineWidth: 3)
                    }
            }
    }
}

// MARK: - Spinner

/// The wheel plus what happens after it stops. Five states in the original;
/// here the result simply routes into the shared composer rather than carrying
/// its own duplicate proof pipeline.
///
/// Presented as a centered popup over a dimmed/blurred backdrop, not a system
/// sheet — a sheet defaults to nearly full-screen height, which reads as the
/// dial eating the whole display for something that's meant to sit in the
/// middle with room around it. Dismissal is a plain closure rather than
/// `@Environment(\.dismiss)`, since that environment action only exists for
/// content presented via `.sheet`/`.fullScreenCover`.
struct SpinnerCard: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    let onDismiss: () -> Void

    @State private var result: String?

    /// The dial should read as an object sitting in the middle of the card,
    /// not as the card itself.
    private var wheelSize: CGFloat {
        #if canImport(UIKit)
        UIScreen.main.bounds.height * 0.4
        #else
        320
        #endif
    }

    var body: some View {
        VStack(spacing: Spindare.Spacing.lg) {
            if let result {
                resultCard(result)
            } else {
                Text("Flick the dial")
                    .spindareLabel(size: 11, weight: .semibold, tracking: 3)
                    .foregroundStyle(Color.spindareSecondary(scheme))
                    .padding(.top, Spindare.Spacing.xl)

                SpinWheel(options: Challenges.all) { landed in
                    withAnimation(Spindare.Motion.enter) { result = landed }
                }
                .frame(maxHeight: wheelSize)
                .padding(.horizontal, Spindare.Spacing.gutter)
                .padding(.bottom, Spindare.Spacing.xl)
            }
        }
        .frame(maxWidth: 420)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                .fill(Color.spindareSurface(scheme))
        }
        .spindareElevation(.floating)
        .overlay(alignment: .topTrailing) {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.spindareSecondary(scheme))
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Color.spindareBackground(scheme)))
            }
            .buttonStyle(.plain)
            .padding(Spindare.Spacing.sm)
        }
    }

    private func resultCard(_ challenge: String) -> some View {
        VStack(spacing: Spindare.Spacing.lg) {
            Text("Challenge unlocked")
                .spindareLabel(size: 11, weight: .semibold, tracking: 3)
                .foregroundStyle(Color.spindareAccent(scheme))

            Text(challenge)
                .font(.system(size: 22, weight: .semibold))
                .kerning(-0.4)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.spindarePrimary(scheme))
                .padding(.horizontal, Spindare.Spacing.gutter)

            VStack(spacing: Spindare.Spacing.sm) {
                Button {
                    onDismiss()
                    router.startProof(for: challenge)
                } label: {
                    Text("Do it")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background {
                            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                                .fill(Spindare.Palette.ink)
                        }
                }
                .buttonStyle(PressableStyle())

                HStack(spacing: Spindare.Spacing.sm) {
                    secondary("Share", icon: "paperplane") {
                        onDismiss()
                        router.shareChallenge(challenge)
                    }
                    secondary("Save", icon: "bookmark") { onDismiss() }
                    secondary("Again", icon: "arrow.clockwise") {
                        withAnimation(Spindare.Motion.enter) { result = nil }
                    }
                }
            }
            .padding(.horizontal, Spindare.Spacing.gutter)
            .padding(.top, Spindare.Spacing.sm)
        }
        .padding(.top, Spindare.Spacing.xl)
        .padding(.bottom, Spindare.Spacing.xl)
    }

    private func secondary(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 15))
                Text(title).font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(Color.spindarePrimary(scheme))
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background {
                RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                    .fill(Spindare.Hairline.color(scheme, emphasis: 0.9))
            }
        }
        .buttonStyle(PressableStyle())
    }
}
