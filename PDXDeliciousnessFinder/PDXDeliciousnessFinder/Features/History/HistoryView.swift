import SwiftUI

struct HistoryView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = HistoryViewModel()
    @State private var showAddRestaurant = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("History")
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button { showAddRestaurant = true } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
        }
        .sheet(isPresented: $showAddRestaurant) {
            AddRestaurantView()
        }
        .onAppear {
            viewModel.load(repository: appState.visitLogRepository)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .loaded(let sections) where sections.isEmpty:
            emptyState

        case .loaded(let sections):
            List {
                ForEach(sections) { section in
                    Section(section.title) {
                        ForEach(section.entries) { log in
                            if let restaurant = log.restaurant {
                                NavigationLink(destination: RestaurantDetailView(restaurant: restaurant)) {
                                    HistoryRowView(log: log, restaurant: restaurant)
                                }
                            }
                        }
                    }
                }
            }

        case .error:
            ContentUnavailableView(
                "Couldn't Load History",
                systemImage: "exclamationmark.triangle",
                description: Text("Try again later.")
            )
        }
    }

    private var emptyState: some View {
        ContentUnavailableView(
            "No Visits Yet",
            systemImage: "fork.knife",
            description: Text("Your food adventures will show up here. Log your first visit to get started.")
        )
    }
}

// MARK: - Row

private struct HistoryRowView: View {
    let log: VisitLog
    let restaurant: Restaurant

    private var formattedDate: String {
        log.visitedAt.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: restaurant.venueType.icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(restaurant.name)
                        .font(.body)
                    Spacer()
                    if restaurant.status == .favorite {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(Color.pdxStatusFav)
                    }
                }
                if let neighborhood = restaurant.neighborhood {
                    Text(neighborhood)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let note = log.note, !note.isEmpty {
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Text(formattedDate)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
