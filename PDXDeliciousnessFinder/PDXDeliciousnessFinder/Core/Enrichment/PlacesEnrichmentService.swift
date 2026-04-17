import Foundation
import OSLog

private let logger = Logger(subsystem: "com.damonbrennen.PDXDeliciousnessFinder", category: "PlacesEnrichment")

// MARK: - DTOs

struct EnrichmentResponse: Codable {
    let success: Bool
    let data: EnrichedPlaceData?
    let error: String?
}

struct EnrichedPlaceData: Codable {
    let name: String?
    let address: String?
    let latitude: Double?
    let longitude: Double?
    let website: String?
    let cuisine: String?
    let venueType: String?    // raw string from Edge Function: "restaurant" | "bar" | "brewery" | "foodCart"
    let priceRange: String?   // "$" | "$$" | "$$$" | "$$$$" or nil
}

// MARK: - Request DTO

private struct EnrichmentRequest: Encodable {
    let name: String?
    let url: String?
    let address: String?
}

// MARK: - Service

/// Calls the `enrich-restaurant` Supabase Edge Function to fill gaps in schema.org data.
///
/// Uses URLSession directly so it can be compiled into the ShareExtension without
/// requiring the full Supabase SDK to be linked into the extension target.
/// Reads credentials from `Bundle.main.infoDictionary` so it works identically
/// in both the main app and Share Extension processes.
///
/// All methods are `nonisolated` — network work must not run on the MainActor
/// (project sets `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` globally).
final class PlacesEnrichmentService {

    /// Enrich `partial` via the Places API Edge Function.
    /// Schema.org fields take precedence; the Edge Function fills nil gaps only.
    /// Never throws — returns `partial` unchanged on any failure.
    nonisolated func enrich(from partial: EnrichmentResult) async -> EnrichmentResult {
        guard let (host, anonKey) = credentials(), !host.isEmpty, !anonKey.isEmpty else {
            logger.error("Missing credentials — SUPABASE_HOST/ANON_KEY not in Bundle.main.infoDictionary")
            return partial
        }
        logger.debug("Calling enrich-restaurant for: \(partial.name ?? partial.sourceUrl, privacy: .private)")

        let requestBody = EnrichmentRequest(
            name: partial.name,
            url: partial.sourceUrl.isEmpty ? nil : partial.sourceUrl,
            address: partial.address
        )

        do {
            let bodyData = try JSONEncoder().encode(requestBody)

            guard let url = URL(string: "https://\(host)/functions/v1/enrich-restaurant") else {
                return partial
            }

            var request = URLRequest(url: url, timeoutInterval: 10)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
            request.httpBody = bodyData

            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(EnrichmentResponse.self, from: data)

            guard response.success, let enrichedData = response.data else {
                logger.warning("Enrichment returned success=\(response.success, privacy: .public) error=\(response.error ?? "nil", privacy: .private)")
                return partial
            }
            logger.debug("Enrichment succeeded: name=\(enrichedData.name ?? "nil", privacy: .private)")
            return merge(partial: partial, enriched: enrichedData)
        } catch {
            logger.error("Enrichment request failed: \(error, privacy: .public)")
            return partial
        }
    }

    // MARK: - Private helpers

    nonisolated private func credentials() -> (host: String, anonKey: String)? {
        guard let info = Bundle.main.infoDictionary,
              let host = info["SUPABASE_HOST"] as? String,
              let key = info["SUPABASE_ANON_KEY"] as? String else { return nil }
        return (host, key)
    }

    nonisolated private func merge(partial: EnrichmentResult, enriched: EnrichedPlaceData) -> EnrichmentResult {
        var merged = partial
        merged.name      = partial.name      ?? enriched.name
        merged.address   = partial.address   ?? enriched.address
        merged.latitude  = partial.latitude  ?? enriched.latitude
        merged.longitude = partial.longitude ?? enriched.longitude
        merged.website   = partial.website   ?? enriched.website
        merged.cuisine   = partial.cuisine   ?? enriched.cuisine
        if partial.venueType == nil, let vt = enriched.venueType {
            merged.venueType = venueTypeFromString(vt)
        }
        if partial.priceRange == nil, let pr = enriched.priceRange {
            merged.priceRange = priceRangeFromString(pr)
        }
        return merged
    }

    /// Maps Edge Function venueType strings to the Swift `VenueType` enum.
    /// The Edge Function emits "foodCart"; the Swift enum raw value is "food_cart".
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
