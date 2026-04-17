import Foundation
import SwiftData

/// Venue classification for a restaurant entry.
enum VenueType: String, Codable, CaseIterable {
    case restaurant
    case bar
    case brewery
    case foodCart = "food_cart"

    var displayName: String {
        switch self {
        case .restaurant: "Restaurant"
        case .bar:        "Bar"
        case .brewery:    "Brewery"
        case .foodCart:   "Food Cart"
        }
    }
}

/// Price tier.
enum PriceRange: Int, Codable, CaseIterable {
    case one = 1
    case two = 2
    case three = 3
    case four = 4

    var displayName: String {
        String(repeating: "$", count: rawValue)
    }

    /// Alias for `displayName` — use either in UI code.
    var displayString: String { displayName }
}

/// Tracking status for a restaurant.
enum RestaurantStatus: String, Codable, CaseIterable {
    case wantToGo = "want_to_go"
    case beenThere = "been_there"
    case favorite

    var displayName: String {
        switch self {
        case .wantToGo:  "Want to Go"
        case .beenThere: "Been There"
        case .favorite:  "Favorite"
        }
    }
}

@Model
final class Restaurant {
    #Unique<Restaurant>([\.id])

    /// Supabase-assigned UUID, used as the stable primary key.
    var id: UUID
    var userId: UUID
    var name: String
    var address: String?
    var latitude: Double?
    var longitude: Double?
    var neighborhood: String?
    var city: String
    var website: String?
    var cuisine: String?
    var venueType: VenueType
    var priceRange: PriceRange?
    var status: RestaurantStatus
    var generalNote: String?
    var placeId: String?
    var sourceUrl: String?
    var createdAt: Date
    var updatedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \VisitLog.restaurant)
    var visitLogs: [VisitLog] = []

    init(
        id: UUID = UUID(),
        userId: UUID,
        name: String,
        address: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        neighborhood: String? = nil,
        city: String = "Portland",
        website: String? = nil,
        cuisine: String? = nil,
        venueType: VenueType = .restaurant,
        priceRange: PriceRange? = nil,
        status: RestaurantStatus = .wantToGo,
        generalNote: String? = nil,
        placeId: String? = nil,
        sourceUrl: String? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.neighborhood = neighborhood
        self.city = city
        self.website = website
        self.cuisine = cuisine
        self.venueType = venueType
        self.priceRange = priceRange
        self.status = status
        self.generalNote = generalNote
        self.placeId = placeId
        self.sourceUrl = sourceUrl
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
