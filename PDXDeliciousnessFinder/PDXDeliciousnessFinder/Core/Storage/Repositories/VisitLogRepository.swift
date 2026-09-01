import Foundation
import SwiftData
import Supabase

/// Mediates VisitLog persistence between SwiftData (local) and Supabase (remote).
/// ViewModels call these methods — never `supabase.from()` directly.
/// Write operations save locally first, then enqueue a SyncQueue operation.
@MainActor
final class VisitLogRepository: VisitLogRepositoryProtocol {
    private let modelContext: ModelContext
    private let syncQueue: SyncQueue

    init(modelContext: ModelContext, syncQueue: SyncQueue) {
        self.modelContext = modelContext
        self.syncQueue = syncQueue
    }

    // MARK: - Local reads

    func fetchAll(for restaurantId: UUID) throws -> [VisitLog] {
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.restaurantId == restaurantId },
            sortBy: [SortDescriptor(\.visitedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    func fetchAllVisits() throws -> [VisitLog] {
        let descriptor = FetchDescriptor<VisitLog>(
            sortBy: [SortDescriptor(\.visitedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    func fetch(id: UUID) throws -> VisitLog? {
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.id == id }
        )
        return try modelContext.fetch(descriptor).first
    }

    // MARK: - Writes (local + enqueue remote sync)

    @discardableResult
    func save(_ visitLog: VisitLog) throws -> VisitLog {
        modelContext.insert(visitLog)
        try modelContext.save()
        try syncQueue.enqueueUpsert(
            table: SupabaseTables.visitLogs,
            recordId: visitLog.id
        )
        return visitLog
    }

    func delete(_ visitLog: VisitLog) throws {
        let id = visitLog.id
        modelContext.delete(visitLog)
        try modelContext.save()
        try syncQueue.enqueueDelete(
            table: SupabaseTables.visitLogs,
            recordId: id
        )
    }

    // MARK: - Remote pull (called by sync layer, not ViewModels)

    func pullFromRemote(restaurantId: UUID) async throws {
        let dtos: [VisitLogDTO] = try await supabase.database
            .from(SupabaseTables.visitLogs)
            .select()
            .eq("restaurant_id", value: restaurantId)
            .execute()
            .value

        for dto in dtos {
            if (try fetch(id: dto.id)) == nil {
                modelContext.insert(dto.toModel())
            }
        }
        try modelContext.save()
    }
}
