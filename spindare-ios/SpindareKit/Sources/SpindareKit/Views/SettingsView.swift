import SwiftUI
import PhotosUI

// Settings, built around what actually works.
//
// The RN original has ~22 rows, of which four do anything: change your avatar,
// change your username, toggle dark mode, and log out. The rest open a mailto:
// or fire a toast that says the feature is coming. Reproducing all 22 would
// have meant shipping eighteen dead controls, so this is organised around the
// four real ones and states plainly where the others go.
//
// Two things the original lacks and this adds: log out asks first, and there is
// a way to delete your account.

/// Persisted appearance override. `.system` is the default and the right one —
/// this exists for the people who deliberately want the app pinned one way.
public enum AppearancePreference: String, CaseIterable, Identifiable, Sendable {
    case system, light, dark

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    public var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

public struct SettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    @Environment(AppRouter.self) private var router

    @AppStorage("appearance") private var appearance: AppearancePreference = .system
    @AppStorage("pushNotifications") private var pushEnabled = true
    @AppStorage("useTestData") private var useTestData = false

    // Account & Security
    @AppStorage(AppSettingsKey.privacyPrivate) private var privacyPrivate = false
    @AppStorage(AppSettingsKey.dataTrackingOptOut) private var dataTrackingOptOut = false
    // Dial & Challenges
    @AppStorage(AppSettingsKey.showDialLines) private var showDialLines = true
    @AppStorage(AppSettingsKey.challengeSourceFriendsOnly) private var challengeFriendsOnly = false
    // Speedys & Well-being
    @AppStorage(AppSettingsKey.speedyReactionWindow) private var reactionWindow = 2.0
    @AppStorage(AppSettingsKey.lookAwayNudges) private var lookAwayNudges = false
    @AppStorage(AppSettingsKey.hideReactionCounts) private var hideReactionCounts = false
    @AppStorage(AppSettingsKey.dailyRecordReminder) private var dailyRecordReminder = false
    // Zone
    @AppStorage(AppSettingsKey.zoneHideIntenseVenues) private var zoneHideIntense = false
    // Communication
    @AppStorage(AppSettingsKey.dmSourceFriendsOnly) private var dmFriendsOnly = false

    @State private var username = ""
    @State private var isEditingUsername = false
    @State private var confirmingLogOut = false
    @State private var confirmingDelete = false
    @State private var deleteConfirmationText = ""
    @State private var saveError: String?
    @State private var pfpPickerItem: PhotosPickerItem?
    @State private var isUploadingPhoto = false
    // Sub-screen presentation
    @State private var showTwoFactor = false
    @State private var showSessions = false
    @State private var showBlocked = false
    @State private var showMuted = false

    private let profileService: any ProfileServing
    private let socialService: any SocialServing
    private let chatService: any ChatServing

    public init(
        profileService: any ProfileServing = AppEnvironment.profileService,
        socialService: any SocialServing = AppEnvironment.socialService,
        chatService: any ChatServing = MockChatService()
    ) {
        self.profileService = profileService
        self.socialService = socialService
        self.chatService = chatService
    }

    public var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(spacing: Spindare.Spacing.lg) {
                    identityCard
                    accountSecurityCard
                    dialChallengesCard
                    wellbeingCard
                    zoneCard
                    communicationCard
                    appearanceCard
                    notificationsCard
                    supportCard
                    testingCard
                    dangerCard
                }
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.vertical, Spindare.Spacing.lg)
            }
            .scrollIndicators(.hidden)
        }
        .background(Color.spindareBackground(scheme).ignoresSafeArea())
        // RootView applies `.preferredColorScheme` once, at the very top of
        // the hierarchy — but this view is presented in a system `.sheet`,
        // which snapshots the ambient scheme into its own UIHostingController
        // trait collection at presentation time. Toggling the picker below
        // updates `appearance` correctly, but without an override applied
        // directly here too, this sheet's own content wouldn't re-derive its
        // scheme until closed and reopened. Applying it at this level as well
        // makes it live.
        .preferredColorScheme(appearance.colorScheme)
        .task { username = router.username ?? "" }
        .onChange(of: pfpPickerItem) { _, item in
            guard let item else { return }
            Task { await uploadPhoto(item) }
        }
        .onChange(of: privacyPrivate) { _, isPrivate in
            Task { try? await profileService.updatePrivacy(isPrivate ? "private" : "open") }
        }
        .onChange(of: challengeFriendsOnly) { _, friendsOnly in
            Task { try? await profileService.updateChallengePrivacy(friendsOnly ? "friends" : "everyone") }
        }
        .sheet(isPresented: $showTwoFactor) { TwoFactorView() }
        .sheet(isPresented: $showSessions) { ActiveSessionsView() }
        .sheet(isPresented: $showBlocked) { BlockedUsersView(socialService: socialService) }
        .sheet(isPresented: $showMuted) { MutedThreadsView(chatService: chatService) }
        .confirmationDialog(
            "Log out of Spindare?",
            isPresented: $confirmingLogOut,
            titleVisibility: .visible
        ) {
            Button("Log out", role: .destructive) {
                dismiss()
                // Clear the Clerk session too — a plain didSignOut() left it
                // alive, so "log out" didn't actually log you out.
                Task { await AppEnvironment.signOut() }
                router.didSignOut()
            }
            Button("Stay signed in", role: .cancel) {}
        } message: {
            Text("Your challenges and posts stay where they are.")
        }
        .sheet(isPresented: $confirmingDelete) { deleteAccountSheet }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("SETTINGS")
                .spindareLabel(size: 12, weight: .semibold, tracking: 5)
                .foregroundStyle(Color.spindarePrimary(scheme))

            Spacer(minLength: 0)

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.spindarePrimary(scheme))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spindare.Spacing.md)
        .frame(height: AppHeader.height)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Spindare.Hairline.color(scheme))
                .frame(height: Spindare.Hairline.width)
        }
    }

    // MARK: - Identity

    private var identityCard: some View {
        // Resolved to plain values before the picker's `@Sendable` label closure
        // — `@Environment`/`@State` can't cross into it directly (same shape as
        // the ProfileView / ComposerView PhotosPicker fixes).
        let avatarURL = router.avatarURL
        let uploading = isUploadingPhoto

        return card {
            VStack(spacing: Spindare.Spacing.md) {
                PhotosPicker(selection: $pfpPickerItem, matching: .images) {
                    ZStack(alignment: .bottomTrailing) {
                        Avatar(url: avatarURL, size: 72)
                            .overlay {
                                if uploading {
                                    Circle().fill(.black.opacity(0.35))
                                    ProgressView().tint(.white)
                                }
                            }
                        Circle()
                            .fill(Spindare.Palette.accent)
                            .frame(width: 24, height: 24)
                            .overlay {
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                    }
                }
                .buttonStyle(.plain)
                .disabled(uploading)

                if isEditingUsername {
                    HStack(spacing: Spindare.Spacing.sm) {
                        TextField("username", text: $username)
                            .font(Spindare.Typography.body)
                            .autocorrectionDisabled()
                            #if os(iOS)
                            .textInputAutocapitalization(.never)
                            #endif
                            .padding(.horizontal, Spindare.Spacing.md)
                            .frame(height: 38)
                            .background {
                                RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                                    .fill(Color.spindareBackground(scheme))
                            }

                        Button("Save") { saveUsername() }
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Spindare.Palette.accent)
                            .disabled(username.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } else {
                    Button {
                        withAnimation(Spindare.Motion.enter) { isEditingUsername = true }
                    } label: {
                        HStack(spacing: 6) {
                            Text("@\(router.username ?? "you")")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(Color.spindarePrimary(scheme))
                            Image(systemName: "pencil")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.spindareSecondary(scheme))
                        }
                    }
                    .buttonStyle(.plain)
                }

                if let email = router.email {
                    Text(email)
                        .font(Spindare.Typography.timestamp)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }

                if let saveError {
                    Text(saveError)
                        .font(Spindare.Typography.timestamp)
                        .foregroundStyle(Spindare.Palette.danger)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spindare.Spacing.sm)
        }
    }

    /// Same pipeline as ProfileView's avatar edit — load, compress, upload to R2
    /// (or a local file in mock/offline mode), persist, then propagate to the
    /// session identity so the change shows everywhere, not just here.
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
            router.updateAvatar(photoURL)
        } catch {
            saveError = "Couldn't update your photo."
        }
    }

    private func saveUsername() {
        let trimmed = username.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        Task {
            do {
                try await profileService.updateUsername(trimmed)
                // Reflect it in the session identity so the header and new posts
                // show the new name immediately, not just this screen.
                router.updateUsername(trimmed)
                saveError = nil
                withAnimation(Spindare.Motion.enter) { isEditingUsername = false }
            } catch {
                saveError = "That username is taken."
            }
        }
    }

    // MARK: - Appearance

    private var appearanceCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("APPEARANCE")

                Picker("Appearance", selection: $appearance) {
                    ForEach(AppearancePreference.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }

    // MARK: - Notifications

    private var notificationsCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("NOTIFICATIONS")

                Toggle(isOn: $pushEnabled) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Push notifications")
                            .font(Spindare.Typography.body)
                            .foregroundStyle(Color.spindarePrimary(scheme))
                        Text("Challenges sent to you, reactions, and replies.")
                            .font(Spindare.Typography.timestamp)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                }
                .tint(Spindare.Palette.accent)
            }
        }
    }

    // MARK: - Testing

    /// Pre-launch QA switch: run the whole app on on-device demo data instead of
    /// the live backend, so the team can test without touching production. Reads
    /// at launch, so it applies on the next one.
    private var testingCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("TESTING")

                Toggle(isOn: $useTestData) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Use test data")
                            .font(Spindare.Typography.body)
                            .foregroundStyle(Color.spindarePrimary(scheme))
                        Text("Runs on demo data instead of the live backend. Applies after you relaunch the app.")
                            .font(Spindare.Typography.timestamp)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                }
                .tint(Spindare.Palette.accent)
            }
        }
    }

    // MARK: - Account & Security

    private var accountSecurityCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("ACCOUNT & SECURITY")

                toggleRow("Private profile",
                          detail: "Approve who can connect and see your reactions.",
                          isOn: $privacyPrivate)
                divider
                navRow("Two-factor authentication",
                       detail: "Add an authenticator app.") { showTwoFactor = true }
                divider
                navRow("Active sessions",
                       detail: "See and sign out other devices.") { showSessions = true }
                divider
                toggleRow("Opt out of usage tracking",
                          detail: "Stop internal analytics from recording your activity.",
                          isOn: $dataTrackingOptOut)
            }
        }
    }

    // MARK: - Dial & Challenges

    private var dialChallengesCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("DIAL & CHALLENGES")

                toggleRow("Show dial lines",
                          detail: "Reveal the category lines before you spin.",
                          isOn: $showDialLines)
                divider
                toggleRow("Challenges from friends only",
                          detail: "Only people you're connected to can send you a challenge.",
                          isOn: $challengeFriendsOnly)
            }
        }
    }

    // MARK: - SPeedys & Well-being

    private var wellbeingCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.md) {
                sectionTitle("SPEEDYS & WELL-BEING")

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Reaction window")
                            .font(Spindare.Typography.body)
                            .foregroundStyle(Color.spindarePrimary(scheme))
                        Spacer()
                        Text("\(Int(reactionWindow))s")
                            .font(Spindare.Typography.body.monospacedDigit())
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                    Slider(value: $reactionWindow, in: 1...5, step: 1)
                        .tint(Spindare.Palette.accent)
                    Text("How long you can change a reaction before it locks.")
                        .font(Spindare.Typography.timestamp)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }
                divider
                toggleRow("Look-away nudges",
                          detail: "A gentle reminder to look up while watching.",
                          isOn: $lookAwayNudges)
                divider
                toggleRow("Hide reaction counts",
                          detail: "Don't show tallies on your own posts.",
                          isOn: $hideReactionCounts)
                divider
                toggleRow("Daily record reminder",
                          detail: "A nudge to post your own Speedy.",
                          isOn: $dailyRecordReminder)
            }
        }
    }

    // MARK: - Zone Map & Sponsors

    private var zoneCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("ZONE MAP & SPONSORS")

                navRow("Location access",
                       detail: LocationProvider.authorizationSummary) { openSystemSettings() }
                divider
                toggleRow("Hide intense venues",
                          detail: "Keep gyms and parks off the map (safer for minors).",
                          isOn: $zoneHideIntense)
            }
        }
    }

    // MARK: - Communication

    private var communicationCard: some View {
        card {
            VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
                sectionTitle("COMMUNICATION")

                toggleRow("Messages & calls from friends only",
                          detail: "Only connections can DM or call you.",
                          isOn: $dmFriendsOnly)
                divider
                navRow("Blocked users", detail: nil) { showBlocked = true }
                divider
                navRow("Muted threads", detail: nil) { showMuted = true }
            }
        }
    }

    // MARK: - Row helpers

    private func toggleRow(_ title: String, detail: String?, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Spindare.Typography.body)
                    .foregroundStyle(Color.spindarePrimary(scheme))
                if let detail {
                    Text(detail)
                        .font(Spindare.Typography.timestamp)
                        .foregroundStyle(Color.spindareSecondary(scheme))
                }
            }
        }
        .tint(Spindare.Palette.accent)
    }

    private func navRow(_ title: String, detail: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(Spindare.Typography.body)
                        .foregroundStyle(Color.spindarePrimary(scheme))
                    if let detail {
                        Text(detail)
                            .font(Spindare.Typography.timestamp)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func openSystemSettings() {
        #if canImport(UIKit)
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
        #endif
    }

    // MARK: - Support

    private var supportCard: some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                sectionTitle("SUPPORT")
                    .padding(.bottom, Spindare.Spacing.sm)

                linkRow("Contact us", url: "mailto:hello@spindare.app")
                divider
                linkRow("Privacy policy", url: "https://spindare.app/privacy")
                divider
                linkRow("Terms of service", url: "https://spindare.app/terms")
            }
        }
    }

    private func linkRow(_ title: String, url: String) -> some View {
        Button {
            #if canImport(UIKit)
            if let link = URL(string: url) { UIApplication.shared.open(link) }
            #endif
        } label: {
            HStack {
                Text(title)
                    .font(Spindare.Typography.body)
                    .foregroundStyle(Color.spindarePrimary(scheme))
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.spindareSecondary(scheme))
            }
            .padding(.vertical, Spindare.Spacing.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var divider: some View {
        Rectangle()
            .fill(Spindare.Hairline.color(scheme))
            .frame(height: Spindare.Hairline.width)
    }

    // MARK: - Danger

    private var dangerCard: some View {
        VStack(spacing: Spindare.Spacing.sm) {
            Button {
                confirmingLogOut = true
            } label: {
                Text("Log out")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.spindarePrimary(scheme))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spindare.Spacing.md)
                    .background {
                        RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                            .fill(Color.spindareSurface(scheme))
                    }
            }
            .buttonStyle(PressableStyle())

            Button {
                deleteConfirmationText = ""
                confirmingDelete = true
            } label: {
                Text("Delete account")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Spindare.Palette.danger)
                    .padding(.vertical, Spindare.Spacing.sm)
            }
            .buttonStyle(.plain)
        }
    }

    /// Deliberately more friction than a confirmation dialog: this is
    /// irreversible, and a two-tap flow is not enough to be sure it was meant.
    private var deleteAccountSheet: some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.lg) {
            Text("Delete account")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.spindarePrimary(scheme))

            Text("This removes your profile, posts, reactions and saved challenges. It cannot be undone.")
                .font(Spindare.Typography.body)
                .foregroundStyle(Color.spindareSecondary(scheme))

            Text("Type DELETE to confirm")
                .font(Spindare.Typography.timestamp)
                .foregroundStyle(Color.spindareSecondary(scheme))

            TextField("", text: $deleteConfirmationText)
                .font(Spindare.Typography.body)
                .autocorrectionDisabled()
                #if os(iOS)
                .textInputAutocapitalization(.characters)
                #endif
                .padding(.horizontal, Spindare.Spacing.md)
                .frame(height: 44)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.control, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }

            Button {
                // Delete server-side *first* while the Clerk token is still
                // valid (sign-out clears it), then end the session.
                Task {
                    try? await profileService.deleteAccount()
                    await AppEnvironment.signOut()
                    confirmingDelete = false
                    dismiss()
                    router.didSignOut()
                }
            } label: {
                Text("Delete my account")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spindare.Spacing.md)
                    .background {
                        RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                            .fill(Spindare.Palette.danger)
                    }
            }
            .buttonStyle(PressableStyle())
            .disabled(deleteConfirmationText != "DELETE")
            .opacity(deleteConfirmationText == "DELETE" ? 1 : 0.4)

            Button("Cancel") { confirmingDelete = false }
                .font(.system(size: 15))
                .foregroundStyle(Color.spindareSecondary(scheme))
                .frame(maxWidth: .infinity)

            Spacer(minLength: 0)
        }
        .padding(Spindare.Spacing.lg)
        .background(Color.spindareBackground(scheme).ignoresSafeArea())
        .presentationDetents([.medium])
    }

    // MARK: - Building blocks

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .spindareLabel(size: 10, weight: .bold, tracking: 2)
            .foregroundStyle(Color.spindareSecondary(scheme))
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(Spindare.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                    .fill(Color.spindareSurface(scheme))
            }
            .spindareElevation(.card)
    }
}
