import Foundation
import Network

/// Observes network connectivity via NWPathMonitor and publishes changes.
@Observable
@MainActor
final class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.damonbrennen.pdx.networkmonitor")

    /// Starts `false` until `start()` reads `currentPath` / first callback — avoids treating
    /// the device as online before `NWPathMonitor` has reported real reachability.
    private(set) var isConnected = false

    /// Callback fired on the main actor when connectivity is restored.
    var onConnectivityRestored: (() -> Void)?

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let satisfied = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                let wasConnected = self.isConnected
                self.isConnected = satisfied
                if !wasConnected && self.isConnected {
                    self.onConnectivityRestored?()
                }
            }
        }
        monitor.start(queue: queue)
        isConnected = monitor.currentPath.status == .satisfied
    }

    func stop() {
        monitor.cancel()
    }
}
