#if os(iOS)
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// The system camera, wrapped for SwiftUI — photo *and* video.
///
/// `UIImagePickerController` rather than a hand-built `AVCaptureSession`: this
/// app wants the standard shutter with flash, focus, front/back switching,
/// and permission handling already solved, not a custom capture stack that
/// arrives back at the same behaviour after several hundred lines.
///
/// Setting both `mediaTypes` below is what gives you the system's own
/// photo/video switcher at the bottom of the capture screen — the same one
/// the stock Camera app has — rather than needing to build a custom mode
/// toggle to reproduce it.
///
/// Hands back exactly one of: compressed JPEG data, or a video file URL
/// already copied to a stable location (the picker's own file lives in a
/// temporary spot that isn't guaranteed to survive past this screen
/// dismissing). Both nil means the user cancelled.
struct CameraCapture: UIViewControllerRepresentable {
    /// Chat's in-line camera also uses this component but only ever asked for
    /// photos — video-in-chat is a separate feature nobody's requested yet,
    /// so it stays off there rather than silently gaining a capability no one
    /// asked for. The composer (challenge proof) is the one place this is
    /// true.
    ///
    /// Declared before `onCapture` so call sites can still use trailing
    /// closure syntax while overriding this — a trailing closure has to be
    /// the last parameter.
    var supportsVideo: Bool = true
    let onCapture: (Data?, URL?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        // Falls back to the library on a device with no camera, which is every
        // simulator — without this the picker presents an empty black sheet
        // with no way out.
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.mediaTypes = supportsVideo
            ? [UTType.image.identifier, UTType.movie.identifier]
            : [UTType.image.identifier]
        picker.videoQuality = .typeMedium
        // A Speedy is short-form by definition — capping capture length here
        // means there's no separate "this clip is too long" rejection later.
        picker.videoMaximumDuration = 60
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let onCapture: (Data?, URL?) -> Void

        init(onCapture: @escaping (Data?, URL?) -> Void) {
            self.onCapture = onCapture
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = (info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage) {
                // Compressed here rather than by the caller so a raw camera
                // frame never exists as `Data` anywhere else in the app.
                onCapture(ImageCompression.compress(image), nil)
                return
            }

            if let capturedVideo = info[.mediaURL] as? URL {
                let stable = FileManager.default.temporaryDirectory
                    .appendingPathComponent("proof-\(UUID().uuidString).mov")
                // The picker's own file can be cleaned up once this screen
                // dismisses — copying it out is what makes the capture
                // outlive that.
                try? FileManager.default.copyItem(at: capturedVideo, to: stable)
                onCapture(nil, stable)
                return
            }

            onCapture(nil, nil)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCapture(nil, nil)
        }
    }
}
#endif
