import SwiftUI
import ClerkKit

// MARK: - Two-Factor Authentication

/// Real 2FA setup via Clerk's TOTP API. Flow:
/// 1. `createTOTP()` → shows the secret + otpauth:// URI (as text, since
///    generating a QR image requires CoreImage which is fine on-device).
/// 2. User enters a code from their authenticator → `verifyTOTP(code:)`.
/// 3. On verify, `createBackupCodes()` → shown once.
/// 4. If already enabled, shows a Disable button → `disableTOTP()`.
///
/// Handles the "2FA not enabled on this Clerk instance" error gracefully.
struct TwoFactorView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    @State private var phase: Phase = .loading
    @State private var totpSecret: String?
    @State private var totpURI: String?
    @State private var verifyCode = ""
    @State private var backupCodes: [String] = []
    @State private var errorMessage: String?
    @State private var isWorking = false

    private enum Phase {
        case loading
        case alreadyEnabled
        case setup       // secret + URI shown, waiting for code
        case verified    // backup codes shown
        case unavailable // Clerk instance has 2FA disabled
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spindare.Spacing.lg) {
                    switch phase {
                    case .loading:
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 40)

                    case .unavailable:
                        unavailableSection

                    case .alreadyEnabled:
                        enabledSection

                    case .setup:
                        setupSection

                    case .verified:
                        backupCodesSection
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(Spindare.Typography.timestamp)
                            .foregroundStyle(Spindare.Palette.danger)
                    }
                }
                .padding(Spindare.Spacing.lg)
            }
            .background(Color.spindareBackground(scheme).ignoresSafeArea())
            .navigationTitle("Two-Factor Auth")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Spindare.Palette.accent)
                }
            }
        }
        .task { await checkStatus() }
    }

    // MARK: - Sections

    private var unavailableSection: some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
            Label("Not available", systemImage: "info.circle")
                .font(Spindare.Typography.body)
                .foregroundStyle(Color.spindarePrimary(scheme))
            Text("Two-factor authentication isn't enabled on this Clerk instance. Ask your admin to enable it in the Clerk dashboard.")
                .font(Spindare.Typography.timestamp)
                .foregroundStyle(Color.spindareSecondary(scheme))
        }
    }

    private var enabledSection: some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
            Label("Two-factor is on", systemImage: "checkmark.shield.fill")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Spindare.Palette.accent)

            Text("Your account is protected by an authenticator app. You'll be asked for a code each time you sign in on a new device.")
                .font(Spindare.Typography.body)
                .foregroundStyle(Color.spindareSecondary(scheme))

            Button(role: .destructive) {
                Task { await disable2FA() }
            } label: {
                HStack {
                    if isWorking { ProgressView().controlSize(.small) }
                    Text("Disable two-factor")
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Spindare.Palette.danger)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spindare.Spacing.md)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }
            }
            .buttonStyle(PressableStyle())
            .disabled(isWorking)
        }
    }

    private var setupSection: some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
            Text("Set up your authenticator")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.spindarePrimary(scheme))

            Text("Add this account to your authenticator app (Google Authenticator, Authy, 1Password, etc.) using the URI below, or enter the secret manually.")
                .font(Spindare.Typography.body)
                .foregroundStyle(Color.spindareSecondary(scheme))

            if let totpURI {
                VStack(alignment: .leading, spacing: 4) {
                    Text("URI")
                        .spindareLabel(size: 10, weight: .bold, tracking: 2)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                    Text(totpURI)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Color.spindarePrimary(scheme))
                        .textSelection(.enabled)
                        .padding(Spindare.Spacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background {
                            RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                .fill(Color.spindareSurface(scheme))
                        }
                }
            }

            if let totpSecret {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SECRET")
                        .spindareLabel(size: 10, weight: .bold, tracking: 2)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                    Text(totpSecret)
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.spindarePrimary(scheme))
                        .textSelection(.enabled)
                }
            }

            Divider()

            Text("Enter the 6-digit code from your authenticator to verify:")
                .font(Spindare.Typography.body)
                .foregroundStyle(Color.spindareSecondary(scheme))

            HStack(spacing: Spindare.Spacing.sm) {
                TextField("000000", text: $verifyCode)
                    .font(.system(size: 20, weight: .medium, design: .monospaced))
                    .multilineTextAlignment(.center)
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
                    .frame(maxWidth: 160)
                    .padding(.horizontal, Spindare.Spacing.md)
                    .frame(height: 48)
                    .background {
                        RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                            .fill(Color.spindareSurface(scheme))
                    }

                Button {
                    Task { await verify() }
                } label: {
                    HStack {
                        if isWorking { ProgressView().controlSize(.small) }
                        Text("Verify")
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spindare.Spacing.lg)
                    .frame(height: 48)
                    .background {
                        RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                            .fill(Spindare.Palette.accent)
                    }
                }
                .buttonStyle(PressableStyle())
                .disabled(verifyCode.count < 6 || isWorking)
                .opacity(verifyCode.count < 6 ? 0.5 : 1)
            }
        }
    }

    private var backupCodesSection: some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
            Label("Two-factor enabled!", systemImage: "checkmark.shield.fill")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Spindare.Palette.accent)

            if !backupCodes.isEmpty {
                Text("Save these backup codes somewhere safe. Each can be used once if you lose access to your authenticator.")
                    .font(Spindare.Typography.body)
                    .foregroundStyle(Color.spindareSecondary(scheme))

                VStack(alignment: .leading, spacing: 4) {
                    ForEach(backupCodes, id: \.self) { code in
                        Text(code)
                            .font(.system(size: 14, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color.spindarePrimary(scheme))
                    }
                }
                .padding(Spindare.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }
                .textSelection(.enabled)
            }

            Button("Done") { dismiss() }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spindare.Spacing.md)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                        .fill(Spindare.Palette.accent)
                }
                .buttonStyle(PressableStyle())
        }
    }

    // MARK: - Actions

    private func checkStatus() async {
        guard let user = Clerk.shared.user else {
            phase = .unavailable
            return
        }
        if user.totpEnabled {
            phase = .alreadyEnabled
        } else {
            await beginSetup(user: user)
        }
    }

    private func beginSetup(user: User) async {
        do {
            let totp = try await user.createTOTP()
            totpSecret = totp.secret
            totpURI = totp.uri
            withAnimation { phase = .setup }
        } catch {
            // Clerk returns an error if the instance doesn't have 2FA enabled.
            withAnimation { phase = .unavailable }
        }
    }

    private func verify() async {
        guard let user = Clerk.shared.user else { return }
        isWorking = true
        defer { isWorking = false }
        errorMessage = nil

        do {
            _ = try await user.verifyTOTP(code: verifyCode)
            // Generate backup codes now that TOTP is verified.
            let backup = try await user.createBackupCodes()
            backupCodes = backup.codes
            withAnimation { phase = .verified }
        } catch {
            errorMessage = "Invalid code — try again."
        }
    }

    private func disable2FA() async {
        guard let user = Clerk.shared.user else { return }
        isWorking = true
        defer { isWorking = false }
        errorMessage = nil

        do {
            _ = try await user.disableTOTP()
            withAnimation { phase = .setup }
            // Re-start setup flow so they can re-enable if desired.
            await beginSetup(user: user)
        } catch {
            errorMessage = "Couldn't disable 2FA: \(error.localizedDescription)"
        }
    }
}

// MARK: - Active Sessions

/// Lists Clerk sessions for the current user with a per-row revoke action.
/// The *current* session is labelled and can't be revoked (Clerk enforces this
/// server-side anyway, but greying it out avoids a confusing error).
struct ActiveSessionsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    @State private var sessions: [Session] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if sessions.isEmpty {
                    Text("No active sessions")
                        .font(Spindare.Typography.body)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: Spindare.Spacing.sm) {
                            ForEach(sessions, id: \.id) { session in
                                sessionRow(session)
                            }
                        }
                        .padding(Spindare.Spacing.lg)
                    }
                }
            }
            .background(Color.spindareBackground(scheme).ignoresSafeArea())
            .navigationTitle("Active Sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Spindare.Palette.accent)
                }
            }
        }
        .task { await loadSessions() }
    }

    private func sessionRow(_ session: Session) -> some View {
        let isCurrent = session.id == Clerk.shared.session?.id
        let activity = session.latestActivity

        return HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: activity?.isMobile == true ? "iphone" : "desktopcomputer")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.spindareSecondary(scheme))

                    Text(sessionLabel(activity))
                        .font(Spindare.Typography.body)
                        .foregroundStyle(Color.spindarePrimary(scheme))

                    if isCurrent {
                        Text("This device")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Spindare.Palette.accent)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background {
                                Capsule().fill(Spindare.Palette.accent.opacity(0.15))
                            }
                    }
                }

                Text("Active \(session.lastActiveAt.formatted(.relative(presentation: .named)))")
                    .font(Spindare.Typography.timestamp)
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }

            Spacer(minLength: 0)

            if !isCurrent {
                Button("Sign out") {
                    Task { await revokeSession(session) }
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Spindare.Palette.danger)
            }
        }
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Color.spindareSurface(scheme))
        }
    }

    private func sessionLabel(_ activity: SessionActivity?) -> String {
        let browser = activity?.browserName ?? "Unknown browser"
        let location = [activity?.city, activity?.country]
            .compactMap { $0 }
            .joined(separator: ", ")
        return location.isEmpty ? browser : "\(browser) · \(location)"
    }

    private func loadSessions() async {
        guard let user = Clerk.shared.user else {
            isLoading = false
            return
        }
        do {
            sessions = try await user.getSessions()
            // Show active ones only, most recent first.
            sessions.sort { $0.lastActiveAt > $1.lastActiveAt }
        } catch {
            errorMessage = "Couldn't load sessions."
        }
        isLoading = false
    }

    private func revokeSession(_ session: Session) async {
        do {
            _ = try await session.revoke()
            sessions.removeAll { $0.id == session.id }
        } catch {
            errorMessage = "Couldn't sign out that session."
        }
    }
}

// MARK: - Blocked Users

/// Lists users the signed-in user has blocked (ghosted). Unblock per-row.
/// LiveSocialService hits /social/ghosted and /social/ghost/:id;
/// MockSocialService uses MockBackend's local set.
struct BlockedUsersView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    private let socialService: any SocialServing

    @State private var blocked: [Friend] = []
    @State private var isLoading = true

    init(socialService: any SocialServing) {
        self.socialService = socialService
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if blocked.isEmpty {
                    VStack(spacing: Spindare.Spacing.sm) {
                        Image(systemName: "person.crop.circle.badge.checkmark")
                            .font(.system(size: 36))
                            .foregroundStyle(Color.spindareSecondary(scheme))
                        Text("Nobody blocked")
                            .font(Spindare.Typography.body)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: Spindare.Spacing.sm) {
                            ForEach(blocked) { user in
                                blockedRow(user)
                            }
                        }
                        .padding(Spindare.Spacing.lg)
                    }
                }
            }
            .background(Color.spindareBackground(scheme).ignoresSafeArea())
            .navigationTitle("Blocked Users")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Spindare.Palette.accent)
                }
            }
        }
        .task { await load() }
    }

    private func blockedRow(_ user: Friend) -> some View {
        HStack(spacing: Spindare.Spacing.md) {
            Avatar(url: user.photoURL, size: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(user.username)
                    .font(Spindare.Typography.body)
                    .foregroundStyle(Color.spindarePrimary(scheme))
                Text("@\(user.username)")
                    .font(Spindare.Typography.timestamp)
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }

            Spacer(minLength: 0)

            Button("Unblock") {
                Task { await unblock(user) }
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Spindare.Palette.accent)
        }
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Color.spindareSurface(scheme))
        }
    }

    private func load() async {
        do {
            blocked = try await socialService.blockedUsers()
        } catch {}
        isLoading = false
    }

    private func unblock(_ user: Friend) async {
        do {
            try await socialService.unblock(userId: user.id)
            withAnimation { blocked.removeAll { $0.id == user.id } }
        } catch {}
    }
}

// MARK: - Muted Threads

/// Lists conversations where `isMuted` is true. Unmute per-row.
/// Since chat is mock-only, this always reads from MockChatService.
struct MutedThreadsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    private let chatService: any ChatServing

    @State private var muted: [Conversation] = []
    @State private var isLoading = true

    init(chatService: any ChatServing) {
        self.chatService = chatService
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if muted.isEmpty {
                    VStack(spacing: Spindare.Spacing.sm) {
                        Image(systemName: "bell.badge")
                            .font(.system(size: 36))
                            .foregroundStyle(Color.spindareSecondary(scheme))
                        Text("No muted threads")
                            .font(Spindare.Typography.body)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: Spindare.Spacing.sm) {
                            ForEach(muted) { thread in
                                mutedRow(thread)
                            }
                        }
                        .padding(Spindare.Spacing.lg)
                    }
                }
            }
            .background(Color.spindareBackground(scheme).ignoresSafeArea())
            .navigationTitle("Muted Threads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Spindare.Palette.accent)
                }
            }
        }
        .task { await load() }
    }

    private func mutedRow(_ thread: Conversation) -> some View {
        HStack(spacing: Spindare.Spacing.md) {
            Avatar(url: thread.otherAvatarURL, size: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(thread.otherUsername)
                    .font(Spindare.Typography.body)
                    .foregroundStyle(Color.spindarePrimary(scheme))
                if !thread.lastMessage.isEmpty {
                    Text(thread.lastMessage)
                        .font(Spindare.Typography.timestamp)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            Button("Unmute") {
                Task { await unmute(thread) }
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Spindare.Palette.accent)
        }
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Color.spindareSurface(scheme))
        }
    }

    private func load() async {
        do {
            // Get all conversations, filter to muted ones.
            let all = try await chatService.conversations()
            let archived = try await chatService.archivedConversations()
            muted = (all + archived).filter(\.isMuted)
        } catch {}
        isLoading = false
    }

    private func unmute(_ thread: Conversation) async {
        do {
            try await chatService.setMuted(false, conversationId: thread.id)
            withAnimation { muted.removeAll { $0.id == thread.id } }
        } catch {}
    }
}
