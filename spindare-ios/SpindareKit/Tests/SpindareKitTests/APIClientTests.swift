import Testing
import Foundation
@testable import SpindareKit

// Uses swift-testing rather than XCTest so the suite runs from the command line
// with only the Swift toolchain installed (XCTest.framework ships with Xcode).
// Xcode 16+ runs these natively too.
//
// Anything touching StubURLProtocol lives in a single `.serialized` suite —
// the stub hands responses back through process-global state, which races
// under swift-testing's default parallelism. Pure decoding tests need no such
// care and run concurrently.

// MARK: - Network stub

final class StubURLProtocol: URLProtocol {
    nonisolated(unsafe) static var respond: (@Sendable (URLRequest) -> (status: Int, body: Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let (status, body) = Self.respond?(request) ?? (200, Data())
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        if !body.isEmpty { client?.urlProtocol(self, didLoad: body) }
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private func makeClient() -> APIClient {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [StubURLProtocol.self]
    return APIClient(baseURL: "http://127.0.0.1:3100", session: URLSession(configuration: config))
}

private func stub(status: Int = 200, json: String) {
    StubURLProtocol.respond = { _ in (status, Data(json.utf8)) }
}

// MARK: - Network behaviour (traps 1 and 2, plus status mapping)
//
// Deliberately ONE suite rather than three. `.serialized` only orders tests
// within a single suite — sibling suites still run concurrently, and they would
// clobber each other's StubURLProtocol.respond assignment.

@Suite(.serialized)
struct NetworkTests {
    @Test("GET /posts/count returns a bare integer")
    func bareInteger() async throws {
        stub(json: "42")
        let count: Int = try await makeClient().get("/posts/count")
        #expect(count == 42)
    }

    @Test("POST /challenges/kept/toggle returns a bare boolean")
    func bareBoolean() async throws {
        stub(json: "true")
        let toggled: Bool = try await makeClient().post("/challenges/kept/toggle")
        #expect(toggled)
    }

    @Test("POST /social/follow/:id returns a bare string")
    func bareString() async throws {
        stub(json: "\"connected\"")
        let result: String = try await makeClient().post("/social/follow/abc")
        #expect(result == "connected")
    }

    @Test("GET /posts/:id/reaction returns bare null when unreacted")
    func bareNull() async throws {
        stub(json: "null")
        let reaction: ReactionType? = try await makeClient().get("/posts/p1/reaction")
        #expect(reaction == nil)
    }

    @Test("GET /posts/:id/reaction decodes a bare string into the enum")
    func bareStringIntoEnum() async throws {
        stub(json: "\"felt\"")
        let reaction: ReactionType? = try await makeClient().get("/posts/p1/reaction")
        #expect(reaction == .felt)
    }
    // MARK: Trap 2 — empty 200/201 bodies

    @Test("DELETE with an empty 200 body succeeds")
    func emptyBodyVoidCall() async throws {
        StubURLProtocol.respond = { _ in (200, Data()) }
        try await makeClient().delete("/social/follow/abc")
    }

    @Test("Empty 201 decodes as Empty")
    func emptyBodyAsEmpty() async throws {
        StubURLProtocol.respond = { _ in (201, Data()) }
        let value: Empty = try await makeClient().post("/challenges/kept/save")
        #expect(value == Empty())
    }

    @Test("Empty body fails loudly when a real value was expected")
    func emptyBodyWhenValueExpected() async throws {
        StubURLProtocol.respond = { _ in (200, Data()) }
        do {
            let _: Post = try await makeClient().get("/posts/p1")
            Issue.record("Expected a decoding error for an empty body")
        } catch let error as APIError {
            guard case .decoding = error else {
                Issue.record("Expected .decoding, got \(error)")
                return
            }
        }
    }
    // MARK: Status handling

    @Test("401 is surfaced distinctly so the app can bounce to sign-in")
    func unauthorized() async throws {
        StubURLProtocol.respond = { _ in (401, Data("Unauthorized".utf8)) }
        do {
            let _: Post = try await makeClient().get("/posts/p1")
            Issue.record("Expected unauthorized")
        } catch let error as APIError {
            #expect(error.isUnauthorized)
        }
    }

    @Test("Server errors carry status and body through")
    func serverError() async throws {
        StubURLProtocol.respond = { _ in (500, Data("boom".utf8)) }
        do {
            let _: Post = try await makeClient().get("/posts/p1")
            Issue.record("Expected an http error")
        } catch let error as APIError {
            #expect(error == .http(status: 500, body: "boom"))
        }
    }

    @Test("Bearer token is attached once set")
    func bearerToken() async throws {
        nonisolated(unsafe) var seen: String?
        StubURLProtocol.respond = { request in
            seen = request.value(forHTTPHeaderField: "Authorization")
            return (200, Data("1".utf8))
        }
        let client = makeClient()
        await client.setToken("test-jwt")
        let _: Int = try await client.get("/posts/count")
        #expect(seen == "Bearer test-jwt")
    }
}

// MARK: - Trap 3: ISO-8601 with fractional seconds

@Suite
struct DateDecodingTests {
    private struct Wrapper: Codable { let createdAt: Date }

    private func decodeDate(_ raw: String) throws -> Date {
        let json = Data("{\"createdAt\":\"\(raw)\"}".utf8)
        return try APIClient.decoder.decode(Wrapper.self, from: json).createdAt
    }

    @Test("Parses Prisma's TIMESTAMP(3) millisecond form")
    func fractionalSeconds() throws {
        // Exactly the format Foundation's default .iso8601 strategy rejects.
        let date = try decodeDate("2026-07-19T12:00:00.000Z")
        #expect(abs(date.timeIntervalSince1970 - 1_784_462_400) < 1)
    }

    @Test("Still parses when milliseconds are absent")
    func withoutFractionalSeconds() throws {
        let date = try decodeDate("2026-07-19T12:00:00Z")
        #expect(abs(date.timeIntervalSince1970 - 1_784_462_400) < 1)
    }

    @Test("Rejects unparseable dates rather than silently defaulting")
    func garbage() {
        #expect(throws: (any Error).self) { try decodeDate("not-a-date") }
    }
}

// MARK: - Model decoding

@Suite
struct ModelDecodingTests {
    @Test("Post decodes a full feed payload")
    func fullPost() throws {
        let json = Data("""
        {
          "id": "p1", "userId": "user_abc", "author": "elia.v",
          "avatar": "https://example.com/a.jpg", "challenge": "Silence Protocol",
          "content": "two hours", "media": "https://example.com/m.jpg",
          "spinCount": 1240, "reactions": {"felt": 24, "thought": 12, "intrigued": 5},
          "createdAt": "2026-07-19T12:00:00.000Z"
        }
        """.utf8)

        let post = try APIClient.decoder.decode(Post.self, from: json)
        #expect(post.id == "p1")
        #expect(post.reactions.total == 41)
        #expect(post.createdAt != nil)
        #expect(post.isVideo == false)
    }

    @Test("Post survives a partially-written reactions blob")
    func missingReactionCounters() throws {
        // `reactions` is an untyped JSON column with no shape constraint.
        let json = Data("""
        {"id":"p1","userId":"u1","author":"a","challenge":"c","reactions":{"felt":3}}
        """.utf8)

        let post = try APIClient.decoder.decode(Post.self, from: json)
        #expect(post.reactions.felt == 3)
        #expect(post.reactions.thought == 0)
        #expect(post.reactions.intrigued == 0)
    }

    @Test("Post detects video media by extension")
    func videoDetection() throws {
        let json = Data("""
        {"id":"p1","userId":"u1","author":"a","challenge":"c","media":"https://x.com/v.mp4","reactions":{}}
        """.utf8)
        #expect(try APIClient.decoder.decode(Post.self, from: json).isVideo)
    }

    @Test("Notification flattens the joined fromUser relation")
    func flattensSender() throws {
        let json = Data("""
        {
          "id": "n1", "type": "reaction", "fromUserId": "u2",
          "content": "felt your post", "targetId": "p1", "read": false,
          "createdAt": "2026-07-19T12:00:00.000Z",
          "fromUser": {"username": "lena.w", "photoURL": "https://example.com/l.jpg"}
        }
        """.utf8)

        let notification = try APIClient.decoder.decode(AppNotification.self, from: json)
        #expect(notification.fromUsername == "lena.w")
        #expect(notification.fromAvatar == "https://example.com/l.jpg")
        #expect(notification.type == .reaction)
    }

    @Test("An unrecognised notification type does not break the list")
    func unknownNotificationType() throws {
        let json = Data("""
        {"id":"n1","type":"brand_new_type","fromUserId":"u2","content":"x","read":true}
        """.utf8)
        #expect(try APIClient.decoder.decode(AppNotification.self, from: json).type == .unknown)
    }

    @Test("SearchUser prefers the uid alias over the row id")
    func searchUserPrefersUid() throws {
        // GET /search/users aliases id -> uid, unlike every profiles endpoint.
        let json = Data("""
        {"id":"row-pk","uid":"user_abc","username":"elia.v"}
        """.utf8)
        #expect(try APIClient.decoder.decode(SearchUser.self, from: json).id == "user_abc")
    }

    @Test("SearchUser falls back to id when uid is absent")
    func searchUserFallsBack() throws {
        let json = Data("{\"id\":\"user_abc\",\"username\":\"elia.v\"}".utf8)
        #expect(try APIClient.decoder.decode(SearchUser.self, from: json).id == "user_abc")
    }

    @Test("SearchUser round-trips through the hand-written encoder")
    func searchUserRoundTrips() throws {
        let original = SearchUser(id: "user_abc", username: "elia.v", photoURL: nil)
        let data = try JSONEncoder().encode(original)
        #expect(try APIClient.decoder.decode(SearchUser.self, from: data) == original)
    }

    @Test("Profile tolerates a minimal payload")
    func minimalProfile() throws {
        let json = Data("{\"id\":\"user_abc\",\"username\":\"you\"}".utf8)
        let profile = try APIClient.decoder.decode(Profile.self, from: json)
        #expect(profile.xp == 0)
        #expect(profile.level == 1)
        #expect(profile.hobbies.isEmpty)
    }

    @Test("Profile decodes a BigInt spin timestamp without overflow")
    func int64Timestamp() throws {
        let json = Data("""
        {"id":"u1","username":"you","lastSpinTimestamp":1784462400000}
        """.utf8)
        let profile = try APIClient.decoder.decode(Profile.self, from: json)
        #expect(profile.lastSpinTimestamp == 1_784_462_400_000)
    }
}
