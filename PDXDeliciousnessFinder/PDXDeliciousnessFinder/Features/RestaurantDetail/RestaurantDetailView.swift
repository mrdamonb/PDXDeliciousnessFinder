import SwiftUI
import SwiftData

struct RestaurantDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let restaurant: Restaurant
    @State private var viewModel = RestaurantDetailViewModel()
    @State private var showEditSheet = false
    @State private var showAddVisitSheet = false
    @State private var showMarkVisitedSheet = false
    @State private var showDeleteConfirmation = false
    @State private var hapticSuccessTrigger = 0

    var body: some View {
        List {
            // MARK: Header — name, status badge, venue/price
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(restaurant.name)
                            .font(.title2.weight(.bold))
                        Spacer()
                        StatusBadgeView(status: restaurant.status)
                        Button { showEditSheet = true } label: {
                            Image(systemName: "pencil")
                                .foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 8) {
                        Label(restaurant.venueType.displayName, systemImage: restaurant.venueType.icon)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        if let price = restaurant.priceRange {
                            Text("·").foregroundStyle(.secondary)
                            Text(price.displayString)
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 4)
            }

            // MARK: Status Actions (Stories 2.4)
            Section("Actions") {
                if restaurant.status == .wantToGo {
                    Button {
                        showMarkVisitedSheet = true
                    } label: {
                        Label("Mark as Visited", systemImage: "checkmark.circle")
                    }
                }

                if restaurant.status == .beenThere || restaurant.status == .favorite {
                    Toggle(isOn: Binding(
                        get: { restaurant.status == .favorite },
                        set: { _ in
                            Task {
                                await viewModel.toggleFavorite(
                                    restaurant: restaurant,
                                    repo: appState.restaurantRepository
                                )
                                hapticSuccessTrigger += 1
                            }
                        }
                    )) {
                        Label("Favorite", systemImage: "star.fill")
                            .foregroundStyle(restaurant.status == .favorite ? .red : .primary)
                    }

                    Button {
                        showAddVisitSheet = true
                    } label: {
                        Label("Add Another Visit", systemImage: "plus.circle")
                    }
                }
            }

            // MARK: Details (Story 2.3 field display)
            Section("Details") {
                if let cuisine = restaurant.cuisine {
                    LabeledContent("Cuisine", value: cuisine)
                }
                if let address = restaurant.address {
                    LabeledContent("Address", value: address)
                }
                if let neighborhood = restaurant.neighborhood {
                    LabeledContent("Neighborhood", value: neighborhood)
                }
                LabeledContent("City", value: restaurant.city)
                if let website = restaurant.website, !website.isEmpty {
                    LabeledContent("Website") {
                        Link(website, destination: URL(string: website) ?? URL(string: "https://example.com")!)
                            .lineLimit(1)
                    }
                }
            }

            // MARK: General Note
            if let note = restaurant.generalNote, !note.isEmpty {
                Section("Note") {
                    Text(note)
                        .font(.body)
                }
            }

            // MARK: Visit History (Story 2.5)
            let visits = restaurant.visitLogs.sorted { $0.visitedAt > $1.visitedAt }
            if !visits.isEmpty {
                Section("Visits (\(visits.count))") {
                    ForEach(visits) { visit in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(visit.visitedAt, style: .date)
                                .font(.subheadline.weight(.medium))
                            if let note = visit.note, !note.isEmpty {
                                Text(note)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            // MARK: Error state
            if let error = viewModel.actionState.errorValue {
                Section {
                    Text(error.localizedDescription)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }

            // MARK: Delete (Story 2.6)
            Section {
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    HStack {
                        Spacer()
                        Text("Delete Restaurant")
                        Spacer()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: hapticSuccessTrigger)
        .sheet(isPresented: $showEditSheet) {
            EditRestaurantView(restaurant: restaurant)
        }
        .sheet(isPresented: $showMarkVisitedSheet) {
            AddVisitView(restaurant: restaurant, markVisited: true)
        }
        .sheet(isPresented: $showAddVisitSheet) {
            AddVisitView(restaurant: restaurant, markVisited: false)
        }
        .confirmationDialog(
            "Delete \"\(restaurant.name)\"?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task {
                    let deleted = await viewModel.delete(
                        restaurant: restaurant,
                        repo: appState.restaurantRepository
                    )
                    if deleted { dismiss() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently remove the restaurant and all its visit logs.")
        }
    }
}
