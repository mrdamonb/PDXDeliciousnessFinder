import Foundation

/// Pure search predicate shared by `RestaurantListView` and `PickRestaurantView`
/// (story 2.8), so the two lists' matching rules cannot drift apart.
enum RestaurantSearch {

    static func matches(_ restaurant: Restaurant, _ query: String) -> Bool {
        // `"abc".localizedStandardContains("")` is false, so an empty query would
        // match nothing rather than everything.
        guard !query.isEmpty else { return true }
        return restaurant.name.localizedStandardContains(query)
            || (restaurant.cuisine?.localizedStandardContains(query) ?? false)
            || (restaurant.neighborhood?.localizedStandardContains(query) ?? false)
    }
}
