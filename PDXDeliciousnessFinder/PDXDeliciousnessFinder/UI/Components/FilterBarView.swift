import SwiftUI

// MARK: - FilterCategory

private enum FilterCategory: CaseIterable, Hashable {
    case status, venueType, neighborhood, cuisine, price

    var displayName: String {
        switch self {
        case .status:       "Status"
        case .venueType:    "Venue"
        case .neighborhood: "Neighborhood"
        case .cuisine:      "Cuisine"
        case .price:        "Price"
        }
    }
}

// MARK: - FilterBarView

/// Two-mode filter bar:
///
/// **Category mode** (default) — one chip per filter dimension. Active categories
/// show a count badge. Tapping a chip drills into that category's pills.
///
/// **Expanded mode** — back arrow + pills for the selected category. Tapping a pill
/// toggles it; tapping the back arrow returns to category mode.
///
/// Filter state lives in `AppState` so it persists across Map ↔ List tab switches.
struct FilterBarView: View {
    @Environment(AppState.self) private var appState
    let restaurants: [Restaurant]

    @State private var expandedCategory: FilterCategory?

    // MARK: - Derived options (data-driven)

    private var availableNeighborhoods: [String] {
        Array(Set(restaurants.compactMap(\.neighborhood))).sorted()
    }

    private var availableCuisines: [String] {
        var seen = Set<String>()
        return restaurants
            .compactMap(\.cuisine)
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .filter { seen.insert($0.lowercased()).inserted }
            .sorted()
    }

    // MARK: - Body

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if let category = expandedCategory {
                    expandedContent(for: category)
                } else {
                    categoryChips
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .animation(.spring(duration: 0.22), value: expandedCategory)
        }
        .background(.ultraThinMaterial)
    }

    // MARK: - Category chips (top-level)

    private var categoryChips: some View {
        Group {
            ForEach(FilterCategory.allCases, id: \.self) { category in
                if shouldShow(category) {
                    categoryChip(for: category)
                }
            }
            if appState.hasActiveFilters {
                pillDivider
                clearButton
            }
        }
    }

    private func categoryChip(for category: FilterCategory) -> some View {
        let count = activeCount(for: category)
        let isActive = count > 0

        let accessibilityLabel = count > 0
            ? "\(category.displayName), \(count) active filter\(count == 1 ? "" : "s")"
            : category.displayName

        return Button { expandedCategory = category } label: {
            HStack(spacing: 4) {
                Text(category.displayName)
                    .font(.subheadline.weight(.medium))
                if count > 0 {
                    Text("\(count)")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Color.white.opacity(0.35))
                        .clipShape(Capsule())
                }
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isActive ? Color.pdxAccent : Color.clear)
            .foregroundStyle(isActive ? Color.white : Color.pdxAccent)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.pdxAccent, lineWidth: 1.5))
        }
        .frame(minHeight: 44)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens \(category.displayName.lowercased()) filter options")
    }

    // MARK: - Expanded pills (drill-down)

    @ViewBuilder
    private func expandedContent(for category: FilterCategory) -> some View {
        // Back button
        Button { expandedCategory = nil } label: {
            Image(systemName: "chevron.left")
                .font(.subheadline.weight(.semibold))
                .frame(width: 32, height: 32)
                .background(Color.secondary.opacity(0.15))
                .clipShape(Circle())
                .foregroundStyle(Color.pdxAccent)
        }
        .frame(minHeight: 44)

        pillDivider

        // Pills for the selected category
        switch category {
        case .status:
            ForEach(RestaurantStatus.allCases, id: \.self) { status in
                FilterPillView(
                    label: status.displayName,
                    isActive: appState.activeStatuses.contains(status),
                    color: status.pdxColor
                ) { toggle(status, in: \.activeStatuses) }
            }

        case .venueType:
            ForEach(VenueType.allCases, id: \.self) { venueType in
                FilterPillView(
                    label: venueType.displayName,
                    isActive: appState.activeVenueTypes.contains(venueType),
                    color: .pdxAccent
                ) { toggle(venueType, in: \.activeVenueTypes) }
            }

        case .neighborhood:
            if availableNeighborhoods.isEmpty {
                Text("No neighborhoods set")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
            } else {
                ForEach(availableNeighborhoods, id: \.self) { n in
                    FilterPillView(
                        label: n,
                        isActive: appState.activeNeighborhoods.contains(n),
                        color: .pdxAccent
                    ) { toggle(n, in: \.activeNeighborhoods) }
                }
            }

        case .cuisine:
            if availableCuisines.isEmpty {
                Text("No cuisines set")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
            } else {
                ForEach(availableCuisines, id: \.self) { c in
                    FilterPillView(
                        label: c,
                        isActive: appState.activeCuisines.contains(c),
                        color: .pdxAccent
                    ) { toggle(c, in: \.activeCuisines) }
                }
            }

        case .price:
            ForEach(PriceRange.allCases, id: \.self) { price in
                FilterPillView(
                    label: price.displayString,
                    isActive: appState.activePriceRanges.contains(price),
                    color: .pdxAccent
                ) { toggle(price, in: \.activePriceRanges) }
            }
        }

        // Clear button visible in expanded mode too when filters are active
        if appState.hasActiveFilters {
            pillDivider
            clearButton
        }
    }

    // MARK: - Shared subviews

    private var clearButton: some View {
        Button(action: appState.clearAllFilters) {
            Label("Clear", systemImage: "xmark")
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.secondary.opacity(0.15))
                .foregroundStyle(Color.secondary)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Color.secondary.opacity(0.4), lineWidth: 1.5))
        }
        .frame(minHeight: 44)
    }

    private var pillDivider: some View {
        Divider()
            .frame(height: 20)
            .padding(.horizontal, 2)
    }

    // MARK: - Helpers

    /// Hide Neighborhood/Cuisine chips when no data exists for that dimension.
    private func shouldShow(_ category: FilterCategory) -> Bool {
        switch category {
        case .neighborhood: return !availableNeighborhoods.isEmpty || !appState.activeNeighborhoods.isEmpty
        case .cuisine:      return !availableCuisines.isEmpty || !appState.activeCuisines.isEmpty
        default:            return true
        }
    }

    private func activeCount(for category: FilterCategory) -> Int {
        switch category {
        case .status:       appState.activeStatuses.count
        case .venueType:    appState.activeVenueTypes.count
        case .neighborhood: appState.activeNeighborhoods.count
        case .cuisine:      appState.activeCuisines.count
        case .price:        appState.activePriceRanges.count
        }
    }

    private func toggle<T: Hashable>(
        _ value: T,
        in keyPath: ReferenceWritableKeyPath<AppState, Set<T>>
    ) {
        if appState[keyPath: keyPath].contains(value) {
            appState[keyPath: keyPath].remove(value)
        } else {
            appState[keyPath: keyPath].insert(value)
        }
    }
}
