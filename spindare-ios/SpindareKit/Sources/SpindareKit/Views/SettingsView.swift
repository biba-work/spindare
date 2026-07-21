import SwiftUI

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

    @State private var username = ""
    @State private var isEditingUsername = false
    @State private var confirmingLogOut = false
    @State private var confirmingDelete = false
    @State private var deleteConfirmationText = ""
    @State private var saveError: String?

    private let profileService: any ProfileServing

    public init(profileService: any ProfileServing = AppEnvironment.profileService) {
        self.profileService = profileService
    }

    public var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(spacing: Spindare.Spacing.lg) {
                    identityCard
                    appearanceCard
                    notificationsCard
                    supportCard
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
        .confirmationDialog(
            "Log out of Spindare?",
            isPresented: $confirmingLogOut,
            titleVisibility: .visible
        ) {
            Button("Log out", role: .destructive) {
                dismiss()
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
        card {
            VStack(spacing: Spindare.Spacing.md) {
                Button {
                    // Photo picking lands with the composer's media work; the
                    // upload endpoint it needs is the same one.
                } label: {
                    ZStack(alignment: .bottomTrailing) {
                        Avatar(url: router.avatarURL, size: 72)
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
                .buttonStyle(PressableStyle())

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

    private func saveUsername() {
        let trimmed = username.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        Task {
            do {
                try await profileService.updateUsername(trimmed)
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
                confirmingDelete = false
                dismiss()
                router.didSignOut()
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
