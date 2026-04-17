import Foundation

/// Parsed data extracted from a shared URL via schema.org scraping.
/// All fields except `sourceUrl` are optional — a partial result is valid.
struct EnrichmentResult {
    var name: String?
    var address: String?
    var latitude: Double?
    var longitude: Double?
    var website: String?
    var cuisine: String?
    var venueType: VenueType?
    var priceRange: PriceRange?
    /// The original URL that was shared (always present).
    var sourceUrl: String
}
