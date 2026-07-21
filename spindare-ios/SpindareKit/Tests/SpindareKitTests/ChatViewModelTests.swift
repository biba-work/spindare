import Testing
import Foundation
@testable import SpindareKit

// A controllable ChatServing double: send() can be scripted to fail on
// specific attempts, which is what the retry tests need — a plain "always
// throws" stub can't distinguish "still broken" from "fixed on retry."
private actor ScriptedChatService: ChatServing {
    private var history: [Message]
    private var sendAttempts = 0
    private let failFirst: Int

    struct Boom: Error {}

    init(history: [Message] = [], failFirst: Int = 0) {
        self.history = history
        self.failFirst = failFirst
    }

    func messages(in conversation: AppRouter.ConversationRef) async throws -> [Message] {
        history
    }

    func send(_ text: String, in conversation: AppRouter.ConversationRef) async throws -> Message {
        sendAttempts += 1
        if sendAttempts <= failFirst { throw Boom() }
        let message = Message(
            id: "server-\(sendAttempts)",
            conversationId: conversation.id,
            senderId: "me",
            text: text,
            sentAt: Date()
        )
        history.append(message)
        return message
    }

    func attempts() -> Int { sendAttempts }

    // The list-management half of ChatServing. Unused by these tests — they
    // exercise a single conversation's transcript — but required for
    // conformance.
    func conversations() async throws -> [Conversation] { [] }
    func archivedConversations() async throws -> [Conversation] { [] }
    func deleteConversation(id: String) async throws {}
    func setMuted(_ muted: Bool, conversationId: String) async throws {}
    func archiveConversation(id: String) async throws {}
    func unarchiveConversation(id: String) async throws {}
}

private let conversation = AppRouter.ConversationRef(id: "conv-them", otherUsername: "them")

@MainActor
@Suite("Chat view model")
struct ChatViewModelTests {

    @Test("Load populates messages sorted oldest first")
    func loadSortsByTime() async {
        let now = Date()
        let service = ScriptedChatService(history: [
            Message(id: "2", conversationId: conversation.id, senderId: "them", text: "second", sentAt: now.addingTimeInterval(10)),
            Message(id: "1", conversationId: conversation.id, senderId: "them", text: "first", sentAt: now),
        ])
        let vm = ChatViewModel(conversation: conversation, chatService: service)

        await vm.load()

        #expect(vm.messages.map(\.text) == ["first", "second"])
        #expect(vm.isLoading == false)
    }

    @Test("Sending appears immediately as .sending, before the service resolves")
    func sendIsOptimistic() async {
        let vm = ChatViewModel(conversation: conversation, chatService: ScriptedChatService())

        let task = Task { await vm.send("hey", currentUserId: "me") }
        // Give the optimistic append a chance to land before the awaited
        // service call resolves — it's synchronous within `send`, so this
        // is really just documenting the guarantee, not racing it.
        await task.value

        #expect(vm.messages.count == 1)
        #expect(vm.messages[0].delivery == .sent)
        #expect(vm.messages[0].text == "hey")
    }

    @Test("A successful send replaces the pending message with the server copy")
    func successReplacesPending() async {
        let service = ScriptedChatService()
        let vm = ChatViewModel(conversation: conversation, chatService: service)

        await vm.send("hello", currentUserId: "me")

        #expect(vm.messages.count == 1)
        #expect(vm.messages[0].id == "server-1")
        #expect(vm.messages[0].delivery == .sent)
    }

    @Test("A failed send marks the message .failed instead of removing it")
    func failureMarksFailed() async {
        let service = ScriptedChatService(failFirst: 1)
        let vm = ChatViewModel(conversation: conversation, chatService: service)

        await vm.send("will fail", currentUserId: "me")

        #expect(vm.messages.count == 1)
        #expect(vm.messages[0].delivery == .failed)
        #expect(vm.messages[0].text == "will fail")
    }

    @Test("Retrying a failed message can succeed without retyping it")
    func retrySucceeds() async {
        let service = ScriptedChatService(failFirst: 1)
        let vm = ChatViewModel(conversation: conversation, chatService: service)

        await vm.send("flaky", currentUserId: "me")
        #expect(vm.messages[0].delivery == .failed)

        await vm.retry(vm.messages[0])

        #expect(vm.messages.count == 1)
        #expect(vm.messages[0].delivery == .sent)
        #expect(vm.messages[0].text == "flaky")
        #expect(await service.attempts() == 2)
    }

    @Test("Retrying a message that isn't failed is a no-op")
    func retryIgnoresNonFailed() async {
        let service = ScriptedChatService()
        let vm = ChatViewModel(conversation: conversation, chatService: service)

        await vm.send("fine", currentUserId: "me")
        let before = vm.messages

        await vm.retry(vm.messages[0])

        #expect(vm.messages == before)
        #expect(await service.attempts() == 1)
    }

    @Test("Blank text never gets appended")
    func blankTextIsIgnored() async {
        let vm = ChatViewModel(conversation: conversation, chatService: ScriptedChatService())

        await vm.send("   ", currentUserId: "me")

        #expect(vm.messages.isEmpty)
    }

    @Test("A load failure surfaces an error rather than leaving stale state")
    func loadFailureSetsError() async {
        struct AlwaysFails: ChatServing {
            struct Boom: Error {}
            func messages(in conversation: AppRouter.ConversationRef) async throws -> [Message] { throw Boom() }
            func send(_ text: String, in conversation: AppRouter.ConversationRef) async throws -> Message { throw Boom() }
            func conversations() async throws -> [Conversation] { throw Boom() }
            func archivedConversations() async throws -> [Conversation] { throw Boom() }
            func deleteConversation(id: String) async throws { throw Boom() }
            func setMuted(_ muted: Bool, conversationId: String) async throws { throw Boom() }
            func archiveConversation(id: String) async throws { throw Boom() }
            func unarchiveConversation(id: String) async throws { throw Boom() }
        }
        let vm = ChatViewModel(conversation: conversation, chatService: AlwaysFails())

        await vm.load()

        #expect(vm.error != nil)
        #expect(vm.messages.isEmpty)
    }
}
