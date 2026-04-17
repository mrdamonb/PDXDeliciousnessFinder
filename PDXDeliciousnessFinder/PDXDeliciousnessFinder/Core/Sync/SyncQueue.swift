import Foundation
import OSLog
import SwiftData
import Supabase

private let syncLog = Logger(subsystem: "com.damonbrennen.PDXDeliciousnessFinder", category: "SyncQueue")

enum SyncExecutionError: LocalizedError {
    case missingLocalRecord(table: String, recordId: UUID)
    case unsupportedTable(String)

    var errorDescription: String? {
        switch self {
        case let .missingLocalRecord(table, id):
            "Sync upsert skipped: no local \(table) row for id \(id.uuidString) (queue would have dropped this silently before)."
        case let .unsupportedTable(table):
            "Sync upsert: unsupported table \(table)"
        }
    }
}

/// Manages outbound sync of local writes to Supabase.
///
/// Operations are persisted as `SyncOperation` SwiftData models so they survive
/// app restarts. When the network is available, the queue flushes in insertion
/// order. Failed operations retry with exponential backoff up to 3 attempts.
@MainActor
final class SyncQueue {
    static let maxRetries = 3

    private let modelContext: ModelContext
    private let networkMonitor: NetworkMonitor
    private var isFlushing = false

    /// Called when an operation permanently fails after all retries.
    /// Subscribers (e.g. ViewModels) can surface this via ViewState.error.
    var onPermanentFailure: ((SyncOperation, Error) -> Void)?

    init(modelContext: ModelContext, networkMonitor: NetworkMonitor) {
        self.modelContext = modelContext
        self.networkMonitor = networkMonitor

        networkMonitor.onConnectivityRestored = { [weak self] in
            Task { @MainActor in
                await self?.flush()
            }
        }
    }

    // MARK: - Enqueue

    /// Enqueues an upsert operation. At flush time the record is re-fetched from
    /// SwiftData so the latest local state is always what gets pushed.
    func enqueueUpsert(table: String, recordId: UUID) throws {
        let op = SyncOperation(
            table: table,
            action: .upsert,
            recordId: recordId
        )
        modelContext.insert(op)
        try modelContext.save()
        Task { await flush() }
    }

    /// Enqueues a delete operation.
    func enqueueDelete(table: String, recordId: UUID) throws {
        let op = SyncOperation(
            table: table,
            action: .delete,
            recordId: recordId
        )
        modelContext.insert(op)
        try modelContext.save()
        Task { await flush() }
    }

    // MARK: - Flush

    /// Processes all pending operations in insertion order.
    func flush() async {
        guard !isFlushing, networkMonitor.isConnected else { return }
        isFlushing = true
        defer { isFlushing = false }

        let operations: [SyncOperation]
        do {
            let descriptor = FetchDescriptor<SyncOperation>(
                sortBy: [SortDescriptor(\.createdAt, order: .forward)]
            )
            operations = try modelContext.fetch(descriptor)
        } catch {
            return
        }

        for op in operations {
            // Retry the same operation until success or permanent failure (do not advance
            // to the next queue item after a single failed attempt within this flush).
            while true {
                do {
                    try await execute(op)
                    modelContext.delete(op)
                    try modelContext.save()
                    break
                } catch {
                    op.retryCount += 1
                    syncLog.error(
                        "Sync \(op.action.rawValue) failed for \(op.table, privacy: .public) id=\(op.recordId.uuidString, privacy: .public) attempt \(op.retryCount)/\(Self.maxRetries): \(String(describing: error), privacy: .public)"
                    )
                    if op.retryCount >= Self.maxRetries {
                        syncLog.critical(
                            "Sync giving up on \(op.table, privacy: .public) id=\(op.recordId.uuidString, privacy: .public) — \(String(describing: error), privacy: .public)"
                        )
                        onPermanentFailure?(op, error)
                        modelContext.delete(op)
                        try? modelContext.save()
                        break
                    }
                    try? modelContext.save()
                    // Exponential backoff: 1s, 2s, 4s between attempts on the same op
                    let delay = UInt64(pow(2.0, Double(op.retryCount - 1))) * 1_000_000_000
                    try? await Task.sleep(nanoseconds: delay)
                }
            }
        }
    }

    /// Number of pending operations (useful for UI badges / debugging).
    var pendingCount: Int {
        let descriptor = FetchDescriptor<SyncOperation>()
        return (try? modelContext.fetchCount(descriptor)) ?? 0
    }

    /// Returns true if a pending write exists for the given record ID.
    /// Used by RealtimeSubscriptions to avoid overwriting optimistic local writes.
    func hasPendingOperation(for recordId: UUID) -> Bool {
        let descriptor = FetchDescriptor<SyncOperation>(
            predicate: #Predicate { $0.recordId == recordId }
        )
        return ((try? modelContext.fetchCount(descriptor)) ?? 0) > 0
    }

    // MARK: - Private

    private func execute(_ op: SyncOperation) async throws {
        switch op.action {
        case .upsert:
            try await executeUpsert(op)
        case .delete:
            try await supabase.database
                .from(op.table)
                .delete()
                .eq("id", value: op.recordId)
                .execute()
        }
    }

    /// Re-fetches the record from SwiftData and pushes the current state to Supabase.
    private func executeUpsert(_ op: SyncOperation) async throws {
        switch op.table {
        case SupabaseTables.restaurants:
            let id = op.recordId
            let descriptor = FetchDescriptor<Restaurant>(
                predicate: #Predicate { $0.id == id }
            )
            guard let record = try modelContext.fetch(descriptor).first else {
                throw SyncExecutionError.missingLocalRecord(table: op.table, recordId: id)
            }
            let dto = RestaurantDTO(from: record)
            try await supabase.database.from(op.table).upsert(dto, onConflict: "id").execute()

        case SupabaseTables.visitLogs:
            let id = op.recordId
            let descriptor = FetchDescriptor<VisitLog>(
                predicate: #Predicate { $0.id == id }
            )
            guard let record = try modelContext.fetch(descriptor).first else {
                throw SyncExecutionError.missingLocalRecord(table: op.table, recordId: id)
            }
            let dto = VisitLogDTO(from: record)
            try await supabase.database.from(op.table).upsert(dto, onConflict: "id").execute()

        default:
            throw SyncExecutionError.unsupportedTable(op.table)
        }
    }
}
