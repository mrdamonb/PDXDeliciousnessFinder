import Foundation
import SwiftData
import MapKit
import CoreLocation

@Observable
@MainActor
final class AddRestaurantViewModel {
    // MARK: - Form fields
    var name = ""
    var address = ""
    var city = "Portland"
    var website = ""
    var cuisine = ""
    var neighborhood = ""
    var venueType: VenueType = .restaurant
    var priceRange: PriceRange? = nil
    var status: RestaurantStatus = .wantToGo
    var generalNote = ""

    // MARK: - Stored coordinates (from Places API — more accurate than MapKit geocoder)
    var latitude: Double? = nil
    var longitude: Double? = nil

    // MARK: - Search state
    var searchQuery = ""
    var searchState: ViewState<[PlaceSearchResult]> = .idle

    // MARK: - Save state
    var saveState: ViewState<Void> = .idle
    var nameError: String? = nil

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func validate() -> Bool {
        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            nameError = "Name is required."
            return false
        }
        nameError = nil
        return true
    }

    func searchPlaces() async {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }
        searchState = .loading
        let result = await PlacesSearchService().search(query: query)
        switch result {
        case .success(let places):
            searchState = .loaded(places)
        case .failure(let error):
            searchState = .error(.network(underlying: error))
        }
    }

    func populate(from result: PlaceSearchResult) {
        name = result.name
        address = result.address ?? ""
        website = result.website ?? ""
        latitude = result.latitude
        longitude = result.longitude
        cuisine = result.cuisine ?? ""
        if let vt = result.venueType { venueType = vt }
        if let pr = result.priceRange { priceRange = pr }
        searchState = .idle
        searchQuery = ""
    }

    func save(repository: any RestaurantRepositoryProtocol, userId: UUID) async -> Bool {
        guard validate() else { return false }
        saveState = .loading
        do {
            // Use coordinates from Places API if available; fall back to MapKit geocoder.
            let (lat, lon): (Double?, Double?)
            if let existingLat = latitude, let existingLon = longitude {
                (lat, lon) = (existingLat, existingLon)
            } else {
                (lat, lon) = await geocode(address: address, city: city)
            }

            // Auto-detect neighborhood if user left the field blank and we got coordinates.
            let resolvedNeighborhood: String?
            if !neighborhood.isEmpty {
                resolvedNeighborhood = neighborhood
            } else if let lat, let lon {
                let coord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
                resolvedNeighborhood = NeighborhoodService.shared.neighborhood(for: coord)
            } else {
                resolvedNeighborhood = nil
            }

            let restaurant = Restaurant(
                userId: userId,
                name: name.trimmingCharacters(in: .whitespaces),
                address: address.isEmpty ? nil : address,
                latitude: lat,
                longitude: lon,
                neighborhood: resolvedNeighborhood,
                city: city.isEmpty ? "Portland" : city,
                website: website.isEmpty ? nil : website,
                cuisine: { let t = cuisine.trimmingCharacters(in: .whitespaces); return t.isEmpty ? nil : t }(),
                venueType: venueType,
                priceRange: priceRange,
                status: status,
                generalNote: generalNote.isEmpty ? nil : generalNote
            )
            try repository.save(restaurant)
            saveState = .loaded(())
            return true
        } catch {
            saveState = .error(.persistence(underlying: error))
            return false
        }
    }

    // MARK: - Private

    /// Geocodes the given address. Returns (nil, nil) silently on any failure
    /// so saving always succeeds — the pin just won't appear on the map.
    func geocode(address: String, city: String) async -> (Double?, Double?) {
        guard !address.trimmingCharacters(in: .whitespaces).isEmpty else { return (nil, nil) }
        let query = [address, city].filter { !$0.isEmpty }.joined(separator: ", ")
        do {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            let response = try await MKLocalSearch(request: request).start()
            if let coord = response.mapItems.first.map({ $0.location.coordinate }) {
                return (coord.latitude, coord.longitude)
            }
        } catch {
            // Best-effort — ignore failures
        }
        return (nil, nil)
    }
}
