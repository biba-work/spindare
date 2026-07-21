import SwiftUI
import AVKit
import AVFoundation

// Short-form vertical feed of challenge proof.
//
// One card per screen, paged vertically. Only the visible card's player is
// allowed to play — an offscreen `VideoPlayer` left running is the standard
// way a feed like this quietly eats battery and bandwidth for content nobody
// is looking at.

public struct SpeedysView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var speedys: [Speedy] = []
    @State private var favourites: Set<String> = []
    /// Which card is centered — driven by measured frames (`ItemFramesKey`),
    /// the same mechanism the main feed's scroll haptic already relies on.
    ///
    /// `scrollPosition(id:)` alone has a known gap: its binding does not
    /// reliably report an initial value before the scroll view has actually
    /// laid out its content, so a card that should be "current" the moment
    /// this view appears can silently stay unset — nothing ever gets marked
    /// current, `SpeedyMedia` never sees `isCurrent == true`, and no video
    /// ever calls `.play()`. Geometry fires as soon as layout happens, so it
    /// doesn't have that gap.
    @State private var current: String?
    /// Debounces `current`. Without this, every scroll-frame update (up to
    /// 120fps) recomputed "which card is centered" from raw distance with no
    /// hysteresis — near a page boundary mid-drag, two adjacent cards can be
    /// nearly equidistant and repeatedly swap being "closest" as the frame
    /// numbers jitter by fractions of a point. Each swap tore down and
    /// recreated an `AVPlayer` (pause, remove observer, `AVPlayer(url:)`,
    /// `.play()`) — real work, repeated many times a second, which is what
    /// "really laggy" during scroll actually was.
    @State private var pendingCurrentTask: Task<Void, Never>?
    @State private var isLoading = true
    @State private var toast: Toast?
    /// Ticks so the sponsored delay re-evaluates while you're sitting here —
    /// without it, a post that ages past five minutes wouldn't appear until
    /// something else happened to redraw the view.
    @State private var now = Date()

    private let speedyService: any SpeedyServing

    public init(speedyService: any SpeedyServing = MockSpeedyService()) {
        self.speedyService = speedyService
    }

    /// Sponsored posts by other people are withheld for five minutes — see
    /// `SponsoredVisibility` for why. Applied here rather than in the service
    /// so the pending-count note below can still see what's being held.
    private var visible: [Speedy] {
        SponsoredVisibility.visible(speedys, viewerId: router.userId, now: now)
    }

    private var pendingCount: Int {
        speedys.count - visible.count
    }

    private let scrollSpace = "speedys"

    public var body: some View {
        GeometryReader { viewport in
            ZStack {
                Color.black.ignoresSafeArea()

                if isLoading {
                    ProgressView().tint(.white)
                } else if visible.isEmpty {
                    emptyState
                } else {
                    ScrollView(.vertical) {
                        LazyVStack(spacing: 0) {
                            ForEach(visible) { speedy in
                                SpeedyCard(
                                    speedy: speedy,
                                    isOwn: speedy.userId == router.userId,
                                    isFavourite: favourites.contains(speedy.id),
                                    isCurrent: current == speedy.id,
                                    onReact: { type, previous in react(type, replacing: previous, on: speedy) },
                                    onFavourite: { toggleFavourite(speedy) },
                                    onShare: { share(speedy) },
                                    onDoThis: { router.startProof(for: speedy.challenge) },
                                    onProfileTap: {
                                        router.push(.userProfile(
                                            .init(id: speedy.userId, username: speedy.author, avatarURL: speedy.avatar)
                                        ))
                                    }
                                )
                                .containerRelativeFrame(.vertical)
                                .reportsFrame(id: speedy.id, in: scrollSpace)
                                .id(speedy.id)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.paging)
                    .scrollIndicators(.hidden)
                    .coordinateSpace(name: scrollSpace)
                    .onPreferenceChange(ItemFramesKey.self) { frames in
                        let candidate = centeredItem(among: frames, viewportHeight: viewport.size.height)
                        guard candidate != current else { return }
                        // Cancel-and-restart on every update: only the
                        // *last* candidate in a burst ever survives long
                        // enough to fire, so a rapid flap between two cards
                        // never commits either of them until motion actually
                        // stops.
                        pendingCurrentTask?.cancel()
                        pendingCurrentTask = Task {
                            try? await Task.sleep(for: .milliseconds(120))
                            guard !Task.isCancelled else { return }
                            current = candidate
                        }
                    }
                    .ignoresSafeArea()
                }

                if pendingCount > 0 {
                    pendingNote
                }
            }
        }
        .toast($toast)
        .task { await load() }
        // A minute is the right cadence for a five-minute gate: fine enough
        // that a post never sits held for meaningfully longer than it should,
        // coarse enough to be free.
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                now = Date()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spindare.Spacing.sm) {
            Image(systemName: "play.rectangle")
                .font(.system(size: 34, weight: .light))
            Text("Nothing here yet")
                .font(.system(size: 16, weight: .medium))
            Text("Complete a challenge and it shows up here.")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(.white.opacity(0.7))
        .padding(.horizontal, Spindare.Spacing.xl)
    }

    /// Tells you *that* something is being held without revealing anything
    /// about it — no author, no venue, no count breakdown by place. Otherwise
    /// this note would leak exactly what the delay exists to protect.
    private var pendingNote: some View {
        VStack {
            Spacer()
            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.system(size: 11, weight: .semibold))
                Text("\(pendingCount) sponsored \(pendingCount == 1 ? "post" : "posts") arriving shortly")
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(.white.opacity(0.85))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(.black.opacity(0.55)))
            .padding(.bottom, 120)
        }
        .allowsHitTesting(false)
    }

    // MARK: - Actions

    private func react(_ type: ReactionType, replacing previous: ReactionType?, on speedy: Speedy) {
        Task {
            try? await speedyService.setReaction(type, replacing: previous, speedyId: speedy.id)
        }
    }

    private func toggleFavourite(_ speedy: Speedy) {
        let wasFavourite = favourites.contains(speedy.id)
        withAnimation(Spindare.Motion.pop) {
            if wasFavourite { favourites.remove(speedy.id) } else { favourites.insert(speedy.id) }
        }
        Haptics.impact(.light)
        toast = Toast(wasFavourite ? "Removed" : "Favourited", icon: wasFavourite ? "star.slash" : "star.fill")

        Task {
            // The service's own return value is the source of truth — it
            // computes its "was it favourited" independently of whatever
            // we've got locally. Discarding it (as the previous version did)
            // meant the two could quietly drift apart: a rapid double-tap, or
            // any moment local and persisted state weren't already in perfect
            // sync, left the button toggling the *opposite* of what it showed
            // on the next tap — which reads exactly as "buggy" with no
            // obvious cause, because the visible state and the real state
            // had already disagreed before you ever tapped it.
            guard let isNowFavourite = try? await speedyService.toggleFavourite(speedyId: speedy.id) else { return }
            if isNowFavourite != favourites.contains(speedy.id) {
                withAnimation(Spindare.Motion.pop) {
                    if isNowFavourite { favourites.insert(speedy.id) } else { favourites.remove(speedy.id) }
                }
            }
        }
    }

    private func share(_ speedy: Speedy) {
        router.shareChallenge(speedy.challenge)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        async let fetched = speedyService.speedys()
        async let saved = speedyService.favourites()
        speedys = (try? await fetched) ?? []
        favourites = (try? await saved) ?? []
        now = Date()
        // `current` is deliberately not set here — geometry (`onPreferenceChange`
        // in `body`) owns it, and fires the moment the first card actually
        // lays out. Setting it here too would just be a value that gets
        // immediately overwritten, or briefly wrong if it raced ahead of layout.
    }
}

// MARK: - Card

struct SpeedyCard: View {
    let speedy: Speedy
    let isOwn: Bool
    let isFavourite: Bool
    let isCurrent: Bool
    /// `previous` is nil on a first-ever reaction, and the prior pick when
    /// switching within the window below.
    let onReact: (ReactionType, ReactionType?) -> Void
    let onFavourite: () -> Void
    let onShare: () -> Void
    let onDoThis: () -> Void
    /// Nil on `OwnSpeedyViewer` — tapping into your own profile from your own
    /// fullscreen post isn't a real destination, so that call site just
    /// doesn't supply one rather than wiring a no-op closure.
    var onProfileTap: (() -> Void)? = nil

    /// Which reaction the viewer picked. Local so the card can show the choice
    /// back immediately — there are no visible counts to update, so this is
    /// the only feedback there is.
    @State private var picked: ReactionType?
    /// Once true, no further switching — the window has closed.
    @State private var reactionsLocked = false
    /// Started once, on the *first* pick, and never restarted by a later
    /// switch — "2 seconds to change your mind", not "2 seconds since your
    /// last tap". Cancelling and reassigning on each new task is what makes a
    /// stray earlier timer not fire after a rapid switch made it stale.
    @State private var reactionLockTask: Task<Void, Never>?
    /// Cumulative rotation for the favourite button's spin — see
    /// `favouriteButton` below.
    @State private var favouriteSpin: Double = 0

    /// How long you have to change your reaction after picking one.
    private static let reactionSwitchWindow: Duration = .seconds(2)

    var body: some View {
        // Explicit geometry rather than trusting `.frame(maxWidth: .infinity)`
        // to propagate correctly through the ZStack → HStack chain below.
        // That chain relies on every ancestor actually proposing a real width
        // down to it — this card's only ancestor constraint is
        // `containerRelativeFrame(.vertical)` from `SpeedysView`, which (as
        // the name says) only touches height. Reading the width directly
        // here removes any dependency on that propagation working, which is
        // the previous version's actual bug: it depended on an assumption
        // that didn't hold, and the entire bottom row rendered at less than
        // full width as a result — text clipped on one edge, the reaction
        // rail pushed off the other.
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                SpeedyMedia(speedy: speedy, isCurrent: isCurrent)

                // Without this the white text sits directly on whatever the
                // video happens to be showing, which is unreadable on a
                // bright frame.
                LinearGradient(
                    colors: [.clear, .black.opacity(0.35), .black.opacity(0.85)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)

                HStack(alignment: .bottom, spacing: Spindare.Spacing.md) {
                    details
                    Spacer(minLength: 0)
                    sideRail
                        // Reserved first, so `details` can never eat into the
                        // space the rail needs.
                        .layoutPriority(1)
                }
                .frame(width: proxy.size.width - Spindare.Spacing.gutter * 2, alignment: .leading)
                .padding(.horizontal, Spindare.Spacing.gutter)
                // Clears both the home indicator and the floating
                // mode-switcher pill (bottom safe-area inset + the pill's own
                // height/padding), measured explicitly rather than guessed —
                // a fixed constant here was an earlier version's actual bug:
                // it happened to clear some devices' safe areas and not
                // others.
                .padding(.bottom, Self.bottomClearance)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
    }

    /// Mode-switcher pill height (~34pt) + its own bottom padding
    /// (`Spindare.Spacing.lg`) + a margin of safety — deliberately independent
    /// of the device's actual safe-area inset, which this card can't read
    /// from inside a `GeometryReader`-free context. Generous on purpose: too
    /// much clearance costs a little vertical space, too little repeats
    /// exactly the bug being fixed.
    private static let bottomClearance: CGFloat = 150

    // MARK: Left column

    private var details: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let sponsor = speedy.sponsor {
                HStack(spacing: 5) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 11, weight: .semibold))
                    Text(sponsor.name)
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.black)
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(Capsule().fill(Spindare.Palette.accent))
            }

            Button {
                onProfileTap?()
            } label: {
                HStack(spacing: 7) {
                    Avatar(url: speedy.avatar, size: 26)
                    Text("@\(speedy.author)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(onProfileTap == nil)

            Text(speedy.challenge)
                .font(.system(size: 19, weight: .bold))
                .kerning(-0.3)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text(speedy.detail)
                .font(.system(size: 14))
                .lineSpacing(3)
                .foregroundStyle(.white.opacity(0.85))
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)

            // Your own card shows what people chose, in their colours. You
            // can't react to your own post, so the same space carries the
            // result instead of controls.
            if isOwn {
                ownReactionSummary
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var ownReactionSummary: some View {
        HStack(spacing: 14) {
            ForEach(ReactionType.allCases, id: \.self) { type in
                HStack(spacing: 5) {
                    Circle()
                        .fill(Spindare.Palette.color(for: type))
                        .frame(width: 8, height: 8)
                    Text(type.rawValue)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white.opacity(0.9))
                    Text("\(count(for: type))")
                        .font(.system(size: 12, weight: .bold).monospacedDigit())
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(.top, 2)
    }

    private func count(for type: ReactionType) -> Int {
        switch type {
        case .felt: speedy.reactions.felt
        case .thought: speedy.reactions.thought
        case .intrigued: speedy.reactions.intrigued
        }
    }

    // MARK: Right rail

    private var sideRail: some View {
        // 5 items (3 reactions + share + favourite) at the old 18pt spacing
        // added up to roughly 370pt of vertical rail — on an actual phone
        // screen that reads as "spread across half the display", not as one
        // compact control. Tightened to something an Instagram-style rail
        // actually looks like.
        VStack(spacing: 8) {
            if isOwn {
                // Your own card: no reacting to yourself, and "Do again"
                // instead of "Do this".
                railButton(icon: "paperplane.fill", label: "Share", action: onShare)
                railButton(icon: "arrow.counterclockwise", label: "Do again", action: onDoThis)
            } else {
                // Shuffled per card so the buttons can't become muscle memory
                // — see `ReactionLayout`. Counts are deliberately absent:
                // knowing what everyone else picked is exactly the pressure
                // this app exists to remove.
                ForEach(ReactionLayout.order(for: speedy.id), id: \.self) { type in
                    reactionButton(type)
                }

                railButton(icon: "paperplane.fill", label: "Share", action: onShare)
                favouriteButton
            }
        }
        .frame(width: 62)
    }

    /// A dedicated button rather than another `railButton(...)` call, since
    /// this one has its own flourish: a full spin on every tap, which
    /// `railButton`'s other uses (Share, Do again) have no reason to repeat.
    private var favouriteButton: some View {
        Button {
            withAnimation(Spindare.Motion.settle) { favouriteSpin += 360 }
            onFavourite()
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    Circle().fill(.white.opacity(0.16)).frame(width: 40, height: 40)
                    Image(systemName: isFavourite ? "star.fill" : "star")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(isFavourite ? Spindare.Palette.thought : .white)
                        // Cumulative rather than snapping back to 0 — that
                        // would spin the wrong way on every other tap, since
                        // rotation always animates the shorter arc back to a
                        // fixed target.
                        .rotationEffect(.degrees(favouriteSpin))
                }
                Text("Favourite")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(.plain)
    }

    /// The same `ReactionButton` the main feed uses (`onImage: true`, since
    /// a Speedy card *is* a photo/video background) — not a second,
    /// hand-rolled version. The earlier version filled the whole circle with
    /// the reaction's saturated colour and skipped the ripple/burst/haptic
    /// entirely, which is exactly why it read as visually inconsistent next
    /// to how reacting looks everywhere else in the app: it *was* a different
    /// implementation, not a matter of colors needing a tweak.
    private func reactionButton(_ type: ReactionType) -> some View {
        let isPicked = picked == type

        return ReactionButton(type: type, isActive: isPicked, onImage: true) {
            pick(type)
        }
        .overlay {
            // A quiet pulse on the picked reaction while the switch window
            // is still open — enough that you register "I can still change
            // this," not enough to look like the button is nagging you.
            if isPicked && !reactionsLocked {
                BlinkingRing(color: Spindare.Palette.color(for: type))
            }
        }
        // Once the window closes the other two stop responding. Before that,
        // any of the three — including the one already picked — can still be
        // tapped to switch.
        .opacity(reactionsLocked && !isPicked ? 0.4 : 1)
        .allowsHitTesting(!reactionsLocked)
    }

    /// One reaction, with a short window to change your mind.
    ///
    /// The window is timed from the *first* pick and never restarted by a
    /// later switch — "you have 2 seconds to decide," not "2 seconds since
    /// your last tap," which would let someone keep it open indefinitely by
    /// switching right before it closes.
    private func pick(_ type: ReactionType) {
        guard !reactionsLocked else { return }
        let previous = picked
        guard previous != type else { return }

        picked = type
        onReact(type, previous)

        guard previous == nil else { return }
        reactionLockTask?.cancel()
        reactionLockTask = Task {
            try? await Task.sleep(for: Self.reactionSwitchWindow)
            guard !Task.isCancelled else { return }
            withAnimation(Spindare.Motion.settle) { reactionsLocked = true }
        }
    }

    private func railButton(
        icon: String,
        label: String,
        tint: Color = .white,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.16))
                        .frame(width: 40, height: 40)
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(tint)
                }
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(PressableStyle(.subtle))
    }
}

// MARK: - Own post, full-screen

/// One of your own posts, opened from the profile grid.
///
/// Wraps the same `SpeedyCard` the feed uses with `isOwn: true`, so the owner
/// treatment — reaction results in their colours instead of tappable
/// controls, "Do again" instead of "Do this" — comes from one place rather
/// than a parallel implementation that would slowly diverge.
public struct OwnSpeedyViewer: View {
    @Environment(AppRouter.self) private var router

    let speedy: Speedy
    let onClose: () -> Void

    public init(speedy: Speedy, onClose: @escaping () -> Void) {
        self.speedy = speedy
        self.onClose = onClose
    }

    public var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            SpeedyCard(
                speedy: speedy,
                isOwn: true,
                isFavourite: false,
                isCurrent: true,
                onReact: { _, _ in },
                onFavourite: {},
                onShare: {
                    onClose()
                    router.shareChallenge(speedy.challenge)
                },
                onDoThis: {
                    onClose()
                    router.startProof(for: speedy.challenge)
                }
            )
            .ignoresSafeArea()

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(.black.opacity(0.45)))
                    .padding(Spindare.Spacing.md)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Reaction switch-window indicator

/// A quiet, continuous pulse around the currently-picked reaction while it
/// can still be changed. Deliberately subtle — a fast or high-contrast pulse
/// would read as an alert; this only needs to register at the edge of
/// attention, the same way a text cursor blinking doesn't demand you watch it.
private struct BlinkingRing: View {
    let color: Color
    @State private var dim = false

    var body: some View {
        Circle()
            .stroke(color.opacity(dim ? 0.15 : 0.8), lineWidth: 2)
            .frame(width: 46, height: 46)
            .allowsHitTesting(false)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) {
                    dim = true
                }
            }
    }
}

// MARK: - Media

/// Video when there is one, still image otherwise.
///
/// The player is created only for the card that's actually on screen and torn
/// down when it leaves — a `LazyVStack` keeps neighbours alive, so without
/// this every card you'd scrolled past would still be decoding video.
struct SpeedyMedia: View {
    let speedy: Speedy
    let isCurrent: Bool

    @State private var player: AVPlayer?
    /// Set if the item fails — a bad URL, no connectivity, an unsupported
    /// format. Without this, a failed load leaves `VideoPlayer` showing
    /// AVKit's own "media unavailable" glyph forever, sitting on screen like
    /// a broken control. Falling back to the poster is the same degraded
    /// path a photo-only card already takes, so a network hiccup reads as
    /// "this one's a photo" rather than as the app being broken.
    @State private var failed = false
    @State private var statusObservation: NSKeyValueObservation?

    // Playback controls — previously nothing at all was reachable, because
    // `VideoPlayer` had `.allowsHitTesting(false)` (correctly, to let taps
    // reach the card's own chrome) with no substitute controls added in its
    // place.
    @State private var isPlaying = true
    @State private var isMuted = true
    @State private var rate: Float = 1.0

    var body: some View {
        ZStack {
            Color.black

            // Always present underneath: it's the poster while the video
            // buffers, and the whole card when there's no video at all —
            // or when the video failed, per `failed` above.
            if let poster = speedy.posterURL, let url = URL(string: poster) {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Color.black
                    }
                }
            }

            if let player, !failed {
                VideoPlayer(player: player)
                    .allowsHitTesting(false)
            }

            if player != nil, !failed, !isPlaying {
                Image(systemName: "play.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(.black.opacity(0.35)))
                    .allowsHitTesting(false)
                    .transition(.opacity.combined(with: .scale(scale: 0.8)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .contentShape(Rectangle())
        .onTapGesture { togglePlayback() }
        .overlay(alignment: .topTrailing) {
            if player != nil, !failed {
                controls
            }
        }
        .onChange(of: isCurrent, initial: true) { _, current in
            current ? start() : stop()
        }
        .onDisappear(perform: stop)
    }

    private var controls: some View {
        HStack(spacing: 8) {
            controlButton(isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill") {
                toggleMute()
            }
            controlButton(rate == 2 ? "2x" : "1x", isSymbol: false) {
                toggleSpeed()
            }
        }
        .padding(Spindare.Spacing.md)
    }

    @ViewBuilder
    private func controlButton(_ content: String, isSymbol: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Group {
                if isSymbol {
                    Image(systemName: content).font(.system(size: 13, weight: .semibold))
                } else {
                    Text(content).font(.system(size: 12, weight: .bold))
                }
            }
            .foregroundStyle(.white)
            .frame(width: 32, height: 32)
            .background(Circle().fill(.black.opacity(0.45)))
        }
        .buttonStyle(.plain)
    }

    private func togglePlayback() {
        guard let player else { return }
        isPlaying.toggle()
        withAnimation(Spindare.Motion.precise) {
            player.rate = isPlaying ? rate : 0
        }
        Haptics.impact(.light)
    }

    private func toggleMute() {
        guard let player else { return }
        isMuted.toggle()
        player.isMuted = isMuted
        Haptics.impact(.light)
    }

    private func toggleSpeed() {
        guard let player else { return }
        rate = rate == 2 ? 1 : 2
        // Setting `.rate` on a paused player would itself start playback —
        // AVFoundation has no separate "preferred rate while paused"
        // concept, `rate` *is* the play command. Only push it live if
        // actually playing; otherwise it's just remembered for next `play()`.
        if isPlaying { player.rate = rate }
        Haptics.impact(.light)
    }

    private func start() {
        guard speedy.videoURL != nil, player == nil,
              let raw = speedy.videoURL, let url = URL(string: raw)
        else {
            if isPlaying { player?.rate = rate }
            return
        }

        failed = false
        isPlaying = true
        rate = 1.0

        // Defensive: this app also records voice notes elsewhere
        // (`VoiceRecorder`), which sets the audio session to `.playAndRecord`
        // while recording. If that category were ever left active, a new
        // `AVPlayer` here could fail to produce output at all. Explicitly
        // returning to `.playback` before creating the player means this
        // never depends on some other feature having cleaned up after itself
        // correctly.
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif

        let created = AVPlayer(url: url)
        created.isMuted = isMuted
        created.actionAtItemEnd = .none
        player = created
        created.play()

        // Falls back to the poster rather than leaving AVKit's error glyph on
        // screen — a bad network on a real device (unlike the Simulator,
        // which rides the Mac's connection) is a real, recoverable case, not
        // a bug to surface as a stuck icon.
        statusObservation = created.currentItem?.observe(\.status, options: [.new]) { item, _ in
            guard item.status == .failed else { return }
            Task { @MainActor in failed = true }
        }

        // Loops. A short-form card that stops on its last frame reads as
        // broken playback rather than as a finished clip.
        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: created.currentItem,
            queue: .main
        ) { _ in
            created.seek(to: .zero)
            created.play()
        }
    }

    private func stop() {
        player?.pause()
        if let item = player?.currentItem {
            NotificationCenter.default.removeObserver(
                self,
                name: .AVPlayerItemDidPlayToEndTime,
                object: item
            )
        }
        statusObservation?.invalidate()
        statusObservation = nil
        player = nil
    }
}
