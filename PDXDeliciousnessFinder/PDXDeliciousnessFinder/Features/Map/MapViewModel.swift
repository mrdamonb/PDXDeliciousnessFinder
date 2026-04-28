import Observation
import MapKit
import CoreLocation

/// ViewModel for the Portland restaurant map.
///
/// Responsibilities:
/// - Holds `region` (Portland-centered default; updated on first GPS fix)
/// - Manages CoreLocation permission and location updates
/// - Tracks `selectedRestaurant` for pin-tap → detail sheet
///
/// Restaurants are loaded via `@Query` in `MapView` (same pattern as `RestaurantListView`)
/// to keep SwiftData observation in the view layer.
@Observable
@MainActor
final class MapViewModel: NSObject {

    // MARK: - Public state

    /// Map region. Defaults to Portland; updated to user location on first fix.
    var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 45.5051, longitude: -122.6750),
        span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
    )

    /// Set when the user taps a pin; drives the detail sheet.
    var selectedRestaurant: Restaurant?

    /// `true` after we've centered on the user's actual location at least once.
    private(set) var hasCenteredOnUser = false

    /// Most recent GPS fix — kept current so the locate button always snaps to real position.
    private(set) var userLocation: CLLocationCoordinate2D?

    // MARK: - Private

    private let locationManager = CLLocationManager()

    // MARK: - Init

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    // MARK: - Location permission

    func requestLocationPermission() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager.requestLocation()
        default:
            break   // Denied/restricted — stay on Portland default
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension MapViewModel: CLLocationManagerDelegate {

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if manager.authorizationStatus == .authorizedWhenInUse ||
               manager.authorizationStatus == .authorizedAlways {
                manager.requestLocation()
            }
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            userLocation = location.coordinate
            if !hasCenteredOnUser {
                region = MKCoordinateRegion(
                    center: location.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.10, longitudeDelta: 0.10)
                )
                hasCenteredOnUser = true
            }
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        // On failure, stay on Portland default — no action needed
    }
}
