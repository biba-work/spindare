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
    // into the main tab bar after successful auth. Carries (userId, username,
    // email, avatarURL) so the signed-in identity — including the profile
    // photo — is set app-wide from the moment auth completes, not just on the
    // profile screen.
    public var onAuthenticated: ((String, String, String?, String?) -> Void)?

    /// True while an OAuth sign-in that turned out to be a *new* user is
    /// finishing through the traits step. Distinguishes "Finish Setup" creating
    /// a profile for an already-authenticated Clerk session (OAuth) from the
    /// email path, which still has a Clerk sign-up to complete first.
    public var isOAuthCompletion = false

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
        // The traits step's "Finish Setup" serves both paths. For a new OAuth
        // user the Clerk session already exists — there is no sign-up to run,
        // only a profile to create with the interests just picked.
        if isOAuthCompletion {
            completeOAuthProfile()
            return
        }

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

    /// Finishes a *new* OAuth sign-up: the session is already active, so this
    /// just needs a username and at least one interest, then creates the profile.
    private func completeOAuthProfile() {
        let trimmedUsername = username.trimmingCharacters(in: .whitespaces)
        guard !trimmedUsername.isEmpty else {
            error = "Pick a username."
            return
        }
        guard !selectedHobbies.isEmpty else {
            error = "Select at least one hobby."
            return
        }

        isSubmitting = true
        error = nil
        Task { @MainActor in
            defer { isSubmitting = false }
            await completeAuthentication(fallbackUsername: trimmedUsername, fallbackEmail: email)
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
                await routeAfterOAuth()
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
                await routeAfterOAuth()
            } catch {
                self.error = message(for: error)
            }
        }
    }

    /// After a Clerk OAuth session is active, decide whether this is a returning
    /// user (a backend profile already exists → straight in) or a new one (no
    /// profile yet → collect a username and interests first, so an OAuth sign-up
    /// gets the same onboarding as an email one rather than a bare "user" with
    /// no interests and an undetermined engagement badge).
    ///
    /// `GET /profiles` returns `null` for a user with no row yet, which is the
    /// clean new-vs-returning signal — and because `createProfile` is a
    /// server-side upsert, a returning user's row is never clobbered.
    private func routeAfterOAuth() async {
        if let profile = (try? await profileService.currentProfile()) ?? nil {
            finish(
                userId: profile.id,
                username: profile.username,
                email: profile.email,
                avatarURL: profile.photoURL
            )
            return
        }

        // New OAuth user: prefill whatever Clerk already knows, then send them
        // through the traits step to pick a username (if missing) and interests.
        isOAuthCompletion = true
        username = Clerk.shared.user?.username ?? ""
        email = Clerk.shared.user?.primaryEmailAddress?.emailAddress ?? ""
        navigate(to: .traits)
    }

    // MARK: - Traits

    /// Backs out of the traits step. For an OAuth completion this also signs the
    /// half-finished Clerk session out, so returning to welcome doesn't leave an
    /// authenticated-but-profile-less session that would make a later email
    /// sign-up fail with "already signed in."
    public func cancelTraits() {
        if isOAuthCompletion {
            isOAuthCompletion = false
            Task { try? await Clerk.shared.auth.signOut() }
            navigate(to: .welcome)
        } else {
            navigate(to: .signup)
        }
    }

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

    /// The active Clerk user's id, however the session was established.
    private var currentUserId: String {
        Clerk.shared.user?.id ?? Clerk.shared.session?.user?.id ?? ""
    }

    /// Reads identity off the now-active Clerk session, ensures a backend
    /// profile row exists, then notifies the app.
    ///
    /// Clerk activates the session on a completed sign-in/sign-up, so
    /// `Clerk.shared.user` is populated by the time this runs; the fallbacks
    /// cover the OAuth/email-login cases where the form didn't capture a
    /// username locally. `createProfile` is a server-side idempotent upsert
    /// keyed on the Clerk user id — it inserts the row (with the traits picked
    /// during onboarding) for a new user and returns the existing row unchanged
    /// for a returning one, which is why it's safe to run on the login path too
    /// and why the returned profile carries a returning user's real avatar.
    ///
    /// Failure is surfaced rather than swallowed: a signed-in Clerk session with
    /// no backend profile is exactly the "everything's empty" state, so if the
    /// row can't be created the user stays on this screen with an error instead
    /// of being dropped into a broken app.
    private func completeAuthentication(fallbackUsername: String, fallbackEmail: String?) async {
        let user = Clerk.shared.user
        let userId = currentUserId
        let resolvedUsername = user?.username ?? fallbackUsername
        let resolvedEmail = user?.primaryEmailAddress?.emailAddress ?? fallbackEmail

        do {
            let profile = try await profileService.createProfile(
                username: resolvedUsername,
                email: resolvedEmail,
                hobbies: Array(selectedHobbies),
                studyFields: Array(selectedFields)
            )
            finish(
                userId: userId,
                username: profile.username,
                email: profile.email ?? resolvedEmail,
                avatarURL: profile.photoURL
            )
        } catch {
            self.error = "Couldn't finish setting up your account. \(message(for: error))"
        }
    }

    /// Hands the resolved identity — including the profile photo — to the app.
    private func finish(userId: String, username: String, email: String?, avatarURL: String?) {
        isOAuthCompletion = false
        onAuthenticated?(userId, username, email, avatarURL)
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
