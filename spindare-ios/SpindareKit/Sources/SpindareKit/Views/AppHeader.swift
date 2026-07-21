import SwiftUI

// The app's only fixed chrome — 60pt, and even this hides itself on scroll.
//
// Search is a state of this header rather than a destination: the field grows
// in place while the avatar, bookmark, wordmark and bell unmount around it,
// and results drop out of the bottom of the same container. It is deliberately
// not `.searchable`, which would push a separate surface.

public struct AppHeader: View {
    public static let height: CGFloat = 60

    @Environment(\.colorScheme) private var scheme
    let router: AppRouter
    @Binding var isSearching: Bool
    @Binding var query: String
    let avatarURL: String?
    let savedCount: Int
    /// Unread notifications plus pending connection requests — everything the
    /// bell's drawer would show you if you opened it right now.
    let activityCount: Int
    /// Set once the feed has been scrolled into, so the bar can return in its
    /// condensed form rather than reappearing at full height.
    var compact: Bool = false
    var username: String?

    @FocusState private var searchFocused: Bool
    /// Briefly true right after Cancel collapses the search field. The search
    /// and bell icons re-mount at roughly the same spot Cancel was just sitting
    /// — they're hit-testable the instant they exist, before the collapse
    /// animation has actually finished moving them there, so the same tap (or
    /// the next one, thrown by the still-settling layout) can land on the bell
    /// and open notifications instead of just dismissing search. This blocks
    /// taps on them until the collapse has had time to settle.
    @State private var justCancelledSearch = false

    public init(
        router: AppRouter,
        isSearching: Binding<Bool>,
        query: Binding<String>,
        avatarURL: String?,
        savedCount: Int,
        activityCount: Int = 0,
        compact: Bool = false,
        username: String? = nil
    ) {
        self.router = router
        self._isSearching = isSearching
        self._query = query
        self.avatarURL = avatarURL
        self.savedCount = savedCount
        self.activityCount = activityCount
        self.compact = compact
        self.username = username
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: Spindare.Spacing.sm) {
                if isSearching {
                    searchField
                } else if compact {
                    compactLeading
                    Spacer(minLength: 0)
                    compactTrailing
                } else {
                    leading
                    Spacer(minLength: 0)
                    trailing
                }
            }
            .padding(.horizontal, Spindare.Spacing.md)
            .frame(height: compact && !isSearching ? Self.compactHeight : Self.height)
            .overlay {
                // Centred wordmark, behind the controls so it never steals a
                // tap. Dropped in the compact bar — the username identifies the
                // context there, and the wordmark would just crowd it.
                if !isSearching && !compact {
                    LogoImage(scheme == .dark ? .wordmarkOnDark : .wordmark)
                        .frame(height: 18)
                        .allowsHitTesting(false)
                }
            }
        }
        .background {
            // Translucent once condensed, so feed content shows through and the
            // bar reads as floating over the content rather than clipping it.
            Group {
                if compact && !isSearching {
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(Spindare.Hairline.color(scheme))
                                .frame(height: Spindare.Hairline.width)
                        }
                } else {
                    Color.spindareBackground(scheme)
                }
            }
            .ignoresSafeArea(edges: .top)
        }
        .animation(Spindare.Motion.enter, value: compact)
    }

    /// Condensed height — the compact bar exists to give content back.
    public static let compactHeight: CGFloat = 48

    // MARK: - Compact state
    //
    // Identity on the left (who you are), actions on the right. No bookmark and
    // no wordmark — at this size those are the first things worth cutting.

    private var compactLeading: some View {
        Button {
            router.navigate(to: .profile)
        } label: {
            HStack(spacing: Spindare.Spacing.sm) {
                Avatar(url: avatarURL, size: 26)
                Text("@\(username ?? "you")")
                    .font(.system(size: 14, weight: .semibold))
                    .kerning(-0.2)
                    .foregroundStyle(Color.spindarePrimary(scheme))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .transition(.opacity.combined(with: .move(edge: .leading)))
    }

    private var compactTrailing: some View {
        HStack(spacing: 0) {
            iconButton("magnifyingglass") {
                withAnimation(Spindare.Motion.enter) { isSearching = true }
                searchFocused = true
            }
            iconButton("bell") {
                router.navigate(to: .notifications)
            }
            .overlay(alignment: .topTrailing) {
                if activityCount > 0 {
                    CountBadge(count: activityCount)
                        .offset(x: 2, y: 4)
                }
            }
        }
        .allowsHitTesting(!justCancelledSearch)
        .transition(.opacity.combined(with: .move(edge: .trailing)))
    }

    // MARK: - Idle state

    private var leading: some View {
        HStack(spacing: Spindare.Spacing.xs) {
            Button {
                router.navigate(to: .profile)
            } label: {
                Avatar(url: avatarURL, size: 34)
                    .overlay(alignment: .bottomTrailing) {
                        Circle()
                            .fill(Spindare.Palette.success)
                            .frame(width: 9, height: 9)
                            .overlay(
                                Circle().stroke(Color.spindareBackground(scheme), lineWidth: 1.5)
                            )
                    }
            }
            .buttonStyle(.plain)

            iconButton("bookmark") {
                router.push(.savedDrawer)
            }
            .overlay(alignment: .topTrailing) {
                if savedCount > 0 {
                    SavedBadge(count: savedCount)
                        .offset(x: 2, y: -2)
                }
            }
        }
    }

    private var trailing: some View {
        HStack(spacing: Spindare.Spacing.xs) {
            iconButton("magnifyingglass") {
                withAnimation(Spindare.Motion.enter) { isSearching = true }
                searchFocused = true
            }
            iconButton("bell") {
                router.navigate(to: .notifications)
            }
            .overlay(alignment: .topTrailing) {
                if activityCount > 0 {
                    CountBadge(count: activityCount)
                        .offset(x: 2, y: -2)
                }
            }
        }
        .allowsHitTesting(!justCancelledSearch)
    }

    private func iconButton(_ system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 19, weight: .regular))
                .foregroundStyle(Color.spindarePrimary(scheme))
                .frame(width: 40, height: 40)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Search state

    private var searchField: some View {
        HStack(spacing: Spindare.Spacing.sm) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.spindareSecondary(scheme))

                TextField("Search people, challenges…", text: $query)
                    .focused($searchFocused)
                    .font(Spindare.Typography.body)
                    .foregroundStyle(Color.spindarePrimary(scheme))
                    .submitLabel(.search)
                    .autocorrectionDisabled()
            }
            .padding(.horizontal, Spindare.Spacing.md)
            .frame(height: 38)
            .background {
                RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                    .fill(Color.spindareSurface(scheme))
                    .overlay {
                        RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                            .strokeBorder(Spindare.Hairline.color(scheme), lineWidth: Spindare.Hairline.width)
                    }
            }

            Button("Cancel") {
                searchFocused = false
                query = ""
                justCancelledSearch = true
                withAnimation(Spindare.Motion.enter) { isSearching = false }

                Task {
                    // `Motion.enter` is a spring (stiffness 50, damping 8), not
                    // a fixed-duration animation — this just needs to outlast
                    // how long it visibly takes to settle, not match it exactly.
                    try? await Task.sleep(for: .milliseconds(400))
                    justCancelledSearch = false
                }
            }
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Color.spindareSecondary(scheme))
        }
    }
}

// MARK: - Saved badge

/// Springs in, then pulses forever on a linear 1.8s cycle. Not a count badge —
/// a nagging heartbeat for a challenge you saved and haven't done. The original
/// deliberately never lets it settle.
struct SavedBadge: View {
    let count: Int
    @State private var pulsing = false

    var body: some View {
        Text(count > 9 ? "9+" : "\(count)")
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 4)
            .frame(minWidth: 15, minHeight: 15)
            .background(Circle().fill(Spindare.Palette.accent))
            .scaleEffect(pulsing ? 1.2 : 1.0)
            .onAppear {
                withAnimation(.linear(duration: 0.9).repeatForever(autoreverses: true)) {
                    pulsing = true
                }
            }
            .transition(.scale.combined(with: .opacity))
    }
}

/// A plain count badge — springs in, settles, stays still. `SavedBadge`'s
/// endless pulse is a deliberate nag specific to an undone saved challenge;
/// a notification count doesn't need to nag, just to be visible.
struct CountBadge: View {
    let count: Int

    var body: some View {
        Text(count > 9 ? "9+" : "\(count)")
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 4)
            .frame(minWidth: 15, minHeight: 15)
            .background(Circle().fill(Spindare.Palette.danger))
            .transition(.scale.combined(with: .opacity))
    }
}

// MARK: - Avatar

struct Avatar: View {
    @Environment(\.colorScheme) private var scheme
    let url: String?
    let size: CGFloat

    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            default:
                Circle().fill(Color.spindareSecondary(scheme).opacity(0.25))
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay {
            Circle().strokeBorder(Spindare.Hairline.color(scheme), lineWidth: Spindare.Hairline.width)
        }
    }
}
