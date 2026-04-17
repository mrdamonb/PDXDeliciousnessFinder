import Foundation
import Observation
import SwiftData
import Supabase

@Observable
@MainActor
final class AppState {
    var currentUser: User?
    var isLoading = true

    // MARK: - Sync services (owned here, lifecycle tied to auth)

    private(set) var networkMonitor: NetworkMonitor
    private(set) var syncQueue: SyncQueue
    private(set) var realtimeSubscriptions: RealtimeSubscriptions
    private(set) var restaurantRepository: any RestaurantRepositoryProtocol
    private(set) var visitLogRepository: any VisitLogRepositoryProtocol

    init(
        modelContext: ModelContext,
        restaurantRepository: (any RestaurantRepositoryProtocol)? = nil,
        visitLogRepository: (any VisitLogRepositoryProtocol)? = nil
    ) {
        let monitor = NetworkMonitor()
        let queue = SyncQueue(modelContext: modelContext, networkMonitor: monitor)
        self.networkMonitor = monitor
        self.syncQueue = queue
        self.realtimeSubscriptions = RealtimeSubscriptions(modelContext: modelContext, syncQueue: queue)
        self.restaurantRepository = restaurantRepository
            ?? RestaurantRepository(modelContext: modelContext, syncQueue: queue)
        self.visitLogRepository = visitLogRepository
            ?? VisitLogRepository(modelContext: modelContext, syncQueue: queue)
    }

    func initialize() async {
        networkMonitor.start()
        let stream = await supabase.auth.authStateChanges
        for await (event, session) in stream {
            switch event {
            case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
                currentUser = session?.user
                // Persist userId for share extension via shared UserDefaults
                UserDefaults(suiteName: PersistenceController.appGroupID)?
                    .set(session?.user.id.uuidString, forKey: .currentUserIdKey)
                if let user = session?.user {
                    realtimeSubscriptions.start(userId: user.id)
                }
            case .signedOut:
                currentUser = nil
                UserDefaults(suiteName: PersistenceController.appGroupID)?
                    .removeObject(forKey: .currentUserIdKey)
                realtimeSubscriptions.stop()
            default:
                break
            }
            if isLoading { isLoading = false }
        }
    }

    // MARK: - Filter state (shared between Map and List tabs)

    var activeStatuses: Set<RestaurantStatus> = []
    var activeVenueTypes: Set<VenueType> = []
    var activeNeighborhoods: Set<String> = []
    var activeCuisines: Set<String> = []
    var activePriceRanges: Set<PriceRange> = []

    var hasActiveFilters: Bool {
        !activeStatuses.isEmpty || !activeVenueTypes.isEmpty ||
        !activeNeighborhoods.isEmpty || !activeCuisines.isEmpty ||
        !activePriceRanges.isEmpty
    }

    func clearAllFilters() {
        activeStatuses = []
        activeVenueTypes = []
        activeNeighborhoods = []
        activeCuisines = []
        activePriceRanges = []
    }

    /// Returns `true` when the restaurant passes ALL active filters.
    /// A dimension with an empty set is ignored (matches all).
    func isFiltered(_ restaurant: Restaurant) -> Bool {
        if !activeStatuses.isEmpty && !activeStatuses.contains(restaurant.status) { return false }
        if !activeVenueTypes.isEmpty && !activeVenueTypes.contains(restaurant.venueType) { return false }
        if !activeNeighborhoods.isEmpty {
            guard let n = restaurant.neighborhood, activeNeighborhoods.contains(n) else { return false }
        }
        if !activeCuisines.isEmpty {
            guard let c = restaurant.cuisine, activeCuisines.contains(c) else { return false }
        }
        if !activePriceRanges.isEmpty {
            guard let p = restaurant.priceRange, activePriceRanges.contains(p) else { return false }
        }
        return true
    }

    // MARK: - Foreground reconciliation

    /// Called when the app returns to foreground. Flushes any queued writes
    /// (including those from the share extension) and pulls down remote changes.
    func reconcileOnForeground() async {
        guard let user = currentUser else { return }

        // Clear the extension-write flag immediately so we don't double-process.
        let defaults = UserDefaults(suiteName: PersistenceController.appGroupID)
        if defaults?.bool(forKey: "pendingExtensionWrite") == true {
            defaults?.removeObject(forKey: "pendingExtensionWrite")
        }

        await syncQueue.flush()
        try? await restaurantRepository.pullFromRemote(userId: user.id)
    }

    // MARK: - Email / Password Auth

    /// Returns the session if Supabase auto-confirmed the account, or nil if email confirmation is required.
    @discardableResult
    func signUp(email: String, password: String) async throws -> Session? {
        let response = try await supabase.auth.signUp(email: email, password: password)
        return response.session
    }

    func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email, password: password)
    }

    func signOut() async throws {
        try await supabase.auth.signOut()
    }
}
