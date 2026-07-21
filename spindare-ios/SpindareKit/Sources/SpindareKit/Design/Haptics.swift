import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

// Imperative haptics, for the cases `.sensoryFeedback` can't express.
//
// `.sensoryFeedback(_:trigger:)` is the right tool nearly everywhere in this
// app and stays in use — but it fires off a *state change*, and a swipe arming
// mid-gesture isn't one: the value that changed is derived from a drag
// translation that's still moving, and the feedback has to land at the instant
// of crossing rather than on the next render. Calling the generator directly is
// the only way to get that timing.

public enum Haptics {
    public enum Weight: Sendable {
        case light, medium, heavy, soft, rigid
    }

    @MainActor
    public static func impact(_ weight: Weight) {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: weight.uiStyle).impactOccurred()
        #endif
    }

    @MainActor
    public static func success() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
}

#if canImport(UIKit)
private extension Haptics.Weight {
    var uiStyle: UIImpactFeedbackGenerator.FeedbackStyle {
        switch self {
        case .light: .light
        case .medium: .medium
        case .heavy: .heavy
        case .soft: .soft
        case .rigid: .rigid
        }
    }
}
#endif
