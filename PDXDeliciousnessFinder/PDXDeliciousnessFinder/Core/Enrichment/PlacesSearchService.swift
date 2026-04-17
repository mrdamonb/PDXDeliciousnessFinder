import Foundation

// MARK: - Result type

struct PlaceSearchResult {
    let name: String
    let address: String?
    let latitude: Double?
    let longitude: Double?
    let website: String?
    let cuisine: String?
    let venueType: VenueType?
    let priceRange: PriceRange?
}

// MARK: - DTOs

private struct SearchResponse: Codable {
    let success: Bool
    let results: [SearchResultDTO]?
    let error: String?
}

private struct SearchResultDTO: Codable {
    let name: String?
    let address: String?
    let latitude: Double?
    let longitude: Double?
    let website: String?
    let cuisine: String?
    let venueType: String?
    let priceRange: String?
}

// MARK: - Service

/// Calls the `search-places` Supabase Edge Function to find restaurants by name query.
///
/// Uses URLSession directly (no Supabase SDK) and reads credentials from
/// `Bundle.main.infoDictionary`. All methods are `nonisolated` — network work
/// must not run on the MainActor (project sets `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`).
final class PlacesSearchService {

    nonisolated func search(query: String) async -> Result<[PlaceSearchResult], Error> {
        guard let (host, anonKey) = credentials() else {
            return .failure(URLError(.userAuthenticationRequired))
        }
        guard let url = URL(string: "https://\(host)/functions/v1/search-places") else {
            return .failure(URLError(.badURL))
        }

        do {
            let bodyData = try JSONSerialization.data(withJSONObject: ["query": query, "limit": 5])

            var request = URLRequest(url: url, timeoutInterval: 10)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
            request.httpBody = bodyData

            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(SearchResponse.self, from: data)

            guard response.success, let dtos = response.results else {
                let msg = response.error ?? "Search failed"
                return .failure(URLError(.badServerResponse, userInfo: [NSLocalizedDescriptionKey: msg]))
            }

            let places = dtos.compactMap { dto -> PlaceSearchResult? in
                guard let name = dto.name else { return nil }
                return PlaceSearchResult(
                    name: name,
                    address: dto.address,
                    latitude: dto.latitude,
                    longitude: dto.longitude,
                    website: dto.website,
                    cuisine: dto.cuisine,
                    venueType: dto.venueType.flatMap(venueTypeFromString),
                    priceRange: dto.priceRange.flatMap(priceRangeFromString)
                )
            }
            return .success(places)
        } catch {
            return .failure(error)
        }
    }

    // MARK: - Private helpers

    nonisolated private func credentials() -> (host: String, anonKey: String)? {
        guard let info = Bundle.main.infoDictionary,
              let host = info["SUPABASE_HOST"] as? String,
              let key = info["SUPABASE_ANON_KEY"] as? String else { return nil }
        return (host, key)
    }

    nonisolated private func venueTypeFromString(_ s: String) -> VenueType? {
        switch s {
        case "restaurant": return .restaurant
        case "bar":        return .bar
        case "brewery":    return .brewery
        case "foodCart":   return .foodCart
        default:           return nil
        }
    }

    nonisolated private func priceRangeFromString(_ s: String) -> PriceRange? {
        switch s {
        case "$":    return .one
        case "$$":   return .two
        case "$$$":  return .three
        case "$$$$": return .four
        default:     return nil
        }
    }
}
