import Foundation

// Swift port of the RN client's src/services/ApiService.ts.
//
// Three properties of the Nest API drove the shape of this file, all of them
// easy to get wrong and all covered by tests:
//
//  1. Some endpoints return bare JSON fragments rather than objects —
//     GET /posts/count and /notifications/unread-count return a bare integer,
//     POST /challenges/kept/toggle a bare boolean, POST /social/follow/:id a
//     bare string, GET /posts/:id/reaction a bare string or literal null.
//  2. Some endpoints return 200/201 with a completely empty body
//     (DELETE /social/follow/:id, POST /challenges/kept/save, request
//     accept/decline, ghost/unghost).
//  3. Timestamps are Prisma DateTime -> TIMESTAMP(3) -> ISO-8601 *with*
//     fractional seconds, which Foundation's default .iso8601 strategy
//     refuses to parse.

public enum APIError: Error, Sendable, Equatable {
    case invalidURL(String)
    case unauthorized
    case http(status: Int, body: String)
    case decoding(String)
    case transport(String)

    public var isUnauthorized: Bool {
        if case .unauthorized = self { return true }
        return false
    }
}

/// Placeholder for endpoints that answer with no body at all.
public struct Empty: Codable, Sendable, Equatable {
    public init() {}
    public init(from decoder: any Decoder) throws {}
    public func encode(to encoder: any Encoder) throws {}
}

public actor APIClient {
    private let baseURL: String
    private let session: URLSession
    private var token: String?
    private var tokenProvider: (@Sendable () async -> String?)?

    public init(baseURL: String, session: URLSession = .shared) {
        // Trailing slash would produce `//posts` when joined with a leading-slash path.
        self.baseURL = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        self.session = session
    }

    /// A static bearer token. Superseded by `setTokenProvider` when one is set;
    /// kept for callers (and tests) that just want to pin a fixed token.
    public func setToken(_ token: String?) {
        self.token = token
    }

    /// The Authorization header, resolved fresh on every request.
    ///
    /// Clerk session tokens are short-lived JWTs (~60s), so a token captured
    /// once at sign-in goes stale within a minute and every later request 401s.
    /// The composition root sets this to `{ try? await Clerk.shared.session?.getToken()?.jwt }`,
    /// keeping APIClient itself free of any Clerk dependency — it just calls the
    /// closure. The backend verifies Clerk's standard session token directly
    /// against its JWKS, so no Clerk JWT "template" is involved.
    public func setTokenProvider(_ provider: @escaping @Sendable () async -> String?) {
        self.tokenProvider = provider
    }

    // MARK: - Verbs

    public func get<T: Decodable & Sendable>(_ path: String) async throws -> T {
        try decode(await send("GET", path, bodyData: nil))
    }

    public func post<T: Decodable & Sendable>(_ path: String, body: some Encodable) async throws -> T {
        try decode(await send("POST", path, bodyData: try encode(body)))
    }

    public func post<T: Decodable & Sendable>(_ path: String) async throws -> T {
        try decode(await send("POST", path, bodyData: nil))
    }

    public func post(_ path: String, body: some Encodable) async throws {
        _ = try await send("POST", path, bodyData: try encode(body))
    }

    public func post(_ path: String) async throws {
        _ = try await send("POST", path, bodyData: nil)
    }

    public func patch(_ path: String, body: some Encodable) async throws {
        _ = try await send("PATCH", path, bodyData: try encode(body))
    }

    public func patch(_ path: String) async throws {
        _ = try await send("PATCH", path, bodyData: nil)
    }

    public func delete(_ path: String) async throws {
        _ = try await send("DELETE", path, bodyData: nil)
    }

    // MARK: - Transport

    private func send(_ method: String, _ path: String, bodyData: Data?) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL(baseURL + path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // A live provider wins over any pinned token, so the header always
        // carries a freshly-minted Clerk JWT rather than a stale one.
        let bearer = tokenProvider != nil ? await tokenProvider?() : token
        if let bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = bodyData

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport("Non-HTTP response from \(url)")
        }

        // Surfaced separately so the app can drop to the sign-in screen rather
        // than showing a generic failure.
        if http.statusCode == 401 { throw APIError.unauthorized }

        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(
                status: http.statusCode,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }

        return data
    }

    // MARK: - Coding

    private func encode(_ value: some Encodable) throws -> Data {
        do {
            return try JSONEncoder().encode(value)
        } catch {
            throw APIError.decoding("Failed encoding request body: \(error)")
        }
    }

    private func decode<T: Decodable & Sendable>(_ data: Data) throws -> T {
        // Trap 2: empty 200/201. Only legal when the caller asked for `Empty`.
        if data.isEmpty {
            if let empty = Empty() as? T { return empty }
            throw APIError.decoding("Empty response body where \(T.self) was expected")
        }

        do {
            // Trap 1: bare fragments. JSONDecoder handles top-level scalars on
            // current Foundation, so no special-casing is needed here — but the
            // tests pin the behaviour so a future toolchain change can't
            // silently regress it.
            return try Self.decoder.decode(T.self, from: data)
        } catch {
            let preview = String(data: data.prefix(200), encoding: .utf8) ?? "<binary>"
            throw APIError.decoding("Failed decoding \(T.self): \(error) — body: \(preview)")
        }
    }

    /// Shared decoder. `Date.ISO8601FormatStyle` is a Sendable value type, so
    /// unlike `ISO8601DateFormatter` these parsers are safe to hold in a `static let`.
    public static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        let withFractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
        let withoutFractional = Date.ISO8601FormatStyle()

        // Trap 3: Prisma emits `2026-07-19T12:00:00.000Z`. Try fractional first,
        // then fall back — the API is not consistent about emitting millis.
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            if let date = try? withFractional.parse(raw) { return date }
            if let date = try? withoutFractional.parse(raw) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unparseable ISO-8601 date: \(raw)"
            )
        }
        return decoder
    }()
}
