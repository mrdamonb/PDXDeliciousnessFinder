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

    /// Updates an existing visit locally and enqueues a remote upsert.
    /// Preserves `id` and `createdAt` — an edit is a mutation, never a new row.
    func update(_ visitLog: VisitLog) throws {
        visitLog.updatedAt = .now
        try modelContext.save()
        try syncQueue.enqueueUpsert(
            table: SupabaseTables.visitLogs,
            recordId: visitLog.id
        )
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

    /// Fetches all visit logs for a user from Supabase, merges into SwiftData,
    /// and hydrates the `restaurant` relationship — `toModel()` cannot do this
    /// itself since it has no `modelContext` to look the restaurant up.
    func pullFromRemote(userId: UUID) async throws {
        let dtos: [VisitLogDTO] = try await supabase.database
            .from(SupabaseTables.visitLogs)
            .select()
            .eq("user_id", value: userId)
            .execute()
            .value

        // One fetch for every restaurant, rather than one per inserted visit.
        let restaurantsById = try restaurantLookup()

        for dto in dtos {
            if let existing = try fetch(id: dto.id) {
                if dto.updatedAt > existing.updatedAt {
                    applyDTO(dto, to: existing)
                }
            } else {
                let visitLog = dto.toModel()
                visitLog.restaurant = restaurantsById[visitLog.restaurantId]
                modelContext.insert(visitLog)
            }
        }

        // Save the pull *before* attempting repairs. If the repair pass throws,
        // it must not discard the visits just inserted — that failure mode looks
        // exactly like the bug this story fixes, and is invisible from the UI.
        try modelContext.save()

        // A local visit no longer present in the remote result set was deleted
        // elsewhere. The realtime delete handler catches this live, but a
        // device that wasn't connected at the moment of the delete never sees
        // that event and otherwise holds the row forever — this pass is what
        // a cold-start/foreground pull needs to catch up on a missed delete.
        try reconcileDeletedVisits(userId: userId, remoteIds: Set(dtos.map(\.id)))
        try modelContext.save()

        // A visit inserted (here or via realtime) before its restaurant arrived
        // is left with a nil relationship; repair any that are now resolvable.
        try rehydrateDanglingVisits(userId: userId, using: restaurantsById)
        try modelContext.save()
    }

    // MARK: - Private

    /// Applies only the fields a user can actually edit. `restaurantId`,
    /// `userId`, and `createdAt` are never overwritten — an edit never
    /// changes which restaurant a visit belongs to.
    private func applyDTO(_ dto: VisitLogDTO, to model: VisitLog) {
        model.visitedAt = dto.visitedAt
        model.note = dto.note
        model.updatedAt = dto.updatedAt
    }

    private func restaurantLookup() throws -> [UUID: Restaurant] {
        let restaurants = try modelContext.fetch(FetchDescriptor<Restaurant>())
        return Dictionary(restaurants.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    /// Deletes local visits for this user that the remote pull no longer
    /// returned. `hasPendingOperation` guards a visit whose own insert or
    /// delete hasn't flushed yet — the same guard the realtime delete handler
    /// uses (`RealtimeSubscriptions.handleVisitLogDelete`) — so an unsynced
    /// local write is never mistaken for a remote deletion.
    private func reconcileDeletedVisits(userId: UUID, remoteIds: Set<UUID>) throws {
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.userId == userId }
        )
        for visitLog in try modelContext.fetch(descriptor) where !remoteIds.contains(visitLog.id) {
            guard !syncQueue.hasPendingOperation(for: visitLog.id) else { continue }
            modelContext.delete(visitLog)
        }
    }

    private func rehydrateDanglingVisits(
        userId: UUID,
        using restaurantsById: [UUID: Restaurant]
    ) throws {
        // Scoped to this user, matching the pull. Filtering for a nil relationship
        // happens in memory on purpose: `#Predicate { $0.restaurant == nil }` is a
        // nil comparison against a to-one SwiftData relationship, which compiles
        // cleanly but is a fragile corner at fetch time — and this is precisely
        // the pass whose failure would be least visible.
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.userId == userId }
        )
        for visitLog in try modelContext.fetch(descriptor) where visitLog.restaurant == nil {
            visitLog.restaurant = restaurantsById[visitLog.restaurantId]
        }
    }
}
