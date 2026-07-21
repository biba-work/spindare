import Testing
import Foundation
@testable import SpindareKit

// The overlay stack replaces the RN original's nine independent booleans,
// where z-order was decided by JSX ordering. Stack order is load-bearing here —
// these tests pin the orderings the UX actually depends on.
//
// Feed/Profile/Notifications used to be part of this stack too — Profile as a
// pushed `.hard` layer, the activity drawer as a `.draggable` one — but they're
// peer pages of AppShell's TabView now (`activePage`), entirely separate from
// `stack`. That state is covered in its own suite below.

@MainActor
@Suite
struct AppRouterTests {
    private func signedIn() -> AppRouter {
        let router = AppRouter()
        router.didSignIn(userId: "user_abc", username: "kodi", email: nil, avatarURL: nil)
        return router
    }

    @Test("Starts at onboarding and moves to the feed on sign-in")
    func rootGate() {
        let router = AppRouter()
        #expect(router.root == .onboarding)

        router.didSignIn(userId: "user_abc", username: "kodi", email: nil, avatarURL: nil)
        #expect(router.root == .feed)
        #expect(router.userId == "user_abc")
    }

    @Test("Pushing layers stacks them in order")
    func pushOrder() {
        let router = signedIn()
        router.push(.composer)
        router.push(.savedDrawer)

        #expect(router.stack == [.composer, .savedDrawer])
        #expect(router.topLayer == .savedDrawer)
    }

    @Test("Re-pushing the top layer is a no-op, not a duplicate")
    func doubleTapDoesNotDuplicate() {
        let router = signedIn()
        router.push(.composer)
        router.push(.composer)

        #expect(router.stack == [.composer], "A double-tapped button must not stack two copies")
    }

    @Test("Pushing a layer already lower in the stack promotes it")
    func promoteRatherThanDuplicate() {
        let router = signedIn()
        router.push(.composer)
        router.push(.messages)
        router.push(.composer)

        #expect(router.stack == [.messages, .composer])
    }

    @Test("Sharing mid-spin stacks the picker ABOVE whatever's showing")
    func sharePreservesUnderneath() {
        // The whole point: you hit Share from inside the spinner result, the
        // friend picker lands on top, and dismissing it returns you to the
        // result you were looking at — the layer underneath never unmounted.
        let router = signedIn()
        let someone = AppRouter.UserRef(id: "u9", username: "elia.v")
        router.push(.userProfile(someone))
        router.shareChallenge("Stare at the sky for exactly 60 seconds.")

        #expect(router.topLayer == .friendPicker)
        #expect(router.stack.first == .userProfile(someone), "The layer underneath must remain mounted")
        #expect(router.challenge == "Stare at the sky for exactly 60 seconds.")

        router.pop()
        #expect(router.topLayer == .userProfile(someone), "Dismissing the picker returns to what was underneath")
    }

    @Test("Opening a chat from messages swaps rather than stacks")
    func chatSwapsFromMessages() {
        // You should not be able to sit in a chat with the message list still
        // mounted behind it — the RN original swaps here.
        let router = signedIn()
        router.push(.messages)
        router.openChat(.init(id: "c1", otherUsername: "lena.w"))

        #expect(router.stack.count == 1)
        #expect(router.topLayer == .chat(.init(id: "c1", otherUsername: "lena.w")))
    }

    @Test("Opening a chat from a user profile swaps too")
    func chatSwapsFromUserProfile() {
        let router = signedIn()
        router.push(.userProfile(.init(id: "u2", username: "lena.w")))
        router.openChat(.init(id: "c1", otherUsername: "lena.w"))

        #expect(router.stack.count == 1)
        #expect(router.topLayer == .chat(.init(id: "c1", otherUsername: "lena.w")))
    }

    @Test("Opening a chat from elsewhere stacks normally")
    func chatStacksFromElsewhere() {
        let router = signedIn()
        router.push(.savedDrawer)
        router.openChat(.init(id: "c1", otherUsername: "lena.w"))

        #expect(router.stack.count == 2)
        #expect(router.stack.first == .savedDrawer)
    }

    @Test("Taking on a challenge carries it into the composer")
    func startProofCarriesTheSpine() {
        let router = signedIn()
        router.startProof(for: "Trace a shadow")

        #expect(router.topLayer == .composer)
        #expect(router.challenge == "Trace a shadow")
    }

    @Test("Dismissing a specific layer removes only that one")
    func targetedDismiss() {
        let router = signedIn()
        router.push(.savedDrawer)
        router.push(.composer)
        router.dismiss(.savedDrawer)

        #expect(router.stack == [.composer])
    }

    @Test("Presentation tier is derived from the layer, not the call site")
    func presentationTiers() {
        // The three tiers encode weight; flattening them loses information.
        #expect(AppRouter.Layer.friendPicker.presentation == .hard)
        #expect(AppRouter.Layer.messages.presentation == .hard)
        #expect(AppRouter.Layer.userProfile(.init(id: "u1", username: "a")).presentation == .hard)
        #expect(AppRouter.Layer.composer.presentation == .animated)
        #expect(AppRouter.Layer.savedDrawer.presentation == .draggable)
    }

    @Test("Signing out tears the whole stack down and returns to the feed page")
    func signOutResets() {
        let router = signedIn()
        router.push(.composer)
        router.push(.savedDrawer)
        router.navigate(to: .profile)
        router.challenge = "something"
        router.proofFromCamera = true

        router.didSignOut()

        #expect(router.root == .onboarding)
        #expect(router.stack.isEmpty)
        #expect(router.activePage == .feed, "A stale page selection must not survive a sign-out")
        #expect(router.challenge == nil)
        #expect(router.userId == nil)
        #expect(router.proofFromCamera == false, "Stale proof must not survive a sign-out")
    }

    @Test("Popping an empty stack is safe")
    func popEmptyIsSafe() {
        let router = signedIn()
        router.pop()
        #expect(router.stack.isEmpty)
    }
}

// MARK: - Pages

// Feed/Profile/Notifications navigation, once part of the overlay stack
// above, is now just a plain property — deliberately boring to use, which is
// the point: there's no gesture, no z-order, and no ancestor view for a tap to
// contend with.

@MainActor
@Suite
struct AppRouterPageTests {
    @Test("Starts on the feed")
    func defaultsToFeed() {
        #expect(AppRouter().activePage == .feed)
    }

    @Test("Setting the page doesn't touch the overlay stack")
    func pageIsIndependentOfStack() {
        let router = AppRouter()
        router.push(.composer)

        router.navigate(to: .profile)

        #expect(router.activePage == .profile)
        #expect(router.stack == [.composer], "Page selection and the overlay stack must not interact")
    }

    @Test("Round-trips through all three pages")
    func roundTrips() {
        let router = AppRouter()
        for page: AppRouter.Page in [.profile, .feed, .notifications, .profile] {
            router.navigate(to: page)
            #expect(router.activePage == page)
        }
    }
}
