import Foundation
import SwiftData
import Supabase

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
                if let dto = try? action.decodeOldRecord(as: RestaurantDTO.self, decoder: .realtimeDecoder) {
                    try handleRestaurantDelete(id: dto.id)
                }

            case .select:
                break
            }
        } catch {
            // Non-fatal: a missed realtime event will be caught on next pull.
        }
    }

    private func handleRestaurantInsert(_ dto: RestaurantDTO) throws {
        guard !hasPendingOperation(for: dto.id) else { return }
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.id == dto.id }
        )
        guard (try modelContext.fetch(descriptor)).isEmpty else { return }
        modelContext.insert(dto.toModel())
        try modelContext.save()
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
                if let dto = try? action.decodeOldRecord(as: VisitLogDTO.self, decoder: .realtimeDecoder) {
                    try handleVisitLogDelete(id: dto.id)
                }

            case .select:
                break
            }
        } catch {
            // Non-fatal.
        }
    }

    private func handleVisitLogInsert(_ dto: VisitLogDTO) throws {
        guard !hasPendingOperation(for: dto.id) else { return }
        let descriptor = FetchDescriptor<VisitLog>(
            predicate: #Predicate { $0.id == dto.id }
        )
        guard (try modelContext.fetch(descriptor)).isEmpty else { return }
        modelContext.insert(dto.toModel())
        try modelContext.save()
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
    /// Decoder configured for Supabase Realtime payloads (ISO8601 dates, snake_case keys).
    static let realtimeDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
