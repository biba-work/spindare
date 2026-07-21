import Foundation

/// Uploads post/profile media to R2.
///
/// Everything goes the same way now: `POST /storage/presign` for a short-lived
/// signed URL, then the raw bytes are PUT **straight to R2**, never through
/// Nest.
///
/// It used to base64 images into a JSON body to `POST /storage/upload`, and
/// that silently never worked: Express caps JSON bodies at 100 KB by default,
/// base64 inflates bytes by a third, and a compressed photo is comfortably
/// past that — so every image upload came back 413 and the caller's `try?`
/// swallowed it. That's why no profile picture or post image ever reached R2
/// while plain-JSON writes like reactions were saving fine. Presigning has no
/// such ceiling and takes the server out of the data path entirely.
///
/// `/storage/presign` is Clerk-guarded, so this is constructed with the same
/// authed `APIClient` the live services use.
public struct MediaUploader: Sendable {
    private let api: APIClient
    private let session: URLSession

    public init(api: APIClient, session: URLSession = .shared) {
        self.api = api
        self.session = session
    }

    public enum UploadError: Error, Sendable {
        case badPresignedURL
        case put(status: Int)
    }

    /// Uploads in-memory bytes (a compressed photo) and returns the public R2 URL.
    public func uploadData(_ data: Data, contentType: String, folder: String) async throws -> String {
        try await presignAndPut(
            data,
            contentType: contentType,
            folder: folder,
            filename: "\(UUID().uuidString)\(Self.fileExtension(for: contentType))"
        )
    }

    /// Uploads a file on disk (a recorded video or voice note) and returns the
    /// public R2 URL.
    public func uploadFile(at fileURL: URL, contentType: String, folder: String) async throws -> String {
        let ext = fileURL.pathExtension.isEmpty
            ? Self.fileExtension(for: contentType)
            : ".\(fileURL.pathExtension)"
        // Read via a coordinated handle rather than holding the whole file in
        // memory twice — `Data(contentsOf:)` is memory-mapped where it can be.
        let fileData = try Data(contentsOf: fileURL, options: .mappedIfSafe)
        return try await presignAndPut(
            fileData,
            contentType: contentType,
            folder: folder,
            filename: "\(UUID().uuidString)\(ext)"
        )
    }

    /// Asks the server to sign a short-lived PUT URL, then sends the bytes
    /// straight to R2.
    ///
    /// The presigned URL signs `Content-Type`, so the PUT must send the exact
    /// same value or R2 rejects it with a signature mismatch — that's why one
    /// `contentType` is used for both the presign request and the PUT.
    private func presignAndPut(
        _ data: Data,
        contentType: String,
        folder: String,
        filename: String
    ) async throws -> String {
        struct Body: Encodable {
            let filename: String
            let contentType: String
            let folder: String
        }
        struct Response: Decodable {
            let uploadUrl: String
            let publicUrl: String
        }

        let response: Response = try await api.post(
            "/storage/presign",
            body: Body(filename: filename, contentType: contentType, folder: folder)
        )

        guard let putURL = URL(string: response.uploadUrl) else {
            throw UploadError.badPresignedURL
        }

        var request = URLRequest(url: putURL)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")

        let (_, urlResponse) = try await session.upload(for: request, from: data)

        if let http = urlResponse as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw UploadError.put(status: http.statusCode)
        }
        return response.publicUrl
    }

    /// R2 keys keep a sensible extension so the public URL is directly usable
    /// (and `Post.isVideo` can tell media apart by path extension).
    private static func fileExtension(for contentType: String) -> String {
        switch contentType.lowercased() {
        case "image/jpeg", "image/jpg": ".jpg"
        case "image/png": ".png"
        case "image/heic": ".heic"
        case "video/mp4": ".mp4"
        case "video/quicktime": ".mov"
        case "audio/m4a", "audio/mp4", "audio/x-m4a": ".m4a"
        default: ""
        }
    }
}
