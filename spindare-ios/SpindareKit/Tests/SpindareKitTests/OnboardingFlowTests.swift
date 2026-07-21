import Testing
import Foundation
@testable import SpindareKit

// Proves each auth path actually reaches `onAuthenticated`, so a blank or stuck
// sign-in screen can be told apart from a broken flow. All three paths are
// currently Clerk stubs; these tests are what will catch a regression when the
// real SDK replaces them.

@MainActor
@Suite(.serialized)
struct OnboardingFlowTests {
    private func authResult(
        timeout: Duration = .seconds(5),
        _ drive: (OnboardingViewModel) -> Void
    ) async -> (userId: String, username: String, email: String?)? {
        let vm = OnboardingViewModel()
        var captured: (String, String, String?)?
        vm.onAuthenticated = { userId, username, email in
            captured = (userId, username, email)
        }

        drive(vm)

        // The stubs sleep ~1s before firing.
        let deadline = ContinuousClock.now + timeout
        while captured == nil, ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(50))
        }
        return captured
    }

    @Test("Email + password sign-in reaches the authenticated callback")
    func emailLoginAuthenticates() async {
        let result = await authResult { vm in
            vm.email = "kodi@example.com"
            vm.password = "hunter2"
            vm.handleLogin()
        }

        #expect(result != nil, "Login never called onAuthenticated")
        #expect(result?.username == "kodi")
        #expect(result?.email == "kodi@example.com")
    }

    @Test("Google sign-in reaches the authenticated callback")
    func googleAuthenticates() async {
        let result = await authResult { $0.handleGoogleAuth() }
        #expect(result != nil, "Google auth never called onAuthenticated")
    }

    @Test("Apple sign-in reaches the authenticated callback")
    func appleAuthenticates() async {
        let result = await authResult { $0.handleAppleAuth() }
        #expect(result != nil, "Apple auth never called onAuthenticated")
    }

    @Test("Login with empty fields surfaces an error instead of hanging")
    func emptyLoginIsRejected() async {
        let vm = OnboardingViewModel()
        var fired = false
        vm.onAuthenticated = { _, _, _ in fired = true }

        vm.handleLogin()

        #expect(vm.error != nil, "Should explain why nothing happened")
        #expect(vm.isSubmitting == false, "Must not get stuck in a submitting state")
        #expect(fired == false)
    }

    @Test("Navigation is not left permanently mid-transition")
    func navigationSettles() async {
        // Regression guard: the fade-out flag used to be set twice, once
        // outside the animation. If it were ever left true the whole form
        // renders at opacity 0 — a blank screen with no error.
        let vm = OnboardingViewModel()
        vm.navigate(to: .login)

        try? await Task.sleep(for: .milliseconds(800))

        #expect(vm.step == .login)
        #expect(vm.isTransitioning == false, "Stuck transitioning renders an invisible form")
    }

    @Test("Signup validates before advancing to traits")
    func signupValidation() async {
        let vm = OnboardingViewModel()

        vm.email = "kodi@example.com"
        vm.username = "kodi"
        vm.password = "short"          // under the 6-char minimum
        vm.handleSignupContinue()
        #expect(vm.error != nil)
        #expect(vm.step == .welcome, "Should not advance on an invalid password")

        vm.password = "longenough"
        vm.handleSignupContinue()
        try? await Task.sleep(for: .milliseconds(800))
        #expect(vm.step == .traits)
    }
}
