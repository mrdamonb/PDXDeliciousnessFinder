import SwiftUI
import SwiftData

private enum ListSortOrder {
    case recent, alphabetical
}

/// Tab 1 in `HomeView`'s `TabView`.
private let listTabTag = 1

struct RestaurantListView: View {
    @Environment(AppState.self) private var appState
    @Query private var restaurants: [Restaurant]
    @State private var showAddSheet = false
    @State private var sortOrder: ListSortOrder = .recent
    @State private var searchText = ""

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
        // Whitespace is not a search. Untrimmed, a single space matches every
        // multi-word name and no single-word one.
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let searched: [Restaurant] = query.isEmpty
            ? sorted
            : sorted.filter { RestaurantSearch.matches($0, query) }

        Group {
            if restaurants.isEmpty {
                noRestaurantsState
            } else if !query.isEmpty && searched.isEmpty {
                // Checked before the filter state so a search that finds nothing
                // is never masked by filters that also exclude everything.
                ContentUnavailableView.search(text: query)
            } else if sorted.isEmpty {
                noResultsState
            } else {
                list(searched)
            }
        }
        .navigationTitle("My List")
        .searchable(text: $searchText, prompt: "Name, cuisine, or neighborhood")
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
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
        // Clear on an actual tab change, not on any disappearance. This view is
        // the root content of HomeView's NavigationStack, so `.onDisappear` also
        // fires when a restaurant detail is pushed — which discarded the query
        // the moment the user opened a result.
        .onChange(of: appState.selectedTab) { _, tab in
            if tab != listTabTag { searchText = "" }
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
