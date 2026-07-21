#if os(iOS)
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import AVFoundation

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
    var supportsVideo: Bool = true
    let onCapture: (Data?, URL?) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        if UIImagePickerController.isSourceTypeAvailable(.camera) && AVCaptureMultiCamSession.isMultiCamSupported {
            let vc = SpindareMultiCamViewController()
            vc.supportsVideo = supportsVideo
            vc.onCapture = onCapture
            return vc
        }

        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.mediaTypes = supportsVideo
            ? [UTType.image.identifier, UTType.movie.identifier]
            : [UTType.image.identifier]
        picker.videoQuality = .typeMedium
        picker.videoMaximumDuration = 60
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {}

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
                onCapture(ImageCompression.compress(image), nil)
                return
            }

            if let capturedVideo = info[.mediaURL] as? URL {
                let stable = FileManager.default.temporaryDirectory
                    .appendingPathComponent("proof-\(UUID().uuidString).mov")
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

// MARK: - Native AVCaptureMultiCamSession Dual-Camera Controller

public class SpindareMultiCamViewController: UIViewController, AVCapturePhotoCaptureDelegate {
    public var onCapture: ((Data?, URL?) -> Void)?
    public var supportsVideo: Bool = true

    private var session: AVCaptureSession?
    private var photoOutput = AVCapturePhotoOutput()

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupMultiCamSession()
        setupUI()
    }

    private func setupMultiCamSession() {
        if #available(iOS 13.0, *), AVCaptureMultiCamSession.isMultiCamSupported {
            let multiSession = AVCaptureMultiCamSession()
            session = multiSession

            guard let backDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let frontDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
                  let backInput = try? AVCaptureDeviceInput(device: backDevice),
                  let frontInput = try? AVCaptureDeviceInput(device: frontDevice) else {
                setupSingleCamSession()
                return
            }

            multiSession.beginConfiguration()
            if multiSession.canAddInput(backInput) { multiSession.addInput(backInput) }
            if multiSession.canAddInput(frontInput) { multiSession.addInput(frontInput) }

            if multiSession.canAddOutput(photoOutput) { multiSession.addOutput(photoOutput) }
            multiSession.commitConfiguration()

            let backLayer = AVCaptureVideoPreviewLayer(session: multiSession)
            backLayer.videoGravity = .resizeAspectFill
            backLayer.frame = view.bounds
            view.layer.addSublayer(backLayer)

            let frontLayer = AVCaptureVideoPreviewLayer(session: multiSession)
            frontLayer.videoGravity = .resizeAspectFill
            frontLayer.frame = CGRect(x: view.bounds.width - 130, y: 60, width: 110, height: 150)
            frontLayer.cornerRadius = 16
            frontLayer.masksToBounds = true
            frontLayer.borderColor = UIColor.white.cgColor
            frontLayer.borderWidth = 2
            view.layer.addSublayer(frontLayer)

            DispatchQueue.global(qos: .userInitiated).async { multiSession.startRunning() }
        } else {
            setupSingleCamSession()
        }
    }

    private func setupSingleCamSession() {
        let singleSession = AVCaptureSession()
        session = singleSession
        guard let backDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let backInput = try? AVCaptureDeviceInput(device: backDevice) else { return }

        singleSession.beginConfiguration()
        if singleSession.canAddInput(backInput) { singleSession.addInput(backInput) }
        if singleSession.canAddOutput(photoOutput) { singleSession.addOutput(photoOutput) }
        singleSession.commitConfiguration()

        let backLayer = AVCaptureVideoPreviewLayer(session: singleSession)
        backLayer.videoGravity = .resizeAspectFill
        backLayer.frame = view.bounds
        view.layer.addSublayer(backLayer)

        DispatchQueue.global(qos: .userInitiated).async { singleSession.startRunning() }
    }

    private func setupUI() {
        let shutter = UIButton(type: .custom)
        shutter.frame = CGRect(x: (view.bounds.width - 74) / 2, y: view.bounds.height - 110, width: 74, height: 74)
        shutter.layer.cornerRadius = 37
        shutter.layer.borderColor = UIColor.white.cgColor
        shutter.layer.borderWidth = 4
        shutter.backgroundColor = UIColor.white.withAlphaComponent(0.3)
        shutter.addTarget(self, action: #selector(takePhoto), for: .touchUpInside)
        view.addSubview(shutter)

        let close = UIButton(type: .system)
        close.frame = CGRect(x: 20, y: 50, width: 40, height: 40)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .white
        close.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        view.addSubview(close)
    }

    @objc private func takePhoto() {
        let settings = AVCapturePhotoSettings()
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    @objc private func cancel() {
        onCapture?(nil, nil)
        dismiss(animated: true)
    }

    public nonisolated func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        let capturedData = photo.fileDataRepresentation()
        Task { @MainActor in
            if let capturedData {
                self.onCapture?(capturedData, nil)
            } else {
                self.onCapture?(nil, nil)
            }
            self.dismiss(animated: true)
        }
    }
}
#endif
