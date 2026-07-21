import SwiftUI

// A post is an invitation, not just content — every card offers you the same
// challenge it documents. That's why "Try this challenge" is a primary action and the
// challenge itself is a tappable pill rather than a headline.

public struct PostCardView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    let post: Post
    let isOwner: Bool
    var isSaved: Bool = false
    var onProfileTap: ((AppRouter.UserRef) -> Void)?
    var onReaction: ((ReactionType) -> Void)?
    var onSave: ((String) -> Void)?

    @State private var challengeExpanded = false
    @State private var showActions = false
    @State private var showingViewer = false
    /// Single tap hides the caption and reactions so the photo can be seen.
    @State private var chromeHidden = false
    /// Caption expanded in place, for text too long to fit beside the reactions.
    @State private var captionExpanded = false

    public init(
        post: Post,
        isOwner: Bool = false,
        isSaved: Bool = false,
        onProfileTap: ((AppRouter.UserRef) -> Void)? = nil,
        onReaction: ((ReactionType) -> Void)? = nil,
        onSave: ((String) -> Void)? = nil
    ) {
        self.post = post
        self.isOwner = isOwner
        self.isSaved = isSaved
        self.onProfileTap = onProfileTap
        self.onReaction = onReaction
        self.onSave = onSave
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            authorRow
            challengePill
            media
            if post.media == nil || post.media!.isEmpty {
                body_
                ReactionRow(post: post, isOwner: isOwner) { onReaction?($0) }
                    .padding(.top, Spindare.Spacing.sm)
            }
            actionRow
        }
        // Without this the card sizes to its widest child — a long challenge
        // pill would push it past the screen and clip on both edges.
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Color.spindareSurface(scheme))
        }
        .spindareElevation(.card)
        .sheet(isPresented: $showActions) {
            PostActionsSheet(
                challenge: post.challenge,
                isSaved: isSaved,
                onTake: { showActions = false; router.startProof(for: post.challenge) },
                onShare: { showActions = false; router.shareChallenge(post.challenge) },
                onSaveToggle: { showActions = false; onSave?(post.challenge) },
                onDismiss: { showActions = false }
            )
            .presentationDetents([.height(280)])
            .presentationBackground(.clear)
        }
    }

    // MARK: - Author

    private var authorRow: some View {
        HStack(spacing: Spindare.Spacing.sm) {
            Button {
                onProfileTap?(AppRouter.UserRef(id: post.userId, username: post.author, avatarURL: post.avatar))
            } label: {
                Avatar(url: post.avatar, size: 36)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 1) {
                Text(post.author)
                    .font(Spindare.Typography.authorName)
                    .kerning(Spindare.Typography.authorTracking)
                    .foregroundStyle(Color.spindarePrimary(scheme))

                HStack(spacing: 5) {
                    if let spins = post.spinCount, spins > 0 {
                        Image(systemName: "arrow.trianglehead.2.counterclockwise")
                            .font(.system(size: 9, weight: .bold))
                        Text(spins.abbreviated)
                            .font(Spindare.Typography.timestamp)
                    }
                    Text(post.createdAt.relativeShort)
                        .font(Spindare.Typography.timestamp)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }
                .foregroundStyle(Color.spindareAccent(scheme))
            }

            Spacer(minLength: 0)

            // Save lives up here as a bare icon rather than as a pill competing
            // with the primary action at the bottom of the card. The header's
            // bookmark is the global "Saved" destination; this is the per-post
            // toggle, so it reads as a smaller sibling of it.
            Button { onSave?(post.challenge) } label: {
                Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(isSaved
                                     ? Color.spindareAccent(scheme)
                                     : Color.spindareSecondary(scheme))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.impact(flexibility: .soft), trigger: isSaved)

            Button { showActions = true } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.spindareSecondary(scheme))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spindare.Spacing.md)
        .padding(.top, Spindare.Spacing.md)
    }

    // MARK: - Challenge

    /// Tap expands in place rather than navigating — the challenge stays in context.
    private var challengePill: some View {
        Button {
            withAnimation(Spindare.Motion.enter) { challengeExpanded.toggle() }
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(post.challenge)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(challengeExpanded ? nil : 1)
                    .truncationMode(.tail)
                    .multilineTextAlignment(.leading)

                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .bold))
                    .rotationEffect(.degrees(challengeExpanded ? 180 : 0))
            }
            .foregroundStyle(Color.spindareAccent(scheme))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background {
                RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                    .fill(Spindare.Palette.accent.opacity(scheme == .dark ? 0.14 : 0.18))
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spindare.Spacing.md)
        .padding(.top, Spindare.Spacing.sm)
    }

    // MARK: - Media

    @ViewBuilder
    private var media: some View {
        if let media = post.media, let url = URL(string: media) {
            // Taller frame to fit content overlays.
            Color.clear
                .frame(height: 420)
                .overlay {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        case .failure: mediaPlaceholder(icon: "photo")
                        default: mediaPlaceholder(icon: nil)
                        }
                    }
                }
                // Double-tap must be declared first so the single-tap
                // recogniser defers to it — otherwise one tap always wins and
                // the viewer never opens.
                .onTapGesture(count: 2) {
                    showingViewer = true
                }
                .onTapGesture {
                    withAnimation(.easeOut(duration: 0.2)) { chromeHidden.toggle() }
                }
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous))
            #if os(iOS)
            .fullScreenCover(isPresented: $showingViewer) {
                ImageViewer(url: url, caption: post.content, isPresented: $showingViewer)
                    // The viewer draws its own backdrop and fades it out as
                    // you pull down. Left opaque, the cover's own background
                    // sits behind that fade and the photo appears to dissolve
                    // into a blank sheet rather than back toward the feed.
                    .presentationBackground(.clear)
            }
            #else
            .sheet(isPresented: $showingViewer) {
                ImageViewer(url: url, caption: post.content, isPresented: $showingViewer)
                    // The viewer draws its own backdrop and fades it out as
                    // you pull down. Left opaque, the cover's own background
                    // sits behind that fade and the photo appears to dissolve
                    // into a blank sheet rather than back toward the feed.
                    .presentationBackground(.clear)
            }
            #endif
            .overlay(alignment: .bottom) {
                // Taller and denser than a caption bar needs to look, because
                // the text runs to three lines and the top line was landing on
                // the weak end of the ramp. Eased rather than linear so the
                // transition into the photo stays invisible.
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black.opacity(0.35), location: 0.45),
                        .init(color: .black.opacity(0.85), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 260)
                .allowsHitTesting(false)
                .opacity(chromeHidden ? 0 : 1)
            }
            .overlay(alignment: .bottomLeading) {
                HStack(alignment: .bottom, spacing: Spindare.Spacing.md) {
                    if let content = post.content, !content.isEmpty {
                        // A long caption plus the reaction column left no way to
                        // read the end of the text. Tapping the caption itself
                        // expands it into a scrollable block in place — a
                        // separate target from tapping the photo, which hides
                        // the chrome, so the two gestures don't collide.
                        ScrollView {
                            Text(content)
                                .font(Spindare.Typography.bodyLarge)
                                .lineSpacing(Spindare.Typography.bodyLineSpacing)
                                .foregroundStyle(.white)
                                .shadow(color: .black.opacity(0.5), radius: 3, y: 1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .scrollDisabled(!captionExpanded)
                        .frame(maxHeight: captionExpanded ? 190 : 66)
                        .onTapGesture {
                            withAnimation(Spindare.Motion.enter) { captionExpanded.toggle() }
                        }
                    }

                    Spacer(minLength: 0)

                    ReactionRow(post: post, isOwner: isOwner, axis: .vertical, onImage: true) { onReaction?($0) }
                }
                .padding(Spindare.Spacing.md)
                .opacity(chromeHidden ? 0 : 1)
                // Non-interactive while hidden so taps fall through to the photo.
                .allowsHitTesting(!chromeHidden)
            }
            .overlay(alignment: .topTrailing) {
                if post.isVideo {
                    Text("VIDEO")
                        .spindareLabel(size: 9, weight: .bold, tracking: 1.5)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(.black.opacity(0.55)))
                        .padding(Spindare.Spacing.sm)
                }
            }
            .padding(.horizontal, Spindare.Spacing.md)
            .padding(.top, Spindare.Spacing.md)
        }
    }

    private func mediaPlaceholder(icon: String?) -> some View {
        ZStack {
            Color.spindareBackground(scheme)
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }
        }
    }

    // MARK: - Body

    @ViewBuilder
    private var body_: some View {
        if let content = post.content, !content.isEmpty {
            Text(content)
                .font(Spindare.Typography.bodyLarge)
                .lineSpacing(Spindare.Typography.bodyLineSpacing)
                .foregroundStyle(Color.spindarePrimary(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.top, Spindare.Spacing.md)
        }
    }

    // MARK: - Actions

    /// One full-width action anchoring the card. Save moved up to the author
    /// row so this doesn't have to share the space.
    private var actionRow: some View {
        Button {
            router.startProof(for: post.challenge)
        } label: {
            Text("Try this challenge")
                .font(.system(size: 14, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                        .fill(Spindare.Hairline.color(scheme, emphasis: 1.1))
                }
                .foregroundStyle(Color.spindarePrimary(scheme))
        }
        .buttonStyle(PressableStyle())
        .padding(.horizontal, Spindare.Spacing.md)
        .padding(.top, Spindare.Spacing.sm)
        .padding(.bottom, Spindare.Spacing.md)
    }
}

// MARK: - Spindare Post Actions Sheet

private struct PostActionsSheet: View {
    @Environment(\.colorScheme) private var scheme

    let challenge: String
    let isSaved: Bool
    let onTake: () -> Void
    let onShare: () -> Void
    let onSaveToggle: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: Spindare.Spacing.sm) {
            VStack(alignment: .leading, spacing: 4) {
                Text("CHALLENGE ACTIONS")
                    .spindareLabel(size: 10, weight: .bold, tracking: 2)
                    .foregroundStyle(Color.spindareSecondary(scheme))

                Text(challenge)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.spindarePrimary(scheme))
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spindare.Spacing.md)
            .padding(.top, Spindare.Spacing.md)

            Divider()

            VStack(spacing: 2) {
                row("Take this challenge", icon: "camera.fill", action: onTake)
                row("Send to a friend", icon: "paperplane.fill", action: onShare)
                row(isSaved ? "Remove from saved" : "Save for later", icon: isSaved ? "bookmark.fill" : "bookmark", action: onSaveToggle)
            }

            Spacer(minLength: 0)
        }
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                .fill(Color.spindareSurface(scheme))
                .overlay {
                    RoundedRectangle(cornerRadius: Spindare.Radius.panel, style: .continuous)
                        .strokeBorder(Spindare.Hairline.color(scheme, emphasis: 1.5), lineWidth: 1)
                }
                .spindareElevation(.floating)
        }
        .padding(.horizontal, Spindare.Spacing.md)
    }

    private func row(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spindare.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Spindare.Palette.accentDeep)
                    .frame(width: 24)

                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.spindarePrimary(scheme))

                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spindare.Spacing.md)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}



extension Date {
    /// Same compact style, for the non-optional case. Forwards rather than
    /// duplicating the thresholds — two copies of this drift apart.
    var relativeShort: String { Optional(self).relativeShort }
}

extension Optional where Wrapped == Date {
    /// "now / 5m / 3h / 2d / 4w" — the original's compact style.
    var relativeShort: String {
        guard let self else { return "now" }
        let seconds = Int(Date().timeIntervalSince(self))
        return switch seconds {
        case ..<60: "now"
        case ..<3600: "\(seconds / 60)m"
        case ..<86_400: "\(seconds / 3600)h"
        case ..<604_800: "\(seconds / 86_400)d"
        default: "\(seconds / 604_800)w"
        }
    }
}

extension Int {
    /// 1240 → "1.2k"
    var abbreviated: String {
        if self < 1000 { return "\(self)" }
        let thousands = Double(self) / 1000
        return thousands < 10 ? String(format: "%.1fk", thousands) : "\(Int(thousands))k"
    }
}
