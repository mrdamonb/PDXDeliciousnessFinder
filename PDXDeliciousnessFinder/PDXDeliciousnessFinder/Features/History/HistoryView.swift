import SwiftUI
import SwiftData

/// Tab 2 in `HomeView`'s `TabView`.
private let historyTabTag = 2

/// The two steps of the History `+` flow, as one sheet rather than two chained
/// ones. Switching `activeSheet` from `.pick` to `.addVisit` swaps the presented
/// content in place — there is only ever one UIKit presentation to track, so
/// there's no dismiss-then-present handoff for a later nested sheet (Add
/// Visit's own "View menu" browser) to land on a stale presentation context.
/// Two independent `.sheet` modifiers chaining via `onDismiss` looked like two
/// sheets in sequence but still collapsed when View menu closed (device report,
/// 2026-09-05) — this removes the chain instead of tuning its timing.
private enum HistorySheet: Identifiable {
    case pick
    case addVisit(Restaurant)

    var id: String {
        switch self {
        case .pick: return "pick"
        case .addVisit(let restaurant): return "addVisit-\(restaurant.id)"
        }
    }
}

struct HistoryView: View {
    @Environment(AppState.self) private var appState
    @Query private var logs: [VisitLog]
    @State private var activeSheet: HistorySheet?
    @State private var searchText = ""

    private let userId: UUID

    init(userId: UUID) {
        self.userId = userId
        // @Query rather than a one-shot repository fetch, so a visit arriving by
        // realtime or a foreground pull renders while History is on screen —
        // matching MapView and RestaurantListView. (Review decision, 2026-09-02.)
        _logs = Query(
            filter: #Predicate<VisitLog> { $0.userId == userId },
            sort: \VisitLog.visitedAt,
            order: .reverse
        )
    }

    var body: some View {
        // Computed at the top level of body so @Query and @Observable tracking
        // both fire on change (Story 3.3 precedent).
        let sections = HistoryGrouping.sections(from: logs, matching: searchText)
        let hasAnyVisits = logs.contains { $0.restaurant != nil }

        NavigationStack {
            content(sections: sections, hasAnyVisits: hasAnyVisits)
                .navigationTitle("History")
                .searchable(text: $searchText, prompt: "Restaurants and notes")
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button { activeSheet = .pick } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
        }
        // One sheet, two contents: picking a restaurant swaps `activeSheet` to
        // `.addVisit` in place rather than dismissing and presenting anew. See
        // `HistorySheet` for why — this replaced a dismiss-then-present chain
        // that still let Add Visit's Safari sheet collapse the whole flow.
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .pick:
                PickRestaurantView(userId: userId) { restaurant in
                    activeSheet = .addVisit(restaurant)
                }
            case .addVisit(let restaurant):
                AddVisitView(restaurant: restaurant, markVisited: true, title: "Add Visit")
            }
        }
        // Clear on an actual tab change, not on any disappearance. Pushing a
        // restaurant detail must not discard the query the user just typed.
        .onChange(of: appState.selectedTab) { _, tab in
            if tab != historyTabTag { searchText = "" }
        }
    }

    @ViewBuilder
    private func content(sections: [MonthSection], hasAnyVisits: Bool) -> some View {
        if sections.isEmpty {
            // Tell "no visits yet" apart from "nothing matched your search".
            if hasAnyVisits {
                ContentUnavailableView.search(text: searchText)
            } else {
                emptyState
            }
        } else {
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
