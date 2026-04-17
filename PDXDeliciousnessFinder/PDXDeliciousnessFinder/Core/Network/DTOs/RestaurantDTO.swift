import Foundation

/// Codable transfer object for the Supabase `restaurants` table.
/// Maps snake_case columns to camelCase Swift properties.
///
/// Encodable and Decodable are implemented explicitly as `nonisolated` so this
/// struct can satisfy `Encodable & Sendable` constraints in PostgREST calls
/// despite the project-wide `@MainActor` default isolation.
struct RestaurantDTO: Identifiable, Sendable {
    let id: UUID
    let userId: UUID
    var name: String
    var address: String?
    var latitude: Double?
    var longitude: Double?
    var neighborhood: String?
    var city: String
    var website: String?
    var cuisine: String?
    var venueType: String
    /// Postgres `price_range` text value: "$", "$$", "$$$", or "$$$$".
    var priceRange: String?
    var status: String
    var generalNote: String?
    var placeId: String?
    var sourceUrl: String?
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case address
        case latitude
        case longitude
        case neighborhood
        case city
        case website
        case cuisine
        case venueType = "venue_type"
        case priceRange = "price_range"
        case status
        case generalNote = "general_note"
        case placeId = "place_id"
        case sourceUrl = "source_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Codable (nonisolated to satisfy Sendable constraints across actor boundaries)

extension RestaurantDTO: Encodable {
    nonisolated func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(userId, forKey: .userId)
        try c.encode(name, forKey: .name)
        try c.encodeIfPresent(address, forKey: .address)
        try c.encodeIfPresent(latitude, forKey: .latitude)
        try c.encodeIfPresent(longitude, forKey: .longitude)
        try c.encodeIfPresent(neighborhood, forKey: .neighborhood)
        try c.encode(city, forKey: .city)
        try c.encodeIfPresent(website, forKey: .website)
        try c.encodeIfPresent(cuisine, forKey: .cuisine)
        try c.encode(venueType, forKey: .venueType)
        try c.encodeIfPresent(priceRange, forKey: .priceRange)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(generalNote, forKey: .generalNote)
        try c.encodeIfPresent(placeId, forKey: .placeId)
        try c.encodeIfPresent(sourceUrl, forKey: .sourceUrl)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encode(updatedAt, forKey: .updatedAt)
    }
}

extension RestaurantDTO: Decodable {
    nonisolated init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        userId = try c.decode(UUID.self, forKey: .userId)
        name = try c.decode(String.self, forKey: .name)
        address = try c.decodeIfPresent(String.self, forKey: .address)
        latitude = try c.decodeIfPresent(Double.self, forKey: .latitude)
        longitude = try c.decodeIfPresent(Double.self, forKey: .longitude)
        neighborhood = try c.decodeIfPresent(String.self, forKey: .neighborhood)
        city = try c.decode(String.self, forKey: .city)
        website = try c.decodeIfPresent(String.self, forKey: .website)
        cuisine = try c.decodeIfPresent(String.self, forKey: .cuisine)
        venueType = try c.decode(String.self, forKey: .venueType)
        priceRange = try c.decodeIfPresent(String.self, forKey: .priceRange)
        status = try c.decode(String.self, forKey: .status)
        generalNote = try c.decodeIfPresent(String.self, forKey: .generalNote)
        placeId = try c.decodeIfPresent(String.self, forKey: .placeId)
        sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
    }
}

// MARK: - Model ↔ DTO Conversion

extension RestaurantDTO {
    /// Maps app ``PriceRange`` → Postgres `price_range` text ("$"…"$$$$").
    static func postgresText(fromApp range: PriceRange?) -> String? {
        guard let range else { return nil }
        return String(repeating: "$", count: range.rawValue)
    }

    /// Maps Postgres `price_range` text ("$"…"$$$$") → app ``PriceRange``.
    static func appPriceRange(fromPostgresText text: String?) -> PriceRange? {
        guard let text else { return nil }
        return PriceRange(rawValue: text.count)
    }

    init(from model: Restaurant) {
        self.id = model.id
        self.userId = model.userId
        self.name = model.name
        self.address = model.address
        self.latitude = model.latitude
        self.longitude = model.longitude
        self.neighborhood = model.neighborhood
        self.city = model.city
        self.website = model.website
        self.cuisine = model.cuisine
        self.venueType = model.venueType.rawValue
        self.priceRange = Self.postgresText(fromApp: model.priceRange)
        self.status = model.status.rawValue
        self.generalNote = model.generalNote
        self.placeId = model.placeId
        self.sourceUrl = model.sourceUrl
        self.createdAt = model.createdAt
        self.updatedAt = model.updatedAt
    }

    func toModel() -> Restaurant {
        Restaurant(
            id: id,
            userId: userId,
            name: name,
            address: address,
            latitude: latitude,
            longitude: longitude,
            neighborhood: neighborhood,
            city: city,
            website: website,
            cuisine: cuisine,
            venueType: VenueType(rawValue: venueType) ?? .restaurant,
            priceRange: Self.appPriceRange(fromPostgresText: priceRange),
            status: RestaurantStatus(rawValue: status) ?? .wantToGo,
            generalNote: generalNote,
            placeId: placeId,
            sourceUrl: sourceUrl,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}
