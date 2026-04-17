import SwiftUI

struct RestaurantRowView: View {
    let restaurant: Restaurant

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(restaurant.name)
                    .font(.headline)
                Spacer()
                StatusBadgeView(status: restaurant.status)
            }
            HStack(spacing: 6) {
                Label(restaurant.venueType.displayName, systemImage: restaurant.venueType.icon)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let cuisine = restaurant.cuisine, !cuisine.isEmpty {
                    Text("·")
                        .foregroundStyle(.secondary)
                    Text(cuisine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let price = restaurant.priceRange {
                    Text("·")
                        .foregroundStyle(.secondary)
                    Text(price.displayString)
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            if let neighborhood = restaurant.neighborhood, !neighborhood.isEmpty {
                Text(neighborhood)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }
}
