import Foundation
import SwiftData

// MARK: - Shared UserDefaults keys

extension String {
    /// Key used to hand the signed-in userId from the main app to the share extension.
    static let currentUserIdKey = "currentUserId"
}

/// Configures the SwiftData ModelContainer using the App Groups shared
/// container so the Share Extension can access the same data store.
enum PersistenceController {
    static let appGroupID = "group.com.damonbrennen.PDXDeliciousnessFinder"

    /// Shared ModelContainer for the app and share extension.
    static let sharedModelContainer: ModelContainer = {
        let schema = Schema([Restaurant.self, VisitLog.self, SyncOperation.self])
        let config = ModelConfiguration(
            "PDXDeliciousness",
            schema: schema,
            url: storeURL,
            allowsSave: true
        )
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }()

    /// URL pointing to the SwiftData store inside the shared App Group container.
    static var storeURL: URL {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            fatalError(
                "App Group '\(appGroupID)' not configured. "
                + "Add it in Signing & Capabilities."
            )
        }
        return containerURL.appendingPathComponent("PDXDeliciousness.store")
    }
}
