import SwiftUI
import ClerkKit

// Port of src/screens/OnboardingScreen.tsx (704 LOC).
//
// The RN version has five view states: welcome, login, signup, traits, verify.
// Same structure here, driven by an enum. Clerk's iOS SDK (`ClerkKit`) handles
// the actual auth via its high-level `Clerk.shared.auth` API; this view model
// manages form state and routing around those calls.
//
// `onAuthenticated` fires with (clerkUserId, username, email) once a session is
// active. The composition root wires that to route into the tab bar and to
// create/fetch the backend profile row.

@MainActor
@Observable
public final class OnboardingViewModel {
    public enum Step: Hashable {
        case welcome
        case login
        case signup
        case traits
        case verify
    }

    // Navigation
    public var step: Step = .welcome
    public var isTransitioning = false

    // Form fields
    public var email = ""
    public var username = ""
    public var password = ""
    public var verificationCode = ""

    // Traits
    public var selectedHobbies: Set<String> = []
    public var selectedFields: Set<String> = []

    // State
    public var isSubmitting = false
    public var error: String?

    // Completion callback — the app's composition root sets this to route
    // into the main tab bar after successful auth.
    public var onAuthenticated: ((String, String, String?) -> Void)?

    public static let hobbies = [
        "Reading", "Gaming", "Fitness", "Cooking",
        "Art", "Photography", "Hiking", "Music"
    ]

    public static let fields = [
        "Computer Science", "Business", "Engineering", "Medicine",
        "Arts", "Law", "Physics", "Design"
    ]

    private let profileService: any ProfileServing

    public init(profileService: any ProfileServing = AppEnvironment.profileService) {
        self.profileService = profileService
    }

    // MARK: - Navigation

    public func navigate(to newStep: Step) {
        guard !isTransitioning else { return }
        error = nil

        // The bare `isTransitioning = true` that used to sit here made the
        // flag already-true by the time withAnimation ran, so SwiftUI saw no
        // change and the fade-out never played — the form snapped to invisible
        // instead. Let the animated write be the only one.
        withAnimation(.easeOut(duration: 0.2)) {
            isTransitioning = true
        }

        // Delay to let fade-out complete, then switch and fade in
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            guard let self else { return }
            step = newStep
            withAnimation(.easeIn(duration: 0.3)) {
                isTransitioning = false
            }
        }
    }

    // MARK: - Auth actions

    public func handleLogin() {
        guard !isSubmitting else { return }
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard !trimmedEmail.isEmpty, !password.isEmpty else {
            error = "Please fill in all fields."
            return
        }

        isSubmitting = true
        error = nil

        Task { @MainActor in
            defer { isSubmitting = false }
            do {
                _ = try await Clerk.shared.auth.signInWithPassword(
                    identifier: trimmedEmail, password: password
                )
                await completeAuthentication(
                    fallbackUsername: trimmedEmail.components(separatedBy: "@").first ?? "user",
                    fallbackEmail: trimmedEmail
                )
            } catch {
                self.error = message(for: error)
            }
        }
    }

    public func handleSignupContinue() {
        guard !isSubmitting else { return }
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let trimmedUsername = username.trimmingCharacters(in: .whitespaces)

        guard !trimmedEmail.isEmpty, !trimmedUsername.isEmpty else {
            error = "Please fill in all fields."
            return
        }
        guard password.count >= 6 else {
            error = "Password must be at least 6 characters."
            return
        }
        guard isValidEmail(trimmedEmail) else {
            error = "Please enter a valid email."
            return
        }

        email = trimmedEmail
        navigate(to: .traits)
    }

    public func handleFinalSignup() {
        guard !isSubmitting, !selectedHobbies.isEmpty else {
            if selectedHobbies.isEmpty {
                error = "Select at least one hobby."
            }
            return
        }

        isSubmitting = true
        error = nil

        Task { @MainActor in
            defer { isSubmitting = false }
            do {
                let signUp = try await Clerk.shared.auth.signUp(
                    emailAddress: email,
                    password: password,
                    username: username.trimmingCharacters(in: .whitespaces)
                )
                if signUp.status == .complete {
                    // Instance doesn't require email verification — straight in.
                    await completeAuthentication(fallbackUsername: username, fallbackEmail: email)
                } else {
                    // Prepare + send the email code, then collect it on .verify.
                    _ = try await signUp.sendEmailCode()
                    navigate(to: .verify)
                }
            } catch {
                self.error = message(for: error)
            }
        }
    }

    public func handleVerify() {
        guard !isSubmitting else { return }
        guard verificationCode.count >= 6 else {
            error = "Please enter the 6-digit code."
            return
        }

        isSubmitting = true
        error = nil

        Task { @MainActor in
            defer { isSubmitting = false }
            guard let signUp = Clerk.shared.auth.currentSignUp else {
                error = "Your sign-up session expired. Please start again."
                return
            }
            do {
                let verified = try await signUp.verifyEmailCode(verificationCode)
                guard verified.status == .complete else {
                    error = "That code didn't work. Double-check and try again."
                    return
                }
                await completeAuthentication(fallbackUsername: username, fallbackEmail: email)
            } catch {
                self.error = message(for: error)
            }
        }
    }

    public func handleGoogleAuth() {
        guard !isSubmitting else { return }
        isSubmitting = true
        error = nil
        Task { @MainActor in
            defer { isSubmitting = false }
            do {
                _ = try await Clerk.shared.auth.signInWithOAuth(provider: .google)
                await completeAuthentication(fallbackUsername: "user", fallbackEmail: nil)
            } catch {
                self.error = message(for: error)
            }
        }
    }

    public func handleAppleAuth() {
        guard !isSubmitting else { return }
        isSubmitting = true
        error = nil
        Task { @MainActor in
            defer { isSubmitting = false }
            do {
                // OAuth redirect (Safari sheet), same as Google — not native
                // ASAuthorizationController. Deliberate: the native flow needs
                // the Sign In with Apple capability added in Xcode *and* enabled
                // on the App ID in the Apple Developer portal first; this way
                // needs neither, just Apple toggled on in Clerk's dashboard.
                _ = try await Clerk.shared.auth.signInWithOAuth(provider: .apple)
                await completeAuthentication(fallbackUsername: "user", fallbackEmail: nil)
            } catch {
                self.error = message(for: error)
            }
        }
    }

    // MARK: - Traits

    public func toggleHobby(_ hobby: String) {
        if selectedHobbies.contains(hobby) {
            selectedHobbies.remove(hobby)
        } else {
            selectedHobbies.insert(hobby)
        }
    }

    public func toggleField(_ field: String) {
        if selectedFields.contains(field) {
            selectedFields.remove(field)
        } else {
            selectedFields.insert(field)
        }
    }

    // MARK: - Auth helpers

    /// Reads identity off the now-active Clerk session, ensures a backend
    /// profile row exists, then notifies the app.
    ///
    /// Clerk activates the session on a completed sign-in/sign-up, so
    /// `Clerk.shared.user` is populated by the time this runs; the fallbacks
    /// cover the OAuth/email-login cases where the form didn't capture a
    /// username locally. The `createProfile` call is a server-side idempotent
    /// upsert keyed on the Clerk user id — it inserts the row (with the traits
    /// picked during onboarding) for a new user and is a no-op for a returning
    /// one, which is why it's safe to run on the login path too.
    private func completeAuthentication(fallbackUsername: String, fallbackEmail: String?) async {
        let user = Clerk.shared.user
        let userId = user?.id ?? Clerk.shared.session?.user?.id ?? ""
        let resolvedUsername = user?.username ?? fallbackUsername
        let resolvedEmail = user?.primaryEmailAddress?.emailAddress ?? fallbackEmail

        _ = try? await profileService.createProfile(
            username: resolvedUsername,
            email: resolvedEmail,
            hobbies: Array(selectedHobbies),
            studyFields: Array(selectedFields)
        )

        onAuthenticated?(userId, resolvedUsername, resolvedEmail)
    }

    /// Clerk's errors conform to `LocalizedError` with a user-facing message,
    /// so `localizedDescription` is already presentable — no code mapping table
    /// like the RN client's `getFriendlyError` is needed here.
    private func message(for error: Error) -> String {
        let description = error.localizedDescription
        return description.isEmpty ? "Something went wrong. Please try again." : description
    }

    // MARK: - Validation

    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }
}
