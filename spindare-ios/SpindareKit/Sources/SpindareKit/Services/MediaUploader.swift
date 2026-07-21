import Foundation

/// Uploads post/profile media to R2 through the Nest storage endpoints.
///
/// Two paths, matching `server/src/storage/storage.controller.ts`:
///  - `uploadData` → `POST /storage/upload`: base64 goes through the server,
///    which `PutObject`s it to R2. Fine for images (tens of KB after
///    compression); a whole video base64'd through the server is not.
///  - `uploadFile` → `POST /storage/presign`: the server signs a short-lived
///    PUT URL and the file bytes go **straight to R2**, never through Nest.
///    This is the no-OOM path for video.
///
/// Both endpoints are Clerk-guarded, so this is constructed with the same
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

    /// Base64-through-the-server upload. Returns the public R2 URL.
    public func uploadData(_ data: Data, contentType: String, folder: String) async throws -> String {
        struct Body: Encodable {
            let base64: String
            let contentType: String
            let folder: String
        }
        struct Response: Decodable { let url: String }

        let response: Response = try await api.post(
            "/storage/upload",
            body: Body(base64: data.base64EncodedString(), contentType: contentType, folder: folder)
        )
        return response.url
    }

    /// Presign + direct PUT to R2. Returns the public R2 URL.
    ///
    /// The presigned URL signs `Content-Type`, so the PUT must send the exact
    /// same value or R2 rejects it with a signature mismatch — that's why the
    /// one `contentType` is used for both the presign request and the PUT.
    public func uploadFile(at fileURL: URL, contentType: String, folder: String) async throws -> String {
        let ext = fileURL.pathExtension.isEmpty ? "" : ".\(fileURL.pathExtension)"
        let filename = "\(UUID().uuidString)\(ext)"

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

        let fileData = try Data(contentsOf: fileURL)
        let (_, urlResponse) = try await session.upload(for: request, from: fileData)

        if let http = urlResponse as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw UploadError.put(status: http.statusCode)
        }
        return response.publicUrl
    }
}
