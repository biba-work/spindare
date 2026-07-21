import SwiftUI
import SpindareKit

@main
struct SpindareApp: App {
    // Clerk publishable key — client-safe (same trust tier as a Stream key).
    // This is the development instance's key; swap for the production key when
    // shipping a production build.
    private static let clerkPublishableKey =
        "pk_test_ZW5oYW5jZWQtdXJjaGluLTkuY2xlcmsuYWNjb3VudHMuZGV2JA"

    // The deployed Nest API base URL, e.g. "https://spindare.up.railway.app".
    // While this is empty the app runs on on-device mock data (auth is still
    // real Clerk) so it stays usable before the backend is deployed. Set it to
    // the deployed URL to switch every feed/profile/social/search/upload call
    // onto the live backend. A LAN IP like "http://192.168.1.20:3000" also works
    // for same-Wi-Fi device testing against a locally-run server.
    private static let apiBaseURL = ""

    init() {
        AppEnvironment.bootstrap(
            clerkPublishableKey: Self.clerkPublishableKey,
            apiBaseURL: Self.apiBaseURL
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
