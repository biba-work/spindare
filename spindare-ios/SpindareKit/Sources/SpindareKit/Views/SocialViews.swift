import SwiftUI
import PhotosUI

// The social side channel: sending a challenge, viewing someone else, and messages.
//
// These are peripheral by design. DMs are not a peer of the feed in this app —
// you reach them through the activity drawer, and a challenge sent to a friend
// arrives as a message rather than as its own inbox.

// MARK: - Friend picker

/// Deliberately the highest layer in the stack. You can open it from inside the
/// spinner result and land back exactly where you were, spinner intact.
public struct FriendPickerView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var friends: [Friend] = []
    @State private var sentTo: Set<String> = []
    @State private var query = ""

    private let socialService: any SocialServing

    public init(socialService: any SocialServing = AppEnvironment.socialService) {
        self.socialService = socialService
    }

    private var filtered: [Friend] {
        guard !query.isEmpty else { return friends }
        return friends.filter { $0.username.localizedCaseInsensitiveContains(query) }
    }

    public var body: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()

            VStack(spacing: 0) {
                header
                dareBanner

                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filtered) { friend in
                            row(friend)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spindare.Spacing.gutter)
                }
                .scrollIndicators(.hidden)
            }
        }
        .task { friends = (try? await socialService.friends()) ?? [] }
    }

    private var header: some View {
        HStack {
            Button { router.pop() } label: {
                Text("Cancel")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }
            Spacer()
            Text("Send to")
                .spindareLabel(size: 11, weight: .semibold, tracking: 3)
                .foregroundStyle(Color.spindarePrimary(scheme))
            Spacer()
            Color.clear.frame(width: 50, height: 20)
        }
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.vertical, Spindare.Spacing.md)
    }

    @ViewBuilder
    private var dareBanner: some View {
        if let challenge = router.challenge {
            Text(challenge)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.spindareAccent(scheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spindare.Spacing.md)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                        .fill(Spindare.Palette.accent.opacity(scheme == .dark ? 0.12 : 0.16))
                }
                .padding(.horizontal, Spindare.Spacing.gutter)
                .padding(.bottom, Spindare.Spacing.md)
        }
    }

    private func row(_ friend: Friend) -> some View {
        HStack(spacing: Spindare.Spacing.md) {
            Avatar(url: friend.photoURL, size: 44)

            Text("@\(friend.username)")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.spindarePrimary(scheme))

            Spacer(minLength: 0)

            Button {
                send(to: friend)
            } label: {
                Text(sentTo.contains(friend.id) ? "Sent" : "Send")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(sentTo.contains(friend.id)
                                     ? Color.spindareSecondary(scheme) : .white)
                    .padding(.horizontal, 16)
                    .frame(height: 34)
                    .background {
                        Capsule().fill(
                            sentTo.contains(friend.id)
                                ? AnyShapeStyle(Spindare.Hairline.color(scheme, emphasis: 1.4))
                                : AnyShapeStyle(Spindare.Palette.ink)
                        )
                    }
            }
            .buttonStyle(PressableStyle())
            .disabled(sentTo.contains(friend.id))
        }
        .padding(.vertical, Spindare.Spacing.sm)
    }

    /// Actually sends the current challenge to a friend's SPIND inbox.
    /// Optimistic — the row flips to "Sent" immediately and only reverts if the
    /// request fails, so a tap feels instant on a good connection.
    private func send(to friend: Friend) {
        guard let challenge = router.challenge, !sentTo.contains(friend.id) else { return }
        withAnimation(Spindare.Motion.enter) { _ = sentTo.insert(friend.id) }
        Task {
            do {
                try await socialService.sendSpind(toUserId: friend.id, challenge: challenge)
            } catch {
                withAnimation(Spindare.Motion.enter) { _ = sentTo.remove(friend.id) }
            }
        }
    }
}

// MARK: - Someone else's profile

public struct UserProfileView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    let user: AppRouter.UserRef

    @State private var posts: [Post] = []
    @State private var isFollowing = false

    private let feedService: any FeedServing

    public init(user: AppRouter.UserRef, feedService: any FeedServing = AppEnvironment.feedService) {
        self.user = user
        self.feedService = feedService
    }

    public var body: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spindare.Spacing.md) {
                    Avatar(url: user.avatarURL, size: 88)
                        .padding(.top, Spindare.Spacing.lg)

                    Text("@\(user.username)")
                        .font(.system(size: 20, weight: .bold))
                        .kerning(-0.4)
                        .foregroundStyle(Color.spindarePrimary(scheme))

                    HStack(spacing: Spindare.Spacing.sm) {
                        Button {
                            withAnimation(Spindare.Motion.enter) { isFollowing.toggle() }
                        } label: {
                            Text(isFollowing ? "Connected" : "Connect")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(isFollowing
                                                 ? Color.spindarePrimary(scheme) : .white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background {
                                    RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                        .fill(isFollowing
                                              ? AnyShapeStyle(Spindare.Hairline.color(scheme, emphasis: 1.4))
                                              : AnyShapeStyle(Spindare.Palette.ink))
                                }
                        }
                        .buttonStyle(PressableStyle())

                        Button {
                            router.openChat(.init(
                                id: "conv-\(user.id)",
                                otherUsername: user.username,
                                otherAvatarURL: user.avatarURL
                            ))
                        } label: {
                            Image(systemName: "bubble.left")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.spindarePrimary(scheme))
                                .frame(width: 52, height: 44)
                                .background {
                                    RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                        .fill(Spindare.Hairline.color(scheme, emphasis: 1.4))
                                }
                        }
                        .buttonStyle(PressableStyle())
                    }
                    .padding(.horizontal, Spindare.Spacing.gutter)

                    grid
                }
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .top) { closeBar }
        .task { posts = (try? await feedService.posts(forUser: user.id)) ?? [] }
    }

    private var closeBar: some View {
        HStack {
            Button { router.pop() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.spindarePrimary(scheme))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            Spacer()
        }
        .background(Color.spindareBackground(scheme))
    }

    @ViewBuilder
    private var grid: some View {
        if posts.isEmpty {
            Text("No challenges yet")
                .font(.system(size: 14))
                .foregroundStyle(Color.spindareSecondary(scheme))
                .padding(.top, 60)
        } else {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 3), spacing: 3) {
                ForEach(posts) { post in
                    Color.clear
                        .aspectRatio(1, contentMode: .fit)
                        .overlay {
                            if let media = post.media, let url = URL(string: media) {
                                AsyncImage(url: url) { $0.resizable().scaledToFill() }
                                    placeholder: { Color.spindareSurface(scheme) }
                            } else {
                                Color.spindareSurface(scheme)
                            }
                        }
                        .clipped()
                }
            }
            .padding(.horizontal, 3)
            .padding(.top, Spindare.Spacing.sm)
        }
    }
}

// MARK: - Messages

public struct MessagesView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var conversations: [Conversation] = []
    @State private var archivedCount = 0
    @State private var isLoading = true
    @State private var toast: Toast?
    /// Usernames the signed-in user has ghosted or blocked. Local-only for now
    /// — there's no moderation endpoint — but the row has to be able to
    /// disappear immediately either way, so the list state is the same shape
    /// it would be with one.
    @State private var suppressed: Set<String> = []

    private let chatService: any ChatServing
    /// Rendered inside the notifications pager's Messages tab rather than as
    /// its own layer, so it drops its background and title bar.
    private let embedded: Bool

    public init(
        chatService: any ChatServing = MockChatService(),
        embedded: Bool = false
    ) {
        self.chatService = chatService
        self.embedded = embedded
    }

    /// Most recent first — the one ordering a message list can have. The old
    /// list rendered `Friend`, which carries no timestamp, so it had nothing to
    /// sort by and showed whatever order the friends endpoint returned.
    private var visible: [Conversation] {
        conversations
            .filter { !suppressed.contains($0.id) }
            .sortedByRecency()
    }

    public var body: some View {
        Group {
            if embedded { scroller } else { standalone }
        }
        .toast($toast)
        .task { await load() }
    }

    private var standalone: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()
            scroller
        }
        .safeAreaInset(edge: .top) {
            LayerTitleBar(title: "Messages") { router.pop() }
        }
    }

    @ViewBuilder
    private var scroller: some View {
        if isLoading {
            VStack {
                RowSkeleton(count: 6)
                    .padding(.horizontal, Spindare.Spacing.gutter)
                    .padding(.top, Spindare.Spacing.lg)
                Spacer(minLength: 0)
            }
        } else if visible.isEmpty && archivedCount == 0 {
            VStack(spacing: Spindare.Spacing.sm) {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 32, weight: .light))
                Text("No conversations")
                    .font(.system(size: 15, weight: .medium))
                Text("Send someone a challenge to start one.")
                    .font(.system(size: 13))
            }
            .foregroundStyle(Color.spindareSecondary(scheme))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, 80)
        } else {
            ScrollView {
                // `spacing: 0` with explicit dividers, rather than spaced rows:
                // a swipe action has to fill the row's full height, and a gap
                // between rows would show the background through the coloured
                // action panel as it slides out.
                LazyVStack(spacing: 0) {
                    // Only once something's actually been inboxed — a fixed
                    // "Inboxed (0)" row with nowhere useful to go is clutter,
                    // and the moment the first swipe happens this appears at
                    // the top, right where the thread that just triggered it
                    // was, so the connection reads as immediate.
                    if archivedCount > 0 {
                        inboxEntry
                        Rectangle()
                            .fill(Spindare.Hairline.color(scheme))
                            .frame(height: Spindare.Hairline.width)
                            .padding(.leading, 48 + Spindare.Spacing.md + Spindare.Spacing.gutter)
                    }

                    ForEach(visible) { conversation in
                        row(conversation)

                        if conversation.id != visible.last?.id {
                            Rectangle()
                                .fill(Spindare.Hairline.color(scheme))
                                .frame(height: Spindare.Hairline.width)
                                // Starts past the avatar, the way a system list
                                // inset does — a divider running the full width
                                // cuts the avatar column into unrelated boxes.
                                .padding(.leading, 48 + Spindare.Spacing.md + Spindare.Spacing.gutter)
                        }
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    /// Entry point into `ArchivedMessagesView`. This is the whole fix for
    /// "inboxed messages are unreachable" — swiping Inbox already worked, it
    /// just filed threads somewhere nothing ever pointed back to.
    private var inboxEntry: some View {
        Button {
            router.push(.archivedMessages)
        } label: {
            HStack(spacing: Spindare.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(Spindare.Hairline.color(scheme, emphasis: 1.4))
                        .frame(width: 48, height: 48)
                    Image(systemName: "tray.and.arrow.down.fill")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }

                Text("Inboxed")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.spindarePrimary(scheme))

                Spacer(minLength: 0)

                Text("\(archivedCount)")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.spindareSecondary(scheme))

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }
            .padding(.horizontal, Spindare.Spacing.gutter)
            .padding(.vertical, Spindare.Spacing.md)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Row

    private func row(_ conversation: Conversation) -> some View {
        SwipeActionRow(actions: actions(for: conversation)) {
            Button {
                router.openChat(conversation.ref)
            } label: {
                ConversationRow(conversation: conversation)
            }
            .buttonStyle(.plain)
            .contextMenu {
                Button {
                    setMuted(!conversation.isMuted, on: conversation)
                } label: {
                    Label(
                        conversation.isMuted ? "Unmute" : "Mute",
                        systemImage: conversation.isMuted ? "bell" : "bell.slash"
                    )
                }

                // Ghosting is the softer of the two on purpose — it hides the
                // thread without telling the other person anything, which is
                // the behaviour this app's users actually reach for. Blocking
                // is the heavier one and is marked destructive to match.
                Button {
                    suppress(conversation, note: "Ghosted")
                } label: {
                    Label("Ghost", systemImage: "moon.zzz")
                }

                Button(role: .destructive) {
                    suppress(conversation, note: "Blocked")
                } label: {
                    Label("Block", systemImage: "hand.raised")
                }
            }
        }
        .frame(height: 76)
    }

    private func actions(for conversation: Conversation) -> [SwipeAction] {
        [
            SwipeAction(
                id: "mute",
                title: conversation.isMuted ? "Unmute" : "Mute",
                icon: conversation.isMuted ? "bell" : "bell.slash",
                tint: Color(white: 0.55)
            ) {
                setMuted(!conversation.isMuted, on: conversation)
            },
            SwipeAction(
                id: "inbox",
                title: "Inbox",
                icon: "tray.and.arrow.down",
                tint: Spindare.Palette.accentDeep
            ) {
                archive(conversation)
            },
            // Last, so it sits at the trailing edge under the thumb — and it's
            // the one the over-swipe stage expands into.
            SwipeAction(
                id: "delete",
                title: "Delete",
                icon: "trash",
                tint: Spindare.Palette.danger,
                role: .destructive
            ) {
                delete(conversation)
            },
        ]
    }

    // MARK: - Actions
    //
    // All optimistic: the row leaves immediately and comes back only if the
    // call fails. Waiting on the round trip after a swipe that has already
    // visibly committed reads as the gesture not having registered.

    private func delete(_ conversation: Conversation) {
        let snapshot = conversations
        withAnimation(Spindare.Motion.settle) {
            conversations.removeAll { $0.id == conversation.id }
        }
        toast = Toast("Deleted", icon: "trash")

        Task {
            do {
                try await chatService.deleteConversation(id: conversation.id)
            } catch {
                withAnimation(Spindare.Motion.settle) { conversations = snapshot }
                toast = Toast("Couldn't delete", icon: "exclamationmark.triangle")
            }
        }
    }

    private func archive(_ conversation: Conversation) {
        let snapshot = conversations
        withAnimation(Spindare.Motion.settle) {
            conversations.removeAll { $0.id == conversation.id }
            archivedCount += 1
        }
        toast = Toast("Inboxed", icon: "tray.and.arrow.down")

        Task {
            do {
                try await chatService.archiveConversation(id: conversation.id)
            } catch {
                withAnimation(Spindare.Motion.settle) {
                    conversations = snapshot
                    archivedCount -= 1
                }
                toast = Toast("Couldn't move", icon: "exclamationmark.triangle")
            }
        }
    }

    private func setMuted(_ muted: Bool, on conversation: Conversation) {
        guard let index = conversations.firstIndex(where: { $0.id == conversation.id }) else { return }
        withAnimation(Spindare.Motion.settle) { conversations[index].isMuted = muted }
        toast = Toast(muted ? "Muted" : "Unmuted", icon: muted ? "bell.slash" : "bell")

        Task {
            try? await chatService.setMuted(muted, conversationId: conversation.id)
        }
    }

    /// Block and ghost both hide the thread. Local-only until there's an
    /// endpoint behind them — surfacing them as working when the other person
    /// can still reach you would be worse than not offering them.
    private func suppress(_ conversation: Conversation, note: String) {
        withAnimation(Spindare.Motion.settle) { _ = suppressed.insert(conversation.id) }
        Haptics.impact(.medium)
        toast = Toast(note, icon: "checkmark")
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        async let active = chatService.conversations()
        async let archived = chatService.archivedConversations()
        conversations = (try? await active) ?? []
        archivedCount = (try? await archived)?.count ?? 0
    }
}

// MARK: - Archived (inboxed) messages

/// Everything filed away with the "Inbox" swipe action. Reachable, not a dead
/// end: a thread here can be moved back to the main list or deleted outright,
/// the same two exits `MessagesView` offers, just without the third ("Inbox")
/// option that got it here in the first place.
public struct ArchivedMessagesView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @State private var conversations: [Conversation] = []
    @State private var isLoading = true
    @State private var toast: Toast?

    private let chatService: any ChatServing

    public init(chatService: any ChatServing = MockChatService()) {
        self.chatService = chatService
    }

    private var visible: [Conversation] { conversations.sortedByRecency() }

    public var body: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()

            if isLoading {
                VStack {
                    RowSkeleton(count: 4)
                        .padding(.horizontal, Spindare.Spacing.gutter)
                        .padding(.top, Spindare.Spacing.lg)
                    Spacer(minLength: 0)
                }
            } else if visible.isEmpty {
                VStack(spacing: Spindare.Spacing.sm) {
                    Image(systemName: "tray")
                        .font(.system(size: 32, weight: .light))
                    Text("Nothing inboxed")
                        .font(.system(size: 15, weight: .medium))
                    Text("Threads you inbox from Messages show up here.")
                        .font(.system(size: 13))
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(Color.spindareSecondary(scheme))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, Spindare.Spacing.xl)
                .padding(.bottom, 80)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(visible) { conversation in
                            row(conversation)

                            if conversation.id != visible.last?.id {
                                Rectangle()
                                    .fill(Spindare.Hairline.color(scheme))
                                    .frame(height: Spindare.Hairline.width)
                                    .padding(.leading, 48 + Spindare.Spacing.md + Spindare.Spacing.gutter)
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
        .safeAreaInset(edge: .top) {
            LayerTitleBar(title: "Inboxed") { router.pop() }
        }
        .toast($toast)
        .task { await load() }
    }

    private func row(_ conversation: Conversation) -> some View {
        SwipeActionRow(actions: [
            SwipeAction(
                id: "restore",
                title: "Chats",
                icon: "tray.and.arrow.up",
                tint: Spindare.Palette.accentDeep
            ) { restore(conversation) },
            SwipeAction(
                id: "delete",
                title: "Delete",
                icon: "trash",
                tint: Spindare.Palette.danger,
                role: .destructive
            ) { delete(conversation) },
        ]) {
            Button {
                router.openChat(conversation.ref)
            } label: {
                ConversationRow(conversation: conversation)
            }
            .buttonStyle(.plain)
        }
        .frame(height: 76)
    }

    private func restore(_ conversation: Conversation) {
        let snapshot = conversations
        withAnimation(Spindare.Motion.settle) {
            conversations.removeAll { $0.id == conversation.id }
        }
        toast = Toast("Moved to chats", icon: "tray.and.arrow.up")

        Task {
            do {
                try await chatService.unarchiveConversation(id: conversation.id)
            } catch {
                withAnimation(Spindare.Motion.settle) { conversations = snapshot }
                toast = Toast("Couldn't move", icon: "exclamationmark.triangle")
            }
        }
    }

    private func delete(_ conversation: Conversation) {
        let snapshot = conversations
        withAnimation(Spindare.Motion.settle) {
            conversations.removeAll { $0.id == conversation.id }
        }
        toast = Toast("Deleted", icon: "trash")

        Task {
            do {
                try await chatService.deleteConversation(id: conversation.id)
            } catch {
                withAnimation(Spindare.Motion.settle) { conversations = snapshot }
                toast = Toast("Couldn't delete", icon: "exclamationmark.triangle")
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        conversations = (try? await chatService.archivedConversations()) ?? []
    }
}

/// One thread's row.
///
/// Top-aligned, leading-aligned: the previous version centred everything
/// vertically and let the text column drift toward the middle of the row, so
/// with a short preview line the whole row read as floating. Pinning the avatar
/// and the first text line to the top edge is what makes a list of these scan
/// as a column.
private struct ConversationRow: View {
    @Environment(\.colorScheme) private var scheme
    let conversation: Conversation

    var body: some View {
        HStack(alignment: .top, spacing: Spindare.Spacing.md) {
            Avatar(url: conversation.otherAvatarURL, size: 48)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("@\(conversation.otherUsername)")
                        .font(.system(size: 15, weight: conversation.unreadCount > 0 ? .semibold : .medium))
                        .foregroundStyle(Color.spindarePrimary(scheme))

                    if conversation.isMuted {
                        Image(systemName: "bell.slash.fill")
                            .font(.system(size: 9))
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }

                    Spacer(minLength: 0)

                    Text(conversation.lastMessageAt.relativeShort)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }

                HStack(alignment: .top, spacing: 6) {
                    Text(conversation.lastMessage.isEmpty ? "No messages yet" : conversation.lastMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(
                            conversation.unreadCount > 0
                                ? Color.spindarePrimary(scheme)
                                : Color.spindareSecondary(scheme)
                        )
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)

                    Spacer(minLength: 0)

                    // Suppressed while muted: a count on a thread you've
                    // silenced is a notification by another route.
                    if conversation.unreadCount > 0, !conversation.isMuted {
                        Text("\(conversation.unreadCount)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .frame(minWidth: 17, minHeight: 17)
                            .background(Circle().fill(Spindare.Palette.accent))
                    }
                }
            }
        }
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.top, Spindare.Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .contentShape(Rectangle())
    }
}

// MARK: - Chat

public struct ChatView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    let conversation: AppRouter.ConversationRef
    @State private var draft = ""
    @State private var vm: ChatViewModel
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var recorder = VoiceRecorder()
    /// Live size while the send button is held, so the draft previews at the
    /// size it will send at.
    @State private var emphasisPreview: CGFloat?
    @State private var toast: Toast?

    public init(conversation: AppRouter.ConversationRef, chatService: any ChatServing = MockChatService()) {
        self.conversation = conversation
        _vm = State(initialValue: ChatViewModel(conversation: conversation, chatService: chatService))
    }

    public var body: some View {
        ZStack {
            Color.spindareBackground(scheme).ignoresSafeArea()

            ScrollView {
                LazyVStack(spacing: Spindare.Spacing.md) {
                    if vm.isLoading && vm.messages.isEmpty {
                        RowSkeleton(count: 4, showsAvatar: false)
                            .padding(.horizontal, Spindare.Spacing.md)
                    } else {
                        ForEach(vm.messages) { message in
                            bubble(for: message)
                        }
                    }
                }
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.top, Spindare.Spacing.md)
            }
            .scrollIndicators(.hidden)
            .defaultScrollAnchor(.bottom)
        }
        .safeAreaInset(edge: .top) { chatBar }
        .safeAreaInset(edge: .bottom) { composer }
        .toast($toast)
        .task { await vm.load() }
        .onChange(of: pickerItem) { _, item in
            Task {
                guard let raw = try? await item?.loadTransferable(type: Data.self) else { return }
                await attachImage(raw)
                pickerItem = nil
            }
        }
        #if os(iOS)
        .fullScreenCover(isPresented: $showCamera) {
            CameraCapture(supportsVideo: false) { image, _ in
                showCamera = false
                guard let image else { return }
                Task { await attachImage(image) }
            }
            .ignoresSafeArea()
        }
        #endif
    }

    /// Title bar plus the call controls.
    private var chatBar: some View {
        HStack(spacing: 0) {
            Button { router.pop() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }

            Avatar(url: conversation.otherAvatarURL, size: 30)
                .padding(.trailing, 8)

            Text("@\(conversation.otherUsername)")
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(1)

            Spacer(minLength: 0)

            // Present, and honest about not being connected. Spindare has no
            // signalling server, no TURN/STUN, and no push infrastructure to
            // ring a device — a call button that opened a convincing call
            // screen would be a prop, and the first person to tap it would
            // think the app was broken rather than unfinished.
            Button { toast = Toast("Calls aren't available yet", icon: "phone.badge.waveform") } label: {
                Image(systemName: "phone")
                    .font(.system(size: 16, weight: .medium))
                    .frame(width: 40, height: 44)
                    .contentShape(Rectangle())
            }

            Button { toast = Toast("Video calls aren't available yet", icon: "video.badge.ellipsis") } label: {
                Image(systemName: "video")
                    .font(.system(size: 16, weight: .medium))
                    .frame(width: 40, height: 44)
                    .contentShape(Rectangle())
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.spindarePrimary(scheme))
        .padding(.horizontal, Spindare.Spacing.sm)
        .background(Color.spindareBackground(scheme))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Spindare.Hairline.color(scheme))
                .frame(height: Spindare.Hairline.width)
        }
    }

    private func attachImage(_ raw: Data) async {
        #if canImport(UIKit)
        let compressed = ImageCompression.compress(raw) ?? raw
        #else
        let compressed = raw
        #endif

        // Written to a real file rather than held as `Data` on the message:
        // bubbles are rendered in a lazy stack that rebuilds on every scroll,
        // and keeping full images in memory per message is how a long
        // conversation runs the app out of it.
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("chat-\(UUID().uuidString).jpg")
        guard (try? compressed.write(to: url)) != nil else { return }

        await vm.send(
            "",
            currentUserId: router.userId ?? "",
            payload: .image(url: url)
        )
    }

    // MARK: - Bubble

    @ViewBuilder
    private func bubble(for message: Message) -> some View {
        let isMine = message.senderId == router.userId

        HStack(alignment: .bottom, spacing: 6) {
            if isMine { Spacer(minLength: 40) }

            HStack(spacing: 6) {
                if isMine && message.delivery == .failed {
                    // Tap the warning to resend rather than retyping — the
                    // text is still sitting right there in the bubble.
                    Button {
                        Task { await vm.retry(message) }
                    } label: {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(Spindare.Palette.danger)
                    }
                    .buttonStyle(.plain)
                }

                payloadContent(for: message, isMine: isMine)
                    // Sending reads as provisional until confirmed — the
                    // dimming is the only signal, since a spinner per-bubble
                    // would be noisy on a fast connection.
                    .opacity(message.delivery == .sending ? 0.6 : 1)
            }

            if !isMine { Spacer(minLength: 40) }
        }
        .transition(.asymmetric(
            insertion: .move(edge: .bottom).combined(with: .scale(scale: 0.9, anchor: isMine ? .bottomTrailing : .bottomLeading)),
            removal: .opacity
        ))
    }

    @ViewBuilder
    private func payloadContent(for message: Message, isMine: Bool) -> some View {
        switch message.payload {
        case .text:
            Text(message.text)
                // An emphasised message renders at the size its sender chose
                // by holding send. Line spacing scales with it, or a large
                // multi-line message sets solid.
                .font(.system(size: message.emphasis ?? 16, weight: message.emphasis == nil ? .regular : .semibold))
                .lineSpacing(message.emphasis == nil ? Spindare.Typography.bodyLineSpacing : 2)
                .foregroundStyle(bubbleText(isMine: isMine))
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.vertical, 10)
                .background {
                    bubbleShape(isMine: isMine)
                        .fill(bubbleFill(isMine: isMine))
                        .overlay {
                            // Only the incoming bubble needs an edge — the
                            // outgoing one is a solid dark fill and already has
                            // one by contrast.
                            if !isMine {
                                bubbleShape(isMine: isMine)
                                    .strokeBorder(
                                        Spindare.Hairline.color(scheme, emphasis: 1.4),
                                        lineWidth: Spindare.Hairline.width
                                    )
                            }
                        }
                }

        case .image(let url):
            // Unbubbled and clipped to the same corner geometry: a photo inside
            // a coloured bubble wastes a strip of width on padding that adds
            // nothing, which is why no messaging app does it.
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    Image(systemName: "photo")
                        .font(.system(size: 22, weight: .light))
                        .foregroundStyle(Color.spindareSecondary(scheme))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                default:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(width: 220, height: 260)
            .background(Color.spindareSurface(scheme))
            .clipShape(bubbleShape(isMine: isMine))

        case .voice(let url, let duration, let samples):
            VoiceNoteBubble(url: url, duration: duration, samples: samples, isMine: isMine)
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.vertical, 10)
                .background {
                    bubbleShape(isMine: isMine)
                        .fill(bubbleFill(isMine: isMine))
                }
        }
    }

    // MARK: Bubble identity
    //
    // The two senders have to be tellable apart at a glance, and they weren't:
    // an incoming bubble was `spindareSurface`, which in light mode is pure
    // white sitting on a cream background — a 5-value difference, so the
    // bubble had no visible edge and read as loose text. Outgoing was the
    // dusty accent with white text on top, which is a low-contrast pairing in
    // its own right.
    //
    // Now they differ on fill *and* on text colour, in the direction the whole
    // app already uses: yours is the solid ink fill used for primary buttons,
    // theirs is a surface with a hairline edge. Alignment and the tail corner
    // still say the same thing — this just means you don't have to rely on
    // them.

    private func bubbleFill(isMine: Bool) -> Color {
        if isMine {
            return scheme == .dark ? Spindare.Palette.accentDeep : Spindare.Palette.ink
        }
        return scheme == .dark ? Spindare.Palette.surfaceDark : .white
    }

    private func bubbleText(isMine: Bool) -> Color {
        isMine ? .white : Color.spindarePrimary(scheme)
    }

    /// Three corners rounded evenly, the fourth pulled in tight — that single
    /// corner is what reads as a tail without needing hand-rolled bezier
    /// geometry. Mirrored across the two senders so it always points toward
    /// whoever's bubble it belongs to.
    private func bubbleShape(isMine: Bool) -> UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Spindare.Radius.card,
            bottomLeadingRadius: isMine ? Spindare.Radius.card : 4,
            bottomTrailingRadius: isMine ? 4 : Spindare.Radius.card,
            topTrailingRadius: Spindare.Radius.card,
            style: .continuous
        )
    }

    // MARK: - Composer

    @ViewBuilder
    private var composer: some View {
        VStack(spacing: 0) {
            if recorder.isRecording {
                recordingBar
            } else {
                inputBar
            }
        }
        .padding(.horizontal, Spindare.Spacing.gutter)
        .padding(.vertical, Spindare.Spacing.sm)
        .background(Color.spindareBackground(scheme))
        .animation(Spindare.Motion.settle, value: recorder.isRecording)
    }

    private var inputBar: some View {
        HStack(spacing: Spindare.Spacing.sm) {
            #if os(iOS)
            Button { showCamera = true } label: {
                composerIcon("camera.fill")
            }
            .buttonStyle(.plain)
            #endif

            // `scheme` resolved to a plain value *before* the picker, not read
            // inside its label closure — that closure is inferred `@Sendable`,
            // and a main-actor-isolated `@Environment` property can't cross
            // into one directly (same shape as the `PhotosPicker` fix in
            // ComposerView's proof tiles).
            let iconTint = Color.spindareSecondary(scheme)
            PhotosPicker(selection: $pickerItem, matching: .images) {
                ComposerIcon(symbol: "photo", tint: iconTint)
            }
            .buttonStyle(.plain)

            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                // Previews at the size the hold has currently reached, so the
                // gesture shows its result before committing to it rather than
                // being a blind ramp.
                .font(.system(size: emphasisPreview ?? 16, weight: emphasisPreview == nil ? .regular : .semibold))
                .animation(.linear(duration: 0.08), value: emphasisPreview)
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.vertical, 10)
                .frame(minHeight: 44)
                .background {
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                        .overlay {
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .strokeBorder(
                                    Spindare.Hairline.color(scheme),
                                    lineWidth: Spindare.Hairline.width
                                )
                        }
                }

            if draft.isEmpty {
                // The mic replaces send on an empty draft rather than sitting
                // beside it — with nothing typed there is nothing to send, and
                // two disabled-looking buttons is worse than one live one.
                Button {
                    Task { await recorder.start() }
                } label: {
                    composerIcon("mic.fill")
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            } else {
                HoldToGrowSendButton(
                    isEnabled: true,
                    previewSize: $emphasisPreview
                ) { size in
                    let text = draft
                    draft = ""
                    Task { await vm.send(text, currentUserId: router.userId ?? "", emphasis: size) }
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(Spindare.Motion.settle, value: draft.isEmpty)
    }

    private func composerIcon(_ symbol: String) -> some View {
        ComposerIcon(symbol: symbol, tint: Color.spindareSecondary(scheme))
    }

    /// While recording: a live waveform, a running duration, and two exits.
    private var recordingPhase: VoiceRecordingPhase {
        VoiceRecordingLimit.phase(elapsed: recorder.duration)
    }

    /// Cancel has to be as reachable as send — a voice note recorded by
    /// accident should never be sendable only.
    private var recordingBar: some View {
        VStack(spacing: 6) {
            if recordingPhase == .endingSoon {
                endingSoonBanner
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            HStack(spacing: Spindare.Spacing.md) {
                Button {
                    recorder.cancel()
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Spindare.Palette.danger)
                        .frame(width: 40, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Waveform(samples: recorder.samples, tint: Spindare.Palette.danger)
                    .frame(height: 26)
                    .frame(maxWidth: .infinity)

                durationOrCountdownLabel

                Button {
                    sendVoiceNote()
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(Spindare.Palette.ink))
                }
                .buttonStyle(PressableStyle())
            }
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .animation(Spindare.Motion.settle, value: recordingPhase)
        // The actual 31-second cap: once `phase` reaches `.done`, the note
        // sends itself rather than needing the user to notice the countdown
        // hit zero and tap Send in time.
        .onChange(of: recordingPhase) { _, phase in
            guard phase == .done else { return }
            sendVoiceNote()
        }
    }

    @ViewBuilder
    private var durationOrCountdownLabel: some View {
        switch recordingPhase {
        case .countdown(let secondsRemaining):
            Text("Sending in \(secondsRemaining)s")
                .font(.system(size: 13, weight: .semibold).monospacedDigit())
                .foregroundStyle(Spindare.Palette.danger)
                .contentTransition(.numericText(countsDown: true))
        default:
            Text(Self.durationLabel(recorder.duration))
                .font(.system(size: 13, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.spindareSecondary(scheme))
        }
    }

    /// The one-time heads-up, styled like a call's "ending soon" banner —
    /// present just long enough to read, then it gives way to the numeric
    /// countdown in the bar itself.
    private var endingSoonBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock.badge.exclamationmark")
                .font(.system(size: 12, weight: .semibold))
            Text("Voice memo ending soon")
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity)
        .background(Capsule().fill(Spindare.Palette.danger.opacity(0.9)))
    }

    private func sendVoiceNote() {
        guard let note = recorder.stop() else {
            toast = Toast("Too short", icon: "mic.slash")
            return
        }
        Task {
            await vm.send(
                "",
                currentUserId: router.userId ?? "",
                payload: .voice(url: note.url, duration: note.duration, samples: note.samples)
            )
        }
    }

    static func durationLabel(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// Composer accessory button. Its own view because `PhotosPicker`'s label
/// builder isn't main-actor isolated and can't call a method on the view.
private struct ComposerIcon: View {
    let symbol: String
    let tint: Color

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 17, weight: .medium))
            .foregroundStyle(tint)
            .frame(width: 34, height: 44)
            .contentShape(Rectangle())
    }
}

// MARK: - Voice notes

/// Bars from stored loudness samples.
///
/// Deliberately not a live audio analysis — the samples were captured while
/// recording and travel with the message, so the same note draws the same shape
/// every time it's rendered. A waveform that changed between scrolls would read
/// as a glitch.
struct Waveform: View {
    let samples: [CGFloat]
    let tint: Color
    /// 0...1 through the note, for playback progress. Bars past this dim.
    var progress: CGFloat = 1

    var body: some View {
        GeometryReader { proxy in
            let count = max(samples.count, 1)
            let barWidth = max(1.5, (proxy.size.width - CGFloat(count - 1) * 2) / CGFloat(count))

            HStack(alignment: .center, spacing: 2) {
                ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
                    Capsule()
                        .fill(tint)
                        .opacity(CGFloat(index) / CGFloat(count) <= progress ? 1 : 0.3)
                        // Floored so silence still draws a visible line rather
                        // than a gap — an empty stretch reads as missing data.
                        .frame(width: barWidth, height: max(3, sample * proxy.size.height))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

/// A sent voice note, with playback.
struct VoiceNoteBubble: View {
    @Environment(\.colorScheme) private var scheme

    let url: URL
    let duration: TimeInterval
    let samples: [CGFloat]
    let isMine: Bool

    @State private var player = AudioNotePlayer()

    private var tint: Color {
        isMine ? .white : Color.spindarePrimary(scheme)
    }

    var body: some View {
        HStack(spacing: Spindare.Spacing.sm) {
            Button {
                player.toggle(url: url)
            } label: {
                Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Waveform(samples: samples, tint: tint, progress: player.progress)
                .frame(width: 120, height: 24)

            Text(ChatView.durationLabel(player.isPlaying ? player.elapsed : duration))
                .font(.system(size: 11, weight: .medium).monospacedDigit())
                .foregroundStyle(tint.opacity(0.8))
        }
        .onDisappear { player.stop() }
    }
}

// MARK: - Shared chrome

struct LayerTitleBar: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let onClose: () -> Void

    var body: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            Spacer()
            Text(title)
                .spindareLabel(size: 11, weight: .semibold, tracking: 3)
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .foregroundStyle(Color.spindarePrimary(scheme))
        .background(Color.spindareBackground(scheme))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Spindare.Hairline.color(scheme))
                .frame(height: Spindare.Hairline.width)
        }
    }
}
