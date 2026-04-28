import Foundation
import SwiftData
import Supabase

/// Mediates Restaurant persistence between SwiftData (local) and Supabase (remote).
/// ViewModels call these methods — never `supabase.from()` directly.
/// Write operations save locally first, then enqueue a SyncQueue operation.
@MainActor
final class RestaurantRepository: RestaurantRepositoryProtocol {
    private let modelContext: ModelContext
    private let syncQueue: SyncQueue

    init(modelContext: ModelContext, syncQueue: SyncQueue) {
        self.modelContext = modelContext
        self.syncQueue = syncQueue
    }

    // MARK: - Local reads

    func fetchAll(for userId: UUID) throws -> [Restaurant] {
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.userId == userId },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    func fetch(id: UUID) throws -> Restaurant? {
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.id == id }
        )
        return try modelContext.fetch(descriptor).first
    }

    func fetchByStatus(_ status: RestaurantStatus, userId: UUID) throws -> [Restaurant] {
        let rawStatus = status.rawValue
        let descriptor = FetchDescriptor<Restaurant>(
            predicate: #Predicate { $0.userId == userId && $0.status.rawValue == rawStatus },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    // MARK: - Writes (local + enqueue remote sync)

    /// Saves a restaurant to SwiftData immediately and enqueues a remote upsert.
    @discardableResult
    func save(_ restaurant: Restaurant) throws -> Restaurant {
        modelContext.insert(restaurant)
        try modelContext.save()
        try syncQueue.enqueueUpsert(
            table: SupabaseTables.restaurants,
            recordId: restaurant.id
        )
        return restaurant
    }

    /// Updates an existing restaurant locally and enqueues a remote upsert.
    func update(_ restaurant: Restaurant) throws {
        restaurant.updatedAt = .now
        try modelContext.save()
        try syncQueue.enqueueUpsert(
            table: SupabaseTables.restaurants,
            recordId: restaurant.id
        )
    }

    /// Deletes a restaurant locally and enqueues a remote delete.
    func delete(_ restaurant: Restaurant) throws {
        let id = restaurant.id
        modelContext.delete(restaurant)
        try modelContext.save()
        try syncQueue.enqueueDelete(
            table: SupabaseTables.restaurants,
            recordId: id
        )
    }

    // MARK: - Remote pull (called by sync layer, not ViewModels)

    /// Fetches all restaurants for a user from Supabase and merges into SwiftData.
    func pullFromRemote(userId: UUID) async throws {
        let dtos: [RestaurantDTO] = try await supabase.database
            .from(SupabaseTables.restaurants)
            .select()
            .eq("user_id", value: userId)
            .execute()
            .value

        for dto in dtos {
            if let existing = try fetch(id: dto.id) {
                if dto.updatedAt > existing.updatedAt {
                    applyDTO(dto, to: existing)
                }
            } else {
                modelContext.insert(dto.toModel())
            }
        }
        try modelContext.save()
    }

    // MARK: - Private

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
