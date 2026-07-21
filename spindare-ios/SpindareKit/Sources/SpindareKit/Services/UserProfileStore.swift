import SwiftUI
import Combine

/// Centralized thread-safe User Profile state store preserving structural identity
/// across Profile View toggles (Grid vs. Singular) and preventing accidental handle overwrites.
@MainActor
public final class UserProfileStore: ObservableObject {
    public static let shared = UserProfileStore()

    @Published public var username: String = ""
    @Published public var email: String = ""
    @Published public var avatarURL: URL? = nil
    @Published public var selectedViewMode: ProfileViewMode = .grid

    public enum ProfileViewMode: String, CaseIterable, Sendable {
        case grid, singular
    }

    public init() {}

    /// Loads session profile details ensuring handles are never overwritten with "you".
    public func loadUserProfile(username rawUsername: String, email rawEmail: String, avatarURL rawAvatarURL: URL?) {
        let trimmed = rawUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && trimmed.lowercased() != "you" {
            self.username = trimmed
        } else if self.username.isEmpty {
            self.username = "spindare_user"
        }

        if !rawEmail.isEmpty {
            self.email = rawEmail
        }

        if let rawAvatarURL {
            self.avatarURL = rawAvatarURL
        }
    }

    /// Safely updates username while preventing static "you" overwrites.
    public func updateUsername(_ newUsername: String) {
        let trimmed = newUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.lowercased() != "you" else { return }
        self.username = trimmed
    }
}
