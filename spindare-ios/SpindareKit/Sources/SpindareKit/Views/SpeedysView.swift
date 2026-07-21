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
    /// Cards the viewer marked "not interested" this session — dropped locally,
    /// no backend signal. A `Set` so the filter below stays O(1) per card.
    @State private var notInterested: Set<String> = []

    private var visible: [Speedy] {
        SponsoredVisibility.visible(speedys, viewerId: router.userId, now: now)
            .filter { !notInterested.contains($0.id) }
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
                                    },
                                    onReport: { report(speedy) },
                                    onNotInterested: { hideCard(speedy) }
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

    private func report(_ speedy: Speedy) {
        // No moderation backend yet — acknowledge the flag so it doesn't feel
        // like a dead control, and drop the card from view like "not interested".
        toast = Toast("Reported — thanks for flagging", icon: "flag")
        hideCard(speedy)
    }

    private func hideCard(_ speedy: Speedy) {
        withAnimation(Spindare.Motion.enter) { _ = notInterested.insert(speedy.id) }
        Haptics.impact(.light)
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
    /// Menu actions the media view bubbles up: report (feed shows a toast) and
    /// "not interested" (feed drops the card). Default to no-ops for the own-post
    /// viewer, which has no menu.
    var onReport: () -> Void = {}
    var onNotInterested: () -> Void = {}

    /// Fullscreen mode from the action menu — hides this card's chrome (gradient,
    /// details, rail) so the media fills the screen unobstructed. Tap to restore.
    @State private var chromeHidden = false

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
    /// Reads the user's Settings preference (default 2s).
    @AppStorage(AppSettingsKey.speedyReactionWindow) private var reactionWindowSetting = 2.0
    @AppStorage(AppSettingsKey.hideReactionCounts) private var hideReactionCounts = false
    private var reactionSwitchWindow: Duration { .seconds(reactionWindowSetting) }

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
                SpeedyMedia(
                    speedy: speedy,
                    isCurrent: isCurrent,
                    chromeHidden: $chromeHidden,
                    onReport: onReport,
                    onNotInterested: onNotInterested
                )

                // Without this the white text sits directly on whatever the
                // video happens to be showing, which is unreadable on a
                // bright frame.
                LinearGradient(
                    colors: [.clear, .black.opacity(0.35), .black.opacity(0.85)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)
                .opacity(chromeHidden ? 0 : 1)

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
                // Fullscreen hides the chrome so the media fills the frame.
                .opacity(chromeHidden ? 0 : 1)
                .allowsHitTesting(!chromeHidden)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
            .animation(Spindare.Motion.precise, value: chromeHidden)
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
                    if !hideReactionCounts {
                        Text("\(count(for: type))")
                            .font(.system(size: 12, weight: .bold).monospacedDigit())
                            .foregroundStyle(.white)
                    }
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

        return ReactionButton(
            type: type,
            isActive: isPicked,
            showBlinkingRing: isPicked && !reactionsLocked,
            onImage: true
        ) {
            pick(type)
        }
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
            try? await Task.sleep(for: self.reactionSwitchWindow)
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
    /// Fullscreen mode hides the card's chrome (gradient, rail, details) for a
    /// clean view. Owned by `SpeedyCard` so it can dim its own overlays; toggled
    /// from the long-press menu here.
    @Binding var chromeHidden: Bool
    /// Bubble up the two menu actions this view can't resolve itself: a report
    /// (the feed shows the toast) and "not interested" (the feed drops the card).
    var onReport: () -> Void = {}
    var onNotInterested: () -> Void = {}

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

    // Gesture-driven UI: hold the sides to fast-forward, hold the middle for the
    // action menu. All local, no backend except the two bubbled-up callbacks.
    @State private var isHolding = false
    @State private var rateBeforeHold: Float = 1
    @State private var wasPlayingBeforeHold = true
    @State private var showMenu = false
    @State private var showWhy = false

    /// Fraction of the width each side hold-zone occupies; the middle is the rest.
    private static let edgeZoneFraction: CGFloat = 0.28

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

            if player != nil, !failed, !isPlaying, !isHolding {
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
        // Zoned gestures sit above the video: tap or hold either side to
        // fast-forward, tap the middle to pause, hold the middle for the menu.
        .overlay { gestureZones }
        // Mute lives just below the centre now, not in a top-right cluster.
        .overlay(alignment: .center) { centreControls }
        .overlay(alignment: .top) { fastForwardHUD }
        .overlay { menuOverlay }
        .onChange(of: isCurrent, initial: true) { _, current in
            current ? start() : stop()
        }
        .onDisappear(perform: stop)
        .sheet(isPresented: $showWhy) { whySheet }
    }

    // MARK: Gesture zones

    private var gestureZones: some View {
        GeometryReader { geo in
            let edge = geo.size.width * Self.edgeZoneFraction
            HStack(spacing: 0) {
                holdZone.frame(width: edge)
                centreZone.frame(maxWidth: .infinity)
                holdZone.frame(width: edge)
            }
        }
    }

    /// Left/right: tap toggles play like the middle, hold engages 2x until release.
    private var holdZone: some View {
        Color.clear
            .contentShape(Rectangle())
            .onTapGesture { togglePlayback() }
            .gesture(fastForwardGesture)
    }

    /// Middle: tap toggles play, long-press opens the action menu.
    private var centreZone: some View {
        Color.clear
            .contentShape(Rectangle())
            .onTapGesture { togglePlayback() }
            .onLongPressGesture(minimumDuration: 0.35) { openMenu() }
    }

    /// A long-press that, once it passes the threshold, tracks the finger until
    /// release — the standard "hold to fast-forward" shape. A quick tap never
    /// completes the long-press, so it falls through to `onTapGesture` above.
    private var fastForwardGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.2)
            .sequenced(before: DragGesture(minimumDistance: 0))
            .onChanged { value in
                if case .second(true, _) = value { beginHold() }
            }
            .onEnded { _ in endHold() }
    }

    // MARK: Overlays

    @ViewBuilder
    private var centreControls: some View {
        if player != nil, !failed {
            Button { toggleMute() } label: {
                Image(systemName: isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(.black.opacity(0.4)))
            }
            .buttonStyle(.plain)
            // Sits below where the centre play/pause glyph appears.
            .offset(y: 56)
        }
    }

    @ViewBuilder
    private var fastForwardHUD: some View {
        if isHolding {
            HStack(spacing: 4) {
                Image(systemName: "forward.fill").font(.system(size: 11, weight: .bold))
                Text("2x").font(.system(size: 12, weight: .bold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule().fill(.black.opacity(0.55)))
            .padding(.top, 60)
            .transition(.opacity)
            .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private var menuOverlay: some View {
        if showMenu {
            SpeedyActionMenu(
                rate: rate,
                onSpeed: { setRate($0) },
                onReport: { closeMenu(); onReport() },
                onNotInterested: { closeMenu(); onNotInterested() },
                onFullScreen: { closeMenu(); withAnimation(Spindare.Motion.precise) { chromeHidden.toggle() } },
                onWhy: { closeMenu(); showWhy = true },
                onDismiss: { closeMenu() }
            )
            .transition(.opacity)
            .zIndex(100)
        }
    }

    private var whySheet: some View {
        VStack(spacing: Spindare.Spacing.md) {
            Image(systemName: "sparkles").font(.system(size: 34))
                .foregroundStyle(Spindare.Palette.accent)
            Text("Why you're seeing this")
                .font(.system(size: 18, weight: .bold))
            Text("Challenge proofs show up here from people near you and challenges others are taking on right now — not an endless algorithm, just real things people did.")
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Got it") { showWhy = false }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(RoundedRectangle(cornerRadius: Spindare.Radius.control).fill(Spindare.Palette.ink))
        }
        .padding(Spindare.Spacing.lg)
        .presentationDetents([.medium])
    }

    // MARK: Playback control

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

    /// Sets a specific playback rate from the menu's Speed options. Setting
    /// `.rate` on a paused player would itself start playback (AVFoundation has
    /// no "preferred rate while paused"), so only push it live while playing.
    private func setRate(_ value: Float) {
        rate = value
        if isPlaying { player?.rate = value }
        Haptics.impact(.light)
    }

    private func beginHold() {
        guard !isHolding, player != nil else { return }
        rateBeforeHold = rate
        wasPlayingBeforeHold = isPlaying
        withAnimation(Spindare.Motion.precise) { isHolding = true }
        rate = 2
        isPlaying = true
        player?.rate = 2
        Haptics.impact(.light)
    }

    private func endHold() {
        guard isHolding else { return }
        withAnimation(Spindare.Motion.precise) { isHolding = false }
        rate = rateBeforeHold
        isPlaying = wasPlayingBeforeHold
        player?.rate = wasPlayingBeforeHold ? rateBeforeHold : 0
    }

    private func openMenu() {
        withAnimation(Spindare.Motion.enter) { showMenu = true }
        Haptics.impact(.medium)
    }

    private func closeMenu() {
        withAnimation(Spindare.Motion.enter) { showMenu = false }
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
        isHolding = false

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
        isHolding = false
    }
}

// MARK: - Speedy action menu

/// The grouped popup a middle-hold opens — one panel that slides up as a unit
/// (not row-by-row), over a tap-to-dismiss scrim. Speed expands inline to a row
/// of rate options; everything else is a single tap.
private struct SpeedyActionMenu: View {
    let rate: Float
    let onSpeed: (Float) -> Void
    let onReport: () -> Void
    let onNotInterested: () -> Void
    let onFullScreen: () -> Void
    let onWhy: () -> Void
    let onDismiss: () -> Void

    @State private var showSpeeds = false

    private static let speeds: [Float] = [0.5, 1, 1.5, 2]

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.35)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { onDismiss() }

            VStack(spacing: 0) {
                if showSpeeds {
                    HStack(spacing: 8) {
                        ForEach(Self.speeds, id: \.self) { value in
                            Button {
                                onSpeed(value)
                            } label: {
                                Text(speedLabel(value))
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(rate == value ? .black : .white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 40)
                                    .background(
                                        Capsule().fill(rate == value ? .white : .white.opacity(0.16))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Spindare.Spacing.md)
                    .padding(.vertical, Spindare.Spacing.sm)
                    Divider().overlay(.white.opacity(0.15))
                }

                row("Report", icon: "flag", action: onReport)
                row(showSpeeds ? "Hide speed" : "Speed", icon: "gauge.with.dots.needle.67percent") {
                    withAnimation(Spindare.Motion.enter) { showSpeeds.toggle() }
                }
                row("Not interested", icon: "hand.thumbsdown", action: onNotInterested)
                row("Full screen", icon: "arrow.up.left.and.arrow.down.right", action: onFullScreen)
                row("Why this post", icon: "questionmark.circle", action: onWhy)
            }
            .padding(.vertical, Spindare.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                    .fill(Color(hex: 0x1A1A1E).opacity(0.92))
                    .overlay {
                        RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                    }
                    .spindareElevation(.floating)
            )
            .padding(.horizontal, Spindare.Spacing.lg)
            .padding(.bottom, 100)
            // The whole panel arrives as one unit rather than element-by-element.
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private func speedLabel(_ value: Float) -> String {
        value == value.rounded() ? "\(Int(value))x" : "\(value)x"
    }

    private func row(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spindare.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 24)
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                Spacer(minLength: 0)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, Spindare.Spacing.md)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
