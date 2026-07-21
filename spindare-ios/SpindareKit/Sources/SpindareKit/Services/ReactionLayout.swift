import Foundation

// Where the three reactions sit on a Speedy card.
//
// The point of moving them: on a vertical short-form feed the reaction buttons
// land under your thumb in the same spot on every card, so the gesture becomes
// muscle memory and you stop reading what you're tapping. Shuffling the order
// per card forces a half-second of actually looking — which is the whole
// premise of this app applied to its own controls.
//
// Two properties this has to have, and neither is optional:
//
//   1. **Stable for a given card.** The order must be identical every time
//      that card renders — scrolling away and back, backgrounding the app,
//      relaunching. Buttons that reshuffle under a finger mid-tap would be
//      hostile, not thoughtful.
//   2. **Different across cards.** Otherwise there's no shuffle at all.
//
// Property 1 is why this does *not* use `String.hashValue`. Swift seeds its
// hasher randomly per process, so `"abc".hashValue` differs between launches —
// the order would be stable within a session and silently change every time
// the app restarted. FNV-1a below is a fixed, specified algorithm with no
// seeding, so the same id always yields the same order on every device and
// every launch.

public enum ReactionLayout {
    /// The canonical order, used as the base for every permutation.
    public static let base: [ReactionType] = [.felt, .thought, .intrigued]

    /// FNV-1a (32-bit). Chosen for being tiny, dependency-free, and — the only
    /// property that actually matters here — *specified*, so it can't change
    /// between Swift versions the way `hashValue` explicitly may.
    static func stableHash(_ string: String) -> UInt32 {
        var hash: UInt32 = 2_166_136_261
        for byte in string.utf8 {
            hash ^= UInt32(byte)
            hash = hash &* 16_777_619
        }
        return hash
    }

    /// The reaction order for a given card id.
    ///
    /// Three items means six possible orderings; the hash picks one of them by
    /// index. Every returned array is a permutation of `base` — all three
    /// reactions always present, never duplicated, never dropped.
    public static func order(for id: String) -> [ReactionType] {
        let permutations = Self.permutations
        let index = Int(stableHash(id) % UInt32(permutations.count))
        return permutations[index]
    }

    /// All six orderings, generated once rather than written out by hand so
    /// they can't be typo'd into a list that's missing one or repeats another.
    static let permutations: [[ReactionType]] = {
        var result: [[ReactionType]] = []
        for first in base {
            for second in base where second != first {
                let third = base.first { $0 != first && $0 != second }!
                result.append([first, second, third])
            }
        }
        return result
    }()
}
