import SwiftUI

// Horizontal paging that reports where the finger is, not just where it landed.
//
// This replaces `TabView(.page)` in both places the app pages horizontally.
// `TabView` gives you a smooth swipe but tells you nothing until the page
// *commits* — its selection binding fires once, at the end. Two visible bugs
// came out of that:
//
//   * The notifications tab indicator could only jump, because the one value
//     it could observe changed once the swipe was already over. It slid on tap
//     and teleported on swipe, from the same binding, for that reason.
//   * A programmatic page change (the header's avatar/bell) had no continuous
//     motion to inherit, so it cut even inside `withAnimation`.
//
// A paging `ScrollView` fixes both: `onScrollGeometryChange` publishes the
// live content offset every frame, so `progress` tracks the finger 1:1 and
// anything bound to it moves with the page rather than after it; and
// `scrollPosition` genuinely animates when set inside `withAnimation`, so a tap
// travels the same path a swipe does.

public struct PagedStack<Page: Hashable, Content: View>: View {
    @Binding private var selection: Page
    /// Continuous position in page units — 1.4 means 40% of the way from the
    /// second page to the third. Whole numbers only ever occur at rest.
    @Binding private var progress: CGFloat

    private let pages: [Page]
    private let content: (Page) -> Content

    public init(
        pages: [Page],
        selection: Binding<Page>,
        progress: Binding<CGFloat>,
        @ViewBuilder content: @escaping (Page) -> Content
    ) {
        self.pages = pages
        self._selection = selection
        self._progress = progress
        self.content = content
    }

    /// `scrollPosition` deals in optionals — a scroll view can be between two
    /// ids. Nil-ing out `selection` isn't meaningful here (there is always a
    /// page showing), so a nil write is dropped rather than propagated.
    private var scrollBinding: Binding<Page?> {
        Binding(
            get: { selection },
            set: { if let new = $0, new != selection { selection = new } }
        )
    }

    public var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width

            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(pages, id: \.self) { page in
                        content(page)
                            .frame(width: width, height: proxy.size.height)
                            .id(page)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: scrollBinding)
            .scrollIndicators(.hidden)
            .reportsPageProgress(pageWidth: width) { progress = $0 }
        }
    }
}

private extension View {
    /// Publishes scroll offset in page units. `onScrollGeometryChange` needs
    /// iOS 18 / macOS 15; this package still builds for macOS 14, where the
    /// page simply doesn't report progress and anything bound to it falls back
    /// to animating off the committed selection alone.
    @ViewBuilder
    func reportsPageProgress(
        pageWidth: CGFloat,
        _ action: @escaping (CGFloat) -> Void
    ) -> some View {
        if #available(iOS 18, macOS 15, *) {
            onScrollGeometryChange(for: CGFloat.self) { geometry in
                pageWidth > 0 ? geometry.contentOffset.x / pageWidth : 0
            } action: { _, new in
                action(new)
            }
        } else {
            self
        }
    }
}

// MARK: - Indicator geometry

/// Where a sliding tab indicator sits for a given continuous page position.
///
/// Pure so the interpolation is testable: the failure this is guarding against
/// is an indicator that's subtly out of step with the page — half a tab behind
/// at the midpoint, or overshooting at the ends — which is invisible in a
/// screenshot and only shows up mid-gesture.
public struct TabIndicator: Sendable, Equatable {
    public let offset: CGFloat
    public let width: CGFloat

    public init(offset: CGFloat, width: CGFloat) {
        self.offset = offset
        self.width = width
    }

    /// - Parameters:
    ///   - progress: continuous page position (0 ..< tabCount - 1).
    ///   - totalWidth: width of the whole tab bar.
    ///   - tabCount: number of equal-width tabs.
    ///   - inset: horizontal padding between a tab's edge and its indicator.
    public static func at(
        progress: CGFloat,
        totalWidth: CGFloat,
        tabCount: Int,
        inset: CGFloat = 0
    ) -> TabIndicator {
        guard tabCount > 0, totalWidth > 0 else { return TabIndicator(offset: 0, width: 0) }

        let tabWidth = totalWidth / CGFloat(tabCount)
        // Clamped so an over-scroll bounce at either end — which pushes
        // progress below 0 or past the last page — doesn't fling the indicator
        // off the end of the bar.
        let clamped = min(max(progress, 0), CGFloat(tabCount - 1))

        return TabIndicator(
            offset: clamped * tabWidth + inset,
            width: max(0, tabWidth - inset * 2)
        )
    }
}
