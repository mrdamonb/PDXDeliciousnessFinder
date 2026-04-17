import SwiftUI
import SwiftData

private enum ListSortOrder {
    case recent, alphabetical
}

struct RestaurantListView: View {
    @Environment(AppState.self) private var appState
    @Query private var restaurants: [Restaurant]
    @State private var showAddSheet = false
    @State private var sortOrder: ListSortOrder = .recent

    init(userId: UUID) {
        _restaurants = Query(
            filter: #Predicate<Restaurant> { $0.userId == userId },
            sort: \Restaurant.updatedAt,
            order: .reverse
        )
    }

    var body: some View {
        // Compute filtered + sorted list at top level so @Observable tracking fires on filter changes.
        let filtered = restaurants.filter { appState.isFiltered($0) }
        let sorted: [Restaurant] = sortOrder == .alphabetical
            ? filtered.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            : filtered   // @Query already returns by updatedAt descending

        Group {
            if restaurants.isEmpty {
                noRestaurantsState
            } else if sorted.isEmpty {
                noResultsState
            } else {
                list(sorted)
            }
        }
        .navigationTitle("My List")
        .safeAreaInset(edge: .top) {
            FilterBarView(restaurants: restaurants)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Menu {
                    Button {
                        sortOrder = .recent
                    } label: {
                        Label("Recently Added", systemImage: sortOrder == .recent ? "checkmark" : "clock")
                    }
                    Button {
                        sortOrder = .alphabetical
                    } label: {
                        Label("Alphabetical", systemImage: sortOrder == .alphabetical ? "checkmark" : "textformat.abc")
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddRestaurantView()
        }
    }

    // MARK: - Subviews

    private func list(_ filtered: [Restaurant]) -> some View {
        List {
            ForEach(filtered) { restaurant in
                NavigationLink(value: restaurant) {
                    RestaurantRowView(restaurant: restaurant)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(for: Restaurant.self) { restaurant in
            RestaurantDetailView(restaurant: restaurant)
        }
    }

    private var noRestaurantsState: some View {
        VStack(spacing: 16) {
            Image(systemName: "fork.knife.circle")
                .font(.system(size: 64))
                .foregroundStyle(Color.pdxAccent.opacity(0.6))
            Text("No restaurants yet")
                .font(.title2.weight(.semibold))
            Text("Add your first Portland spot to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Add Restaurant") {
                showAddSheet = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.pdxAccent)
        }
        .padding()
    }

    private var noResultsState: some View {
        VStack(spacing: 16) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 64))
                .foregroundStyle(Color.pdxAccent.opacity(0.6))
            Text("No matches")
                .font(.title2.weight(.semibold))
            Text("No restaurants match your current filters.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Clear Filters") {
                appState.clearAllFilters()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.pdxAccent)
        }
        .padding()
    }
}
