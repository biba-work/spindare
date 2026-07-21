import SwiftUI

// Loading placeholders that mirror the shape of the content they stand in for,
// so nothing jumps when the real thing arrives.
//
// The sweep is driven by TimelineView rather than a repeating animation: a
// `.repeatForever` keeps running while the view is off-screen and keeps waking
// the render loop, which is a real cost on a feed of these.

public struct SkeletonShape: View {
    @Environment(\.colorScheme) private var scheme
    let cornerRadius: CGFloat

    public init(cornerRadius: CGFloat = Spindare.Radius.control) {
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            // 1.6s period, mapped to a sweep that travels from off-left to
            // off-right so the highlight never appears to bounce.
            let progress = (t.truncatingRemainder(dividingBy: 1.6)) / 1.6

            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(base)
                .overlay {
                    GeometryReader { proxy in
                        LinearGradient(
                            colors: [.clear, highlight, .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: proxy.size.width * 0.6)
                        .offset(x: (progress * 2.2 - 0.6) * proxy.size.width)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        }
    }

    private var base: Color {
        scheme == .dark ? Color.white.opacity(0.07) : Color.black.opacity(0.055)
    }

    private var highlight: Color {
        scheme == .dark ? Color.white.opacity(0.06) : Color.white.opacity(0.55)
    }
}

// MARK: - Feed

/// Mirrors `PostCardView`: author row, challenge pill, image block, action bar.
public struct FeedSkeleton: View {
    @Environment(\.colorScheme) private var scheme
    let count: Int

    public init(count: Int = 3) {
        self.count = count
    }

    public var body: some View {
        VStack(spacing: Spindare.Spacing.md) {
            ForEach(0..<count, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: Spindare.Spacing.sm) {
                        SkeletonShape(cornerRadius: 18).frame(width: 36, height: 36)
                        VStack(alignment: .leading, spacing: 5) {
                            SkeletonShape(cornerRadius: 4).frame(width: 90, height: 11)
                            SkeletonShape(cornerRadius: 4).frame(width: 60, height: 9)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, Spindare.Spacing.md)
                    .padding(.top, Spindare.Spacing.md)

                    SkeletonShape(cornerRadius: Spindare.Radius.control)
                        .frame(width: 140, height: 24)
                        .padding(.horizontal, Spindare.Spacing.md)
                        .padding(.top, Spindare.Spacing.sm)

                    SkeletonShape(cornerRadius: Spindare.Radius.control)
                        .frame(height: 300)
                        .padding(.horizontal, Spindare.Spacing.md)
                        .padding(.top, Spindare.Spacing.md)

                    SkeletonShape(cornerRadius: Spindare.Radius.control)
                        .frame(height: 44)
                        .padding(.horizontal, Spindare.Spacing.md)
                        .padding(.vertical, Spindare.Spacing.md)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }
                .spindareElevation(.card)
                .padding(.horizontal, Spindare.Spacing.sm)
            }
        }
        // Placeholders are decoration; VoiceOver should skip straight to the
        // loading announcement rather than reading a wall of empty shapes.
        .accessibilityHidden(true)
    }
}

// MARK: - Grid

public struct GridSkeleton: View {
    let count: Int

    public init(count: Int = 9) {
        self.count = count
    }

    public var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 3), spacing: 3) {
            ForEach(0..<count, id: \.self) { _ in
                SkeletonShape(cornerRadius: 0)
                    .aspectRatio(1, contentMode: .fit)
            }
        }
        .padding(.horizontal, 3)
        .accessibilityHidden(true)
    }
}

// MARK: - Rows

/// Avatar + two text lines. Covers the drawer lists, search results and the
/// conversation list, which are all the same shape.
public struct RowSkeleton: View {
    let count: Int
    let showsAvatar: Bool

    public init(count: Int = 5, showsAvatar: Bool = true) {
        self.count = count
        self.showsAvatar = showsAvatar
    }

    public var body: some View {
        VStack(spacing: Spindare.Spacing.md) {
            ForEach(0..<count, id: \.self) { index in
                HStack(spacing: Spindare.Spacing.md) {
                    if showsAvatar {
                        SkeletonShape(cornerRadius: 20).frame(width: 40, height: 40)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        SkeletonShape(cornerRadius: 4)
                            .frame(height: 12)
                            // Varied widths so it reads as text rather than as
                            // a stack of identical bars.
                            .frame(maxWidth: index.isMultiple(of: 2) ? 220 : 170, alignment: .leading)
                        SkeletonShape(cornerRadius: 4)
                            .frame(height: 10)
                            .frame(maxWidth: 90, alignment: .leading)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .accessibilityHidden(true)
    }
}
