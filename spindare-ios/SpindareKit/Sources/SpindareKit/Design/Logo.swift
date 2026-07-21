import SwiftUI

// Brand assets ship as loose files in the package bundle rather than an asset
// catalog, so they're loaded by URL. `Image(_:bundle:)` looks in asset catalogs
// first and silently renders nothing for loose resources, which is a very quiet
// way to lose a logo.

public enum SpindareLogo: Sendable {
    /// The blue spiral, transparent background. Use wherever the app marks
    /// itself against a colour that isn't the source's cream backdrop.
    case mark
    /// The blue spiral exactly as supplied, opaque cream background. Only for
    /// contexts that want that backdrop deliberately — the app icon, which
    /// must stay opaque regardless (iOS flattens any alpha there anyway).
    case markOpaque
    /// Text-only "Spindare" wordmark, transparent background, dark ink. This
    /// is what scales cleanly into the header — see AppHeader.swift.
    case wordmark
    /// Same wordmark, white ink, for dark backgrounds — dark ink on a dark
    /// background is close to invisible. Despite the name, `.wordmarkDark`
    /// is *not* this: it's dark ink on a light background, the same source
    /// image `.wordmark` already uses.
    case wordmarkOnDark
    /// Full lockup, gradient, opaque cream background. Only for contexts wide
    /// enough to show the mark + text + backdrop as a single unit.
    case wordmarkLockup
    /// Full lockup, monochrome ink. For dark surfaces or where the gradient
    /// would fight the surrounding colour.
    case wordmarkDark

    var resource: (name: String, ext: String) {
        switch self {
        case .mark: ("SpindareMarkTransparent", "png")
        case .markOpaque: ("SpindareMark", "webp")
        case .wordmark: ("SpindareWordmarkTransparent", "png")
        case .wordmarkOnDark: ("SpindareWordmarkOnDark", "png")
        case .wordmarkLockup: ("SpindareWordmark", "png")
        case .wordmarkDark: ("SpindareWordmarkDark", "webp")
        }
    }
}

public struct LogoImage: View {
    let logo: SpindareLogo

    public init(_ logo: SpindareLogo) {
        self.logo = logo
    }

    public var body: some View {
        if let image = Self.load(logo) {
            image
                .resizable()
                .scaledToFit()
        } else {
            // Visible rather than blank, so a missing asset is obvious in
            // review instead of reading as intentional whitespace.
            Image(systemName: "circle.dashed")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.secondary)
        }
    }

    static func load(_ logo: SpindareLogo) -> Image? {
        let (name, ext) = logo.resource
        guard let url = Bundle.module.url(forResource: name, withExtension: ext) else {
            return nil
        }
        #if canImport(UIKit)
        // WebP decodes through ImageIO on iOS 14+.
        guard let uiImage = UIImage(contentsOfFile: url.path) else { return nil }
        return Image(uiImage: uiImage)
        #elseif canImport(AppKit)
        guard let nsImage = NSImage(contentsOf: url) else { return nil }
        return Image(nsImage: nsImage)
        #else
        return nil
        #endif
    }
}

// MARK: - Blurred Artwork Background (Spindare v0.68 Aesthetic)

public struct ArtworkBackgroundView: View {
    @Environment(\.colorScheme) private var scheme
    let variant: Int
    let opacity: Double
    let blurRadius: CGFloat

    public init(variant: Int = 1, opacity: Double = 0.22, blurRadius: CGFloat = 70) {
        self.variant = variant
        self.opacity = opacity
        self.blurRadius = blurRadius
    }

    public var body: some View {
        GeometryReader { proxy in
            let name = variant == 1 ? "ArtworkBg1" : "ArtworkBg2"
            if let url = Bundle.module.url(forResource: name, withExtension: "png") {
                #if canImport(UIKit)
                if let uiImage = UIImage(contentsOfFile: url.path) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: proxy.size.width * 1.4, height: proxy.size.height * 1.4)
                        .blur(radius: blurRadius)
                        .opacity(scheme == .dark ? opacity * 0.75 : opacity)
                        .ignoresSafeArea()
                }
                #endif
            }
        }
        .allowsHitTesting(false)
    }
}

public extension View {
    /// Applies a heavily blurred artistic artwork background for key screens (Onboarding, Profile, SpinWheel, Settings).
    func spindareBlurredArtworkBackground(variant: Int = 1, opacity: Double = 0.22, blurRadius: CGFloat = 70) -> some View {
        self.background {
            ArtworkBackgroundView(variant: variant, opacity: opacity, blurRadius: blurRadius)
        }
    }
}

