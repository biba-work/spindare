import SwiftUI

// Drives a single conversation. Sending is optimistic, mirroring the pattern
// `FeedViewModel.react` already uses for reactions: apply locally first so the
// tap feels instant, then reconcile with whatever the service actually did.
//
// Unlike a reaction, a failed send can't just roll back to nothing — the text
// you typed is still worth keeping so you can retry it, which is why messages
// carry a `DeliveryState` instead of being removed on failure.

@MainActor
@Observable
public final class ChatViewModel {
    public var messages: [Message] = []
    public var isLoading = false
    public var error: String?

    private let conversation: AppRouter.ConversationRef
    private let chatService: any ChatServing

    public init(conversation: AppRouter.ConversationRef, chatService: any ChatServing = MockChatService()) {
        self.conversation = conversation
        self.chatService = chatService
    }

    public func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            messages = try await chatService.messages(in: conversation)
                .sorted { $0.sentAt < $1.sentAt }
        } catch {
            self.error = "Couldn't load this conversation."
        }

        isLoading = false
    }

    /// Appends a `.sending` message immediately, then swaps it for the
    /// service's confirmed copy or marks it `.failed` — never removes it, so a
    /// failure doesn't silently discard what was typed.
    ///
    /// An attachment makes empty text legal: an image or a voice note is the
    /// message, and requiring a caption alongside it would be wrong.
    public func send(
        _ text: String,
        currentUserId: String,
        payload: MessagePayload = .text,
        emphasis: CGFloat? = nil
    ) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let isAttachment = payload != .text
        guard !trimmed.isEmpty || isAttachment else { return }

        let pendingId = UUID().uuidString
        let pending = Message(
            id: pendingId,
            conversationId: conversation.id,
            senderId: currentUserId,
            text: trimmed,
            sentAt: Date(),
            delivery: .sending,
            payload: payload,
            emphasis: emphasis
        )
        // Scoped to just this append, with the calm entrance curve used
        // everywhere else for "something appeared" — not `.pop`, which is
        // built for bouncy tap feedback and, applied here via a blanket
        // `.animation(_:value:)` on the whole list, was re-animating every
        // bubble on any array diff instead of just the new one.
        withAnimation(Spindare.Motion.enter) { messages.append(pending) }

        do {
            let sent = try await chatService.send(trimmed, in: conversation, payload: payload, emphasis: emphasis)
            replace(pendingId, with: sent)
        } catch {
            mark(pendingId, as: .failed)
        }
    }

    /// Unsends an outgoing message if within 1 minute of sending.
    public func unsend(_ message: Message) async {
        withAnimation(Spindare.Motion.enter) {
            messages.removeAll { $0.id == message.id }
        }
        try? await chatService.deleteMessage(id: message.id, in: conversation.id)
    }

    /// Re-attempts a `.failed` message without retyping it.
    public func retry(_ message: Message) async {
        guard message.delivery == .failed else { return }
        mark(message.id, as: .sending)

        do {
            let sent = try await chatService.send(message.text, in: conversation, payload: message.payload, emphasis: message.emphasis)
            replace(message.id, with: sent)
        } catch {
            mark(message.id, as: .failed)
        }
    }

    private func replace(_ id: String, with confirmed: Message) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(Spindare.Motion.enter) { messages[index] = confirmed }
    }

    private func mark(_ id: String, as delivery: DeliveryState) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(Spindare.Motion.enter) { messages[index].delivery = delivery }
    }
}
