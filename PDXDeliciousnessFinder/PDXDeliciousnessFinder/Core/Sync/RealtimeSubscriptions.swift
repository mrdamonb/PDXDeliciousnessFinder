import Foundation
import OSLog
import SwiftData
import Supabase

private let realtimeLog = Logger(subsystem: "com.damonbrennen.PDXDeliciousnessFinder", category: "RealtimeSubscriptions")

/// Manages Supabase Realtime channel subscriptions for inbound sync.
///
/// Subscribes to postgres changes on `restaurants` and `visit_logs` filtered
/// by the current user's ID. Incoming changes are merged into the local
/// SwiftData store. Locally queued writes (pending SyncOperations) take
/// precedence over inbound remote updates to avoid overwriting optimistic writes.
@MainActor
final class RealtimeSubscriptions {
    private let modelContext: ModelContext
    private let syncQueue: SyncQueue
    private var task: Task<Void, Never>?

    init(modelContext: ModelContext, syncQueue: SyncQueue) {
        self.modelContext = modelContext
        self.syncQueue = syncQueue
    }

    // MARK: - Lifecycle

    func start(userId: UUID) {
        task?.cancel()
        task = Task { [weak self] in
            await self?.subscribe(userId: userId)
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    // MARK: - Channel subscription

    private func subscribe(userId: UUID) async {
        let userFilter = "user_id=eq.\(userId.uuidString.lowercased())"

        let restaurantChannel = await supabase.realtimeV2.channel("restaurants:\(userId.uuidString)")
        let restaurantChanges = await restaurantChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: SupabaseTables.restaurants,
            filter: userFilter
        )

        let visitLogChannel = await supabase.realtimeV2.channel("visit_logs:\(userId.uuidString)")
        let visitLogChanges = await visitLogChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: SupabaseTables.visitLogs,
            filter: userFilter
        )

        await restaurantChannel.subscribe()
        await visitLogChannel.subscribe()

        await withTaskGroup(of: Void.self) { group in
            group.addTask { [weak self] in
                for await change in restaurantChanges {
                    guard !Task.isCancelled else { break }
                    await self?.handleRestaurantChange(change)
                }
            }
            group.addTask { [weak self] in
                for await change in visitLogChanges {
                    guard !Task.isCancelled else { break }
                    await self?.handleVisitLogChange(change)
                }
            }
        }

        await restaurantChannel.unsubscribe()
        await visitLogChannel.unsubscribe()
    }

    // MARK: - Restaurant change handlers

    private func handleRestaurantChange(_ change: AnyAction) {
        do {
            switch change {
            case .insert(let action):
                let dto = try action.decodeRecord(as: RestaurantDTO.self, decoder: .realtimeDecoder)
                try handleRestaurantInsert(dto)

            case .update(let action):
                let dto = try action.decodeRecord(as: RestaurantDTO.self, decoder: .realtimeDecoder)
                try handleRestaurantUpdate(dto)

            case .delete(let action):
                // With default replica identity only the PK is returned;
                // decode from old record columns.
                // `try`, not `try?`: a decode failure here must reach the catch
                // below and be logged. Discarding it is the silent-swallow shape
                // this story exists to remove.
                let dto = try action.decodeOldRecord(as: RestaurantDTO.self, decoder: .realtimeDecoder)
                try handleRestaurantDelete(id: dto.id)

            case .select:
                break
            }
        } catch {
            // Non-fatal: a missed realtime event will be caught on next pull.
            realtimeLog.error("Restaurant realtime change failed: \(String(describing: error), privacy: .public)")
        }
    }

    private func handleRestaurantInsert(_ dto: RestaurantDTO) throws {
        guard !hasPendingOperation(for: dto.id) else { return }
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.id == dto.id }
        )
        guard (try modelContext.fetch(descriptor)).isEmpty else { return }
        let restaurant = dto.toModel()
        modelContext.insert(restaurant)
        // Realtime ordering is not guaranteed, so visits for this restaurant may
        // already be sitting here unlinked. Repair them now rather than leaving
        // them invisible until the next foreground pull.
        try rehydrateDanglingVisits(for: restaurant)
        try modelContext.save()
    }

    /// Links any local visit that belongs to `restaurant` but has no relationship yet.
    private func rehydrateDanglingVisits(for restaurant: Restaurant) throws {
        let restaurantId = restaurant.id
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.restaurantId == restaurantId }
        )
        for visitLog in try modelContext.fetch(descriptor) where visitLog.restaurant == nil {
            visitLog.restaurant = restaurant
        }
    }

    private func handleRestaurantUpdate(_ dto: RestaurantDTO) throws {
        // Don't overwrite locally queued unsynced writes.
        guard !hasPendingOperation(for: dto.id) else { return }
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.id == dto.id }
        )
        guard let existing = (try modelContext.fetch(descriptor)).first else {
            // Record doesn't exist locally — treat as insert.
            modelContext.insert(dto.toModel())
            try modelContext.save()
            return
        }
        guard dto.updatedAt > existing.updatedAt else { return }
        applyDTO(dto, to: existing)
        try modelContext.save()
    }

    private func handleRestaurantDelete(id: UUID) throws {
        guard !hasPendingOperation(for: id) else { return }
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.id == id }
        )
        guard let existing = (try modelContext.fetch(descriptor)).first else { return }
        modelContext.delete(existing)
        try modelContext.save()
    }

    // MARK: - VisitLog change handlers

    private func handleVisitLogChange(_ change: AnyAction) {
        do {
            switch change {
            case .insert(let action):
                let dto = try action.decodeRecord(as: VisitLogDTO.self, decoder: .realtimeDecoder)
                try handleVisitLogInsert(dto)

            case .update:
                // Visit logs are immutable after creation; updates are no-ops.
                break

            case .delete(let action):
                // `try`, not `try?` — see the restaurant delete branch.
                let dto = try action.decodeOldRecord(as: VisitLogDTO.self, decoder: .realtimeDecoder)
                try handleVisitLogDelete(id: dto.id)

            case .select:
                break
            }
        } catch {
            // Non-fatal: a missed realtime event will be caught on next pull.
            realtimeLog.error("Visit log realtime change failed: \(String(describing: error), privacy: .public)")
        }
    }

    private func handleVisitLogInsert(_ dto: VisitLogDTO) throws {
        guard !hasPendingOperation(for: dto.id) else { return }
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.id == dto.id }
        )
        guard (try modelContext.fetch(descriptor)).isEmpty else { return }
        let visitLog = dto.toModel()
        modelContext.insert(visitLog)
        hydrateRestaurant(for: visitLog)
        try modelContext.save()
    }

    /// Realtime insert ordering is not guaranteed, so a visit can arrive before
    /// its restaurant does. Leaving `restaurant` nil is acceptable — the next
    /// foreground pull's re-hydration pass repairs it.
    private func hydrateRestaurant(for visitLog: VisitLog) {
        let restaurantId = visitLog.restaurantId
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.id == restaurantId }
        )
        visitLog.restaurant = try? modelContext.fetch(descriptor).first
    }

    private func handleVisitLogDelete(id: UUID) throws {
        guard !hasPendingOperation(for: id) else { return }
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.id == id }
        )
        guard let existing = (try modelContext.fetch(descriptor)).first else { return }
        modelContext.delete(existing)
        try modelContext.save()
    }

    // MARK: - Private helpers

    /// Returns true if SyncQueue has a pending write for this record ID.
    /// Prevents inbound realtime events from stomping optimistic local writes.
    private func hasPendingOperation(for recordId: UUID) -> Bool {
        syncQueue.hasPendingOperation(for: recordId)
    }

    private func applyDTO(_ dto: RestaurantDTO, to model: Restaurant) {
        model.name = dto.name
        model.address = dto.address
        model.latitude = dto.latitude
        model.longitude = dto.longitude
        model.neighborhood = dto.neighborhood
        model.city = dto.city
        model.website = dto.website
        model.menuUrl = dto.menuUrl
        model.cuisine = dto.cuisine
        model.venueType = VenueType(rawValue: dto.venueType) ?? .restaurant
        model.priceRange = RestaurantDTO.appPriceRange(fromPostgresText: dto.priceRange)
        model.status = RestaurantStatus(rawValue: dto.status) ?? .wantToGo
        model.generalNote = dto.generalNote
        model.placeId = dto.placeId
        model.sourceUrl = dto.sourceUrl
        model.updatedAt = dto.updatedAt
    }
}

// MARK: - Realtime JSON decoder

private extension JSONDecoder {
    /// Decoder configured for Supabase Realtime payloads (ISO8601 dates).
    ///
    /// No `keyDecodingStrategy` — both DTOs declare explicit snake_case
    /// `CodingKeys`, and `.convertFromSnakeCase` rewrites keys like `user_id`
    /// to `userId` before they reach those `CodingKeys`, so every required
    /// key fails to match and decoding throws (`DecodingError.keyNotFound`).
    static let realtimeDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
