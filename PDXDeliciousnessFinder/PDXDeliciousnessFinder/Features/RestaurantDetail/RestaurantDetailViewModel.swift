import Foundation
import SwiftData

@Observable
@MainActor
final class RestaurantDetailViewModel {
    var actionState: ViewState<Void> = .idle

    // MARK: - Status changes (Story 2.4)

    /// Sets status to .beenThere AND creates a VisitLog entry.
    /// Call this when the user taps "Mark as Visited".
    func markVisited(
        restaurant: Restaurant,
        visitedAt: Date,
        note: String?,
        restaurantRepo: any RestaurantRepositoryProtocol,
        visitLogRepo: any VisitLogRepositoryProtocol,
        userId: UUID
    ) async {
        actionState = .loading
        do {
            restaurant.status = .beenThere
            try restaurantRepo.update(restaurant)

            let visitLog = VisitLog(
                restaurantId: restaurant.id,
                userId: userId,
                visitedAt: visitedAt,
                note: note.flatMap { $0.isEmpty ? nil : $0 }
            )
            try visitLogRepo.save(visitLog)
            actionState = .loaded(())
        } catch {
            actionState = .error(.persistence(underlying: error))
        }
    }

    /// Toggles between .favorite and .beenThere.
    func toggleFavorite(restaurant: Restaurant, repo: any RestaurantRepositoryProtocol) async {
        actionState = .loading
        do {
            restaurant.status = restaurant.status == .favorite ? .beenThere : .favorite
            try repo.update(restaurant)
            actionState = .loaded(())
        } catch {
            actionState = .error(.persistence(underlying: error))
        }
    }

    // MARK: - Delete (Story 2.6)

    /// Deletes the restaurant and all its visit logs.
    /// Returns true if successful so the caller can dismiss.
    func delete(restaurant: Restaurant, repo: any RestaurantRepositoryProtocol) async -> Bool {
        actionState = .loading
        do {
            try repo.delete(restaurant)
            actionState = .loaded(())
            return true
        } catch {
            actionState = .error(.persistence(underlying: error))
            return false
        }
    }

    // MARK: - Visit log (Story 2.5)

    func addVisit(
        restaurant: Restaurant,
        visitedAt: Date,
        note: String?,
        visitLogRepo: any VisitLogRepositoryProtocol,
        userId: UUID
    ) async {
        actionState = .loading
        do {
            let visitLog = VisitLog(
                restaurantId: restaurant.id,
                userId: userId,
                visitedAt: visitedAt,
                note: note.flatMap { $0.isEmpty ? nil : $0 }
            )
            try visitLogRepo.save(visitLog)
            actionState = .loaded(())
        } catch {
            actionState = .error(.persistence(underlying: error))
        }
    }
}
