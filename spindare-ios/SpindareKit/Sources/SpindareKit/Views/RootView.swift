import SwiftUI

// Root of the app. Gates between onboarding and the single feed surface.
//
// SpindareKit provides this view but not the @main entry point, which needs
// the app target (Info.plist, entitlements, asset catalog).

public struct RootView: View {
    @State private var router: AppRouter
    /// True until the launch session-restore check finishes. Gates onboarding
    /// behind a brief splash so a returning user (whose Clerk session restores
    /// to the feed) doesn't see the sign-in screen flash first.
    @State private var isRestoring = true
    /// Applied at the root so the override reaches sheets and full-screen
    /// covers too — setting it lower down leaves those on the system scheme.
    @AppStorage("appearance") private var appearance: AppearancePreference = .system

    public init() {
        _router = State(
            initialValue: AppRouter.launchedWithOnboardingSkipped
                ? .previewSignedIn()
                : AppRouter()
        )
    }

    public var body: some View {
        Group {
            if isRestoring {
                splash
            } else {
                switch router.root {
                case .onboarding:
                    OnboardingView { userId, username, email, avatarURL in
                        router.didSignIn(
                            userId: userId,
                            username: username,
                            email: email,
                            avatarURL: avatarURL
                        )
                    }
                    .transition(Spindare.Motion.fadeScale)

                case .feed:
                    AppShell(router: router)
                        .transition(Spindare.Motion.fadeScale)
                }
            }
        }
        .animation(Spindare.Motion.enter, value: router.root)
        .animation(Spindare.Motion.enter, value: isRestoring)
        .preferredColorScheme(appearance.colorScheme)
        .task { await restoreIfPossible() }
    }

    private var splash: some View {
        ZStack {
            Spindare.Palette.cream.ignoresSafeArea()
            LogoImage(.mark).frame(width: 64, height: 64)
        }
    }

    /// Restores a persisted Clerk session, if any, straight into the feed —
    /// otherwise falls through to onboarding.
    private func restoreIfPossible() async {
        defer { isRestoring = false }
        // A dev launch (`-skipOnboarding`) is already signed in; nothing to do.
        guard !AppRouter.launchedWithOnboardingSkipped, router.root == .onboarding else { return }

        if let identity = await AppEnvironment.restoreSession() {
            router.didSignIn(
                userId: identity.userId,
                username: identity.username,
                email: identity.email,
                avatarURL: identity.avatarURL
            )
        }
    }
}
