import SwiftUI
import Observation

// Port of src/screens/PostCreationScreen.tsx view model logic.
// Manages the state for creating a response to a challenge.

@MainActor
@Observable
public final class ChallengeViewModel {
    public var challenge: String
    public var content: String = ""
    public var mediaURL: URL?
    public var isVideo: Bool = false
    
    public var username: String
    public var avatar: String?
    
    public var isSubmitting: Bool = false
    public var showSuccess: Bool = false
    public var error: String?
    
    private let feedService: any FeedServing
    public var onPostComplete: (() -> Void)?
    
    public init(
        challenge: String,
        username: String,
        avatar: String? = nil,
        mediaURL: URL? = nil,
        isVideo: Bool = false,
        feedService: any FeedServing = AppEnvironment.feedService
    ) {
        self.challenge = challenge
        self.username = username
        self.avatar = avatar
        self.mediaURL = mediaURL
        self.isVideo = isVideo
        self.feedService = feedService
    }
    
    public func submitPost() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        error = nil
        
        do {
            // Upload media would go here if mediaURL is local file
            let uploadedMediaURL = mediaURL?.absoluteString // Placeholder
            
            _ = try await feedService.createPost(
                challenge: challenge,
                content: content,
                media: uploadedMediaURL,
                username: username,
                avatar: avatar
            )
            
            // Show success animation state
            showSuccess = true
            
            // Wait for animation to play out
            try? await Task.sleep(for: .seconds(2))
            
            isSubmitting = false
            onPostComplete?()
            
        } catch {
            self.error = "Failed to post. Please try again."
            isSubmitting = false
        }
    }
}
