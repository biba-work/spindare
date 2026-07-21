import Foundation
import CoreGraphics

#if canImport(UIKit)
import UIKit
#endif

// Proof photos are captured at whatever the camera produces — a 12MP HEIC off a
// modern iPhone is routinely 3–5MB, and it's being displayed in a 320pt card.
// Uploading that whole thing wastes the user's data on pixels no one will see.
//
// The sizing rule lives here as a pure function so the interesting part — that
// aspect ratio survives, and that already-small images are left alone rather
// than being re-encoded (which only ever loses quality) — is testable without a
// camera, a picker, or a running app.

public enum ImageCompression {
    /// Longest edge of a stored proof photo. 1200px covers a full-width image
    /// on the densest phone screen this app targets with room to spare; past
    /// that the file grows and nothing on screen changes.
    public static let maxDimension: CGFloat = 1200

    /// 0.7 is the usual knee of the JPEG curve — most of the file-size win, and
    /// artifacts stay out of flat areas like skin and sky, which is where they
    /// would be noticed.
    public static let quality: CGFloat = 0.7

    /// Target size for `original`, preserving aspect ratio. Returns the input
    /// unchanged when it already fits, so a small image is never *up*scaled
    /// into a bigger file than it started as.
    public static func fittedSize(for original: CGSize, maxDimension: CGFloat = maxDimension) -> CGSize {
        guard original.width > 0, original.height > 0, maxDimension > 0 else { return original }

        let longest = max(original.width, original.height)
        guard longest > maxDimension else { return original }

        let ratio = maxDimension / longest
        // Rounded, not truncated: a 1199.6pt edge floors to 1199 and shifts the
        // aspect ratio by a hair, which shows as a one-pixel letterbox seam.
        return CGSize(
            width: (original.width * ratio).rounded(),
            height: (original.height * ratio).rounded()
        )
    }
}

#if canImport(UIKit)
public extension ImageCompression {
    /// Downscales and re-encodes as JPEG. Nil if the data isn't a decodable
    /// image — callers keep the original in that case rather than dropping the
    /// user's photo on the floor.
    static func compress(
        _ data: Data,
        maxDimension: CGFloat = maxDimension,
        quality: CGFloat = quality
    ) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        return compress(image, maxDimension: maxDimension, quality: quality)
    }

    static func compress(
        _ image: UIImage,
        maxDimension: CGFloat = maxDimension,
        quality: CGFloat = quality
    ) -> Data? {
        let target = fittedSize(for: image.size, maxDimension: maxDimension)

        guard target != image.size else {
            return image.jpegData(compressionQuality: quality)
        }

        // `scale: 1` is load-bearing. The default uses the screen's scale, so
        // on a 3× device a 1200pt target renders a 3600px image — three times
        // the dimension we just decided on and roughly nine times the pixels.
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true

        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }

        return resized.jpegData(compressionQuality: quality)
    }
}
#endif
