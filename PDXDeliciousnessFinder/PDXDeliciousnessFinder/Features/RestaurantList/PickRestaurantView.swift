import SwiftUI
import SwiftData

/// Searchable picker over the user's own restaurants, presented from History's
/// `+` button (story 2.8). Selecting a restaurant opens `AddVisitView` for it.
struct PickRestaurantView: View {
    @Environment(\.dismiss) private var dismiss
    @Query private var restaurants: [Restaurant]
    @State private var searchText = ""
    @State private var showAddRestaurant = false

    /// Reports the choice and closes. The caller presents `AddVisitView` after this
    /// sheet has gone, rather than stacking it on top — see the note on `body`.
    let onSelect: (Restaurant) -> Void

    init(userId: UUID, onSelect: @escaping (Restaurant) -> Void) {
        self.onSelect = onSelect
        _restaurants = Query(
            filter: #Predicate<Restaurant> { $0.userId == userId },
            sort: \Restaurant.name
        )
    }

    /// Deliberately does **not** present `AddVisitView` itself.
    ///
    /// Doing so put three sheets on screen at once — History → picker → Add Visit →
    /// Safari, once "View menu" was tapped — and closing the innermost sheet
    /// collapsed the whole chain back to History, losing the half-entered visit.
    /// Reported from device testing 2026-09-02. The working path elsewhere
    /// (`RestaurantDetailView` → Add Visit → Safari) is only two deep, so the
    /// picker hands the restaurant back and closes, and History presents Add Visit
    /// once this sheet is gone.
    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Log a Visit")
                .navigationBarTitleDisplayMode(.inline)
                .searchable(text: $searchText, prompt: "Name, cuisine, or neighborhood")
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    // Reaching Add Restaurant only from the empty state would strand
                    // the likeliest case: searching for a place not yet on the list.
                    ToolbarItem(placement: .primaryAction) {
                        Button { showAddRestaurant = true } label: {
                            Label("Add Restaurant", systemImage: "plus")
                        }
                    }
                }
        }
        .sheet(isPresented: $showAddRestaurant) {
            AddRestaurantView()
        }
    }

    @ViewBuilder
    private var content: some View {
        // Whitespace is not a search. Untrimmed, a single space matches every
        // multi-word name and no single-word one.
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let searched = query.isEmpty
            ? restaurants
            : restaurants.filter { RestaurantSearch.matches($0, query) }

        if restaurants.isEmpty {
            noRestaurantsState
        } else if !query.isEmpty && searched.isEmpty {
            ContentUnavailableView.search(text: query)
        } else {
            List(searched) { restaurant in
                Button {
                    onSelect(restaurant)
                    dismiss()
                } label: {
                    RestaurantRowView(restaurant: restaurant)
                }
                .buttonStyle(.plain)
            }
            .listStyle(.insetGrouped)
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
                showAddRestaurant = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.pdxAccent)
        }
        .padding()
    }
}
