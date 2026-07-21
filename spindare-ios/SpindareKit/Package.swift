// swift-tools-version: 6.0
import PackageDescription

// Platform-agnostic core of the Spindare iOS app: models, networking, service
// protocols and design tokens. Deliberately free of iOS-only APIs so it builds
// and unit-tests with `swift build` / `swift test` on macOS — no Xcode, no
// simulator. The Xcode app target depends on this and holds the SwiftUI views,
// camera, haptics and everything else that genuinely needs UIKit.

let package = Package(
    name: "SpindareKit",
    platforms: [
        // iOS 17, not 18: the app ships to TestFlight testers who may not have
        // updated iOS even on hardware that supports it. Everything this
        // package leans on — @Observable, .sensoryFeedback, paging scroll,
        // PhaseAnimator/KeyframeAnimator, MagnifyGesture, MapKit's
        // MapContentBuilder — is iOS 17. The one genuinely 18-only API
        // (`onScrollGeometryChange`, for the tab indicator's live swipe
        // tracking) is `#available`-guarded with a documented fallback.
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "SpindareKit", targets: ["SpindareKit"]),
    ],
    dependencies: [
        // Auth. `from: "1.1.4"` is an intentional lower bound, not a pin: recent
        // Clerk tags ship a swift-tools-version 6.2 manifest, so a Swift 6.1
        // toolchain (plain `swift build`) resolves the newest 1.1.x it can parse,
        // while Xcode 26 (Swift 6.2) — where the app actually ships — resolves
        // the current 1.3.x. Both expose the same `ClerkKit` high-level `Auth`
        // API this app calls, so either resolution compiles.
        .package(url: "https://github.com/clerk/clerk-ios.git", from: "1.1.4"),
    ],
    targets: [
        .target(
            name: "SpindareKit",
            dependencies: [
                // Only the headless `ClerkKit` product — `ClerkKitUI` (and its
                // Nuke/PhoneNumberKit deps) is Clerk's prebuilt sign-in UI, which
                // this app doesn't use; it has its own OnboardingView.
                .product(name: "ClerkKit", package: "clerk-ios"),
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(name: "SpindareKitTests", dependencies: ["SpindareKit"]),
    ]
)
