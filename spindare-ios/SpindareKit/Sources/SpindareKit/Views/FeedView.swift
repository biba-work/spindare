import SwiftUI

// The app's one persistent surface.
//
// This view owns no chrome of its own — AppShell provides the header, which
// hides on scroll. It reports its scroll offset upward so the shell can drive
// that. (An earlier version rendered its own "SPINDARE / Your feed" header,
// which double-stacked with the shell's.)

public struct FeedView: View {
    @Environment(\.colorScheme) private var scheme
    @State private var vm = FeedViewModel()
    /// The post currently centered in the viewport — drives the barely-there
    /// haptic tick as you scroll from one to the next. View-geometry state,
    /// not business logic, so it lives here rather than in `FeedViewModel`.
    @State private var centeredPostId: String?

    // From the router / environment — the signed-in user
    var currentUserId: String?
    var currentUsername: String?
    var currentAvatar: String?

    var onProfileTap: ((AppRouter.UserRef) -> Void)?
    var onChallengeTap: ((String) -> Void)?

    private let scrollSpace = "feed"

    public init(
        currentUserId: String? = nil,
        currentUsername: String? = nil,
        currentAvatar: String? = nil,
        onProfileTap: ((AppRouter.UserRef) -> Void)? = nil,
        onChallengeTap: ((String) -> Void)? = nil
    ) {
        self.currentUserId = currentUserId
        self.currentUsername = currentUsername
        self.currentAvatar = currentAvatar
        self.onProfileTap = onProfileTap
        self.onChallengeTap = onChallengeTap
    }

    public var body: some View {
        GeometryReader { viewport in
            ScrollView {
                LazyVStack(spacing: Spindare.Spacing.md) {
                    if vm.isLoading && vm.posts.isEmpty {
                        FeedSkeleton()
                            .accessibilityLabel("Loading feed")
                    } else if let error = vm.error, vm.posts.isEmpty {
                        errorState(error)
                    } else if vm.posts.isEmpty {
                        // Loaded fine, just nothing to show — a brand-new or
                        // empty backend. Distinct from the network-error state
                        // above so an empty feed doesn't read as broken.
                        emptyState
                    } else {
                        ForEach(vm.posts) { post in
                            PostCardView(
                                post: post,
                                isOwner: post.userId == currentUserId,
                                isSaved: vm.savedChallenges.contains { $0.challenge == post.challenge },
                                onProfileTap: onProfileTap,
                                onReaction: { type in
                                    Task {
                                        await vm.react(
                                            to: post.id,
                                            type: type,
                                            username: currentUsername ?? "",
                                            avatar: currentAvatar
                                        )
                                    }
                                },
                                onSave: { challenge in
                                    Task { await vm.saveChallenge(challenge) }
                                }
                            )
                            .padding(.horizontal, Spindare.Spacing.sm)
                            .reportsFrame(id: post.id, in: scrollSpace)
                            .scrollTransition(
                                .animated(.interpolatingSpring(stiffness: 50, damping: 8)),
                                axis: .vertical
                            ) { content, phase in
                                content
                                    .opacity(phase.isIdentity ? 1 : 0.6)
                                    .scaleEffect(phase.isIdentity ? 1 : 0.94)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.top, Spindare.Spacing.sm)
                .padding(.bottom, 80)
                .reportsScrollOffset(in: scrollSpace)
            }
            .scrollIndicators(.hidden)
            .onPreferenceChange(ItemFramesKey.self) { frames in
                let current = centeredItem(among: frames, viewportHeight: viewport.size.height)
                if current != centeredPostId { centeredPostId = current }
            }
            // .selection is the lightest built-in haptic — the same one the
            // drawer's tab switcher already uses — and reads as a barely-there
            // tick rather than a bump, matching what was asked for.
            .sensoryFeedback(.selection, trigger: centeredPostId)
        }
        .background(Color.spindareBackground(scheme))
        .refreshable {
            await vm.refresh()
        }
        .task {
            await vm.loadFeed()
        }
    }

    // MARK: - States

    private var loadingPlaceholder: some View {
        VStack(spacing: Spindare.Spacing.md) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Spindare.Radius.card)
                    .fill(Color.white)
                    .frame(height: 280)
                    .spindareShadow(.card)
                    .overlay {
                        VStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Spindare.Palette.cream)
                                .frame(height: 20)
                                .padding(.horizontal, 40)
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Spindare.Palette.cream)
                                .frame(height: 160)
                                .padding(.horizontal, 16)
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Spindare.Palette.cream)
                                .frame(height: 14)
                                .padding(.horizontal, 60)
                        }
                    }
                    .redacted(reason: .placeholder)
                    .shimmering()
            }
        }
        .padding(.horizontal, Spindare.Spacing.md)
    }

    private var emptyState: some View {
        VStack(spacing: Spindare.Spacing.md) {
            Image(systemName: "sparkles")
                .font(.system(size: 44))
                .foregroundStyle(Spindare.Palette.textSecondary)

            Text("Nothing here yet")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Spindare.Palette.ink)

            Text("Spin a challenge and be the first to post.")
                .font(.system(size: 15))
                .foregroundStyle(Spindare.Palette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
        .padding(.horizontal, Spindare.Spacing.xl)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spindare.Spacing.md) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 44))
                .foregroundStyle(Spindare.Palette.textSecondary)

            Text(message)
                .font(.system(size: 15))
                .foregroundStyle(Spindare.Palette.textSecondary)
                .multilineTextAlignment(.center)

            Button("Retry") {
                Task { await vm.loadFeed() }
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Spindare.Palette.ink)
            .padding(.horizontal, 24)
            .padding(.vertical, 10)
            .background(Color.white)
            .clipShape(Capsule())
            .spindareShadow(.card)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }
}


// MARK: - Shimmer effect for loading skeletons

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay {
                LinearGradient(
                    colors: [
                        .clear,
                        Color.white.opacity(0.4),
                        .clear
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 300)
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 1
                    }
                }
            }
            .clipped()
    }
}

extension View {
    func shimmering() -> some View {
        modifier(ShimmerModifier())
    }
}

// Previews require Xcode — they'll live in the app target once the project exists.
// #Preview("Feed") { FeedView() }
