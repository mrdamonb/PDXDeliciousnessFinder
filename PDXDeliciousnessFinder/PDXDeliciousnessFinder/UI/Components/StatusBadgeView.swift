import SwiftUI

struct StatusBadgeView: View {
    let status: RestaurantStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.pdxColor.opacity(0.15))
            .foregroundStyle(status.pdxColor)
            .clipShape(Capsule())
    }
}

// MARK: - Display extensions

extension RestaurantStatus {
    var icon: String {
        switch self {
        case .wantToGo: "bookmark"
        case .beenThere: "checkmark.circle"
        case .favorite: "star.fill"
        }
    }
}

extension VenueType {
    var icon: String {
        switch self {
        case .restaurant: "fork.knife"
        case .bar: "wineglass"
        case .brewery: "mug.fill"
        case .foodCart: "storefront.fill"
        }
    }
}

