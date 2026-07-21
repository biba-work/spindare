import SwiftUI

// Root of the app. Gates between onboarding and the single feed surface.
//
// SpindareKit provides this view but not the @main entry point, which needs
// the app target (Info.plist, entitlements, asset catalog).

public struct RootView: View {
    @State private var router: AppRouter
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
            switch router.root {
            case .onboarding:
                OnboardingView { userId, username, email in
                    router.didSignIn(
                        userId: userId,
                        username: username,
                        email: email,
                        avatarURL: nil
                    )
                }
                .transition(Spindare.Motion.fadeScale)

            case .feed:
                AppShell(router: router)
                    .transition(Spindare.Motion.fadeScale)
            }
        }
        .animation(Spindare.Motion.enter, value: router.root)
        .preferredColorScheme(appearance.colorScheme)
    }
}
