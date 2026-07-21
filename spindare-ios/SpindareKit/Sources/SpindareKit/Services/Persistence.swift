import Foundation
import SwiftData

// On-device persistence for the mock backend.
//
// Every domain type here (`Post`, `Message`, `Conversation`, ...) is already
// `Codable` — that's what made these safe to send across `MockBackend`'s actor
// boundary in the first place. Rather than hand-writing a second, parallel
// `@Model` class per type (nine of them, each needing to be kept in exact sync
// with its struct as fields are added — a maintenance trap for a small team),
// this stores each record as its own row holding the struct's JSON encoding.
// SwiftData still gives real per-record storage backed by SQLite — inserting a
// message doesn't rewrite the whole database, deleting a conversation doesn't
// touch posts — it just skips hand-duplicating every struct's shape into a
// second, class-based schema.
//
// `MockBackend` still owns the "what happened" logic (accept this request,
// mark that notification read); this only owns "make it survive a relaunch."

@Model
final class PersistedRecord {
    /// `"<kind>:<id>"` — unique so an upsert is a fetch-by-key, not a scan.
    @Attribute(.unique) var key: String
    /// Discriminates what's in `payload` — "post", "message", "conversation",
    /// etc. — so a listing query doesn't have to decode every row in the store
    /// to find the ones it wants.
    var kind: String
    var payload: Data

    init(key: String, kind: String, payload: Data) {
        self.key = key
        self.kind = kind
        self.payload = payload
    }
}

/// Thin wrapper around a `ModelContainer` — the SwiftData specifics live here
/// so `MockBackend` reads as business logic (accept, decline, mute) rather than
/// as database plumbing.
///
/// `public` only because it appears in `MockBackend.init`'s public signature —
/// its actual read/write methods stay internal, so nothing outside this module
/// can reach into the store directly.
public struct PersistentStore {
    private let context: ModelContext

    /// `.iso8601` with fractional seconds on both sides: this only ever reads
    /// back what it itself wrote, so the two strategies just need to agree
    /// with each other, not with an external API's format.
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    /// `persistent: false` (the default) is a private, in-memory-only store —
    /// gone the moment its `MockBackend` is deallocated, and never written to
    /// disk at all. That's the right default for anything other than the
    /// app's one real backend: every `MockBackend()` constructed in a test is
    /// supposed to start from a clean, isolated seed, and sharing one on-disk
    /// file across them would mean one test's mutations leaking into the
    /// next's expectations — which is exactly what happened the first time
    /// this was wired to a real store unconditionally: `.shared` and every
    /// test's throwaway `MockBackend()` were quietly reading and writing the
    /// same file. `MockBackend.shared` is the only call site that asks for
    /// `persistent: true`.
    public init(persistent: Bool = false) {
        let schema = Schema([PersistedRecord.self])
        let container: ModelContainer
        do {
            container = try ModelContainer(
                for: schema,
                configurations: [ModelConfiguration(schema: schema, isStoredInMemoryOnly: !persistent)]
            )
        } catch {
            // A store that fails to open (corrupt file, disk full, a schema
            // migration gone wrong) shouldn't take the app down over
            // persistence — that's strictly worse than the in-memory-only
            // behaviour this replaces. Falls back to memory-only rather than
            // `try!`, so the app degrades to "changes don't survive relaunch"
            // instead of not launching at all.
            container = (try? ModelContainer(
                for: schema,
                configurations: [ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)]
            )) ?? {
                // Reaching this point means even an in-memory SQLite store
                // couldn't be created, which would indicate a broken SwiftData
                // runtime rather than a bad disk — nothing left to fall back
                // to.
                preconditionFailure("SwiftData could not create even an in-memory store")
            }()
        }
        context = ModelContext(container)
    }

    /// Whether anything has ever been persisted. Used once, at launch, to
    /// decide between "load what's here" and "this is a first run, seed it."
    var hasAnyRecords: Bool {
        (try? context.fetchCount(FetchDescriptor<PersistedRecord>())) ?? 0 > 0
    }

    func upsert(_ value: some Encodable, kind: String, id: String) {
        guard let data = try? Self.encoder.encode(value) else { return }
        let compositeKey = "\(kind):\(id)"

        let descriptor = FetchDescriptor<PersistedRecord>(
            predicate: #Predicate { $0.key == compositeKey }
        )
        if let existing = try? context.fetch(descriptor).first {
            existing.payload = data
        } else {
            context.insert(PersistedRecord(key: compositeKey, kind: kind, payload: data))
        }
        try? context.save()
    }

    func delete(kind: String, id: String) {
        let compositeKey = "\(kind):\(id)"
        let descriptor = FetchDescriptor<PersistedRecord>(
            predicate: #Predicate { $0.key == compositeKey }
        )
        guard let existing = try? context.fetch(descriptor).first else { return }
        context.delete(existing)
        try? context.save()
    }

    /// Every row of `kind`, silently dropping any that fail to decode — a
    /// struct gaining a new non-optional field would otherwise turn one bad
    /// row into a launch-time crash for something that only holds mock data.
    func all<T: Decodable>(kind: String, as type: T.Type) -> [T] {
        let descriptor = FetchDescriptor<PersistedRecord>(
            predicate: #Predicate { $0.kind == kind }
        )
        guard let rows = try? context.fetch(descriptor) else { return [] }
        return rows.compactMap { try? Self.decoder.decode(T.self, from: $0.payload) }
    }

    func one<T: Decodable>(kind: String, id: String, as type: T.Type) -> T? {
        let compositeKey = "\(kind):\(id)"
        let descriptor = FetchDescriptor<PersistedRecord>(
            predicate: #Predicate { $0.key == compositeKey }
        )
        guard let row = try? context.fetch(descriptor).first else { return nil }
        return try? Self.decoder.decode(T.self, from: row.payload)
    }
}
