import Foundation

// MARK: - RestaurantRepositoryProtocol

/// Defines the interface for Restaurant persistence.
/// Conform to this protocol to inject a mock in tests.
@MainActor
protocol RestaurantRepositoryProtocol: AnyObject {
    @discardableResult
    func save(_ restaurant: Restaurant) throws -> Restaurant
    func update(_ restaurant: Restaurant) throws
    func delete(_ restaurant: Restaurant) throws
    func fetchAll(for userId: UUID) throws -> [Restaurant]
    func fetch(id: UUID) throws -> Restaurant?
    func fetchByStatus(_ status: RestaurantStatus, userId: UUID) throws -> [Restaurant]
    func pullFromRemote(userId: UUID) async throws
}

// MARK: - VisitLogRepositoryProtocol

/// Defines the interface for VisitLog persistence.
/// Conform to this protocol to inject a mock in tests.
@MainActor
protocol VisitLogRepositoryProtocol: AnyObject {
    @discardableResult
    func save(_ visitLog: VisitLog) throws -> VisitLog
    func update(_ visitLog: VisitLog) throws
    func delete(_ visitLog: VisitLog) throws
    func fetchAll(for restaurantId: UUID) throws -> [VisitLog]
    func fetch(id: UUID) throws -> VisitLog?
    func pullFromRemote(userId: UUID) async throws
}
