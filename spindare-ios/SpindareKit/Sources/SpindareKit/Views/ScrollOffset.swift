import SwiftUI

// Reports a scroll view's vertical offset upward so the shell can drive the
// hiding header, and so the drawer can gate its drag-to-dismiss on being
// scrolled to the top.

public struct ScrollOffsetKey: PreferenceKey {
    public static let defaultValue: CGFloat = 0
    public static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

public extension View {
    /// Attach inside a `ScrollView`'s content to publish its offset.
    func reportsScrollOffset(in space: String) -> some View {
        background {
            GeometryReader { proxy in
                Color.clear.preference(
                    key: ScrollOffsetKey.self,
                    value: -proxy.frame(in: .named(space)).minY
                )
            }
        }
    }

    func onScrollOffsetChange(in space: String, _ action: @escaping (CGFloat) -> Void) -> some View {
        coordinateSpace(name: space)
            .onPreferenceChange(ScrollOffsetKey.self) { offset in
                action(offset)
            }
    }
}

/// A scrolled content view's total measured height. Paired with
/// `ScrollOffsetKey` and the viewport's own height, this is what lets a caller
/// detect overscroll *past the bottom* — top-overscroll detection only needs
/// the offset (it's negative the moment you pull past a resting scroll
/// position of 0), but the bottom equivalent depends on how tall the content
/// is relative to the viewport, which the offset alone doesn't carry.
public struct ContentHeightKey: PreferenceKey {
    public static let defaultValue: CGFloat = 0
    public static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

public extension View {
    /// Attach to a `ScrollView`'s content to publish its total height.
    func reportsContentHeight() -> some View {
        background {
            GeometryReader { proxy in
                Color.clear.preference(key: ContentHeightKey.self, value: proxy.size.height)
            }
        }
    }
}

// MARK: - Per-item frames

/// Reports scrolled items' frames keyed by id, so a parent can tell which one
/// is currently centered. A single scroll offset can't answer that on its own
/// — item heights vary (a post's image aspect ratio, caption length, reaction
/// count), so there's no fixed offset-to-item formula.
public struct ItemFramesKey: PreferenceKey {
    public static let defaultValue: [String: CGRect] = [:]
    public static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        // Every reporting item contributes one entry per update; later values
        // for the same id (there shouldn't be duplicates, but ids are only as
        // unique as callers make them) simply win.
        value.merge(nextValue()) { _, new in new }
    }
}

public extension View {
    /// Attach to a scrolled item to publish its frame under `id`, in `space`.
    func reportsFrame(id: String, in space: String) -> some View {
        background {
            GeometryReader { proxy in
                Color.clear.preference(key: ItemFramesKey.self, value: [id: proxy.frame(in: .named(space))])
            }
        }
    }
}

/// Picks the id whose frame's vertical centre is closest to `midpoint`, among
/// frames that actually overlap the `0..<viewportHeight` viewport. Returns nil
/// if nothing qualifies (e.g. an empty feed, or a moment mid-layout where no
/// frame has been reported yet).
public func centeredItem(among frames: [String: CGRect], viewportHeight: CGFloat) -> String? {
    let midpoint = viewportHeight / 2
    return frames
        .filter { $0.value.maxY > 0 && $0.value.minY < viewportHeight }
        .min { abs($0.value.midY - midpoint) < abs($1.value.midY - midpoint) }?
        .key
}
