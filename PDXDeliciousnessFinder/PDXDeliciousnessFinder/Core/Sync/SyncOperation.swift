import Foundation
import SwiftData

/// The type of remote mutation to perform.
enum SyncAction: String, Codable {
    case upsert
    case delete
}

/// A queued remote write that survives app restarts.
/// Stored in SwiftData alongside app models so pending operations
/// are never lost.
@Model
final class SyncOperation {
    var id: UUID
    /// Target Supabase table name (use SupabaseTables constants).
    var table: String
    /// The mutation type.
    var action: SyncAction
    /// JSON-encoded DTO payload (nil for deletes — recordId is sufficient).
    var payload: Data?
    /// The remote record ID (used for deletes and upsert conflict key).
    var recordId: UUID
    /// Number of failed attempts so far.
    var retryCount: Int
    /// When the operation was enqueued (flush order).
    var createdAt: Date

    init(
        id: UUID = UUID(),
        table: String,
        action: SyncAction,
        payload: Data? = nil,
        recordId: UUID,
        retryCount: Int = 0,
        createdAt: Date = .now
    ) {
        self.id = id
        self.table = table
        self.action = action
        self.payload = payload
        self.recordId = recordId
        self.retryCount = retryCount
        self.createdAt = createdAt
    }
}
