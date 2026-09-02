import Foundation

struct MonthSection: Identifiable {
    let id: String
    let title: String
    let entries: [VisitLog]
}

/// Pure grouping for the History tab.
///
/// This was a `HistoryViewModel` holding `ViewState<[MonthSection]>` back when
/// History fetched through the repository. Story 1.5's review moved the view to
/// `@Query`, which is synchronous — there is no loading or error state left to
/// represent, which is why `RestaurantListView` and `MapView` carry none either.
/// What remains is a pure function, so it lives as one.
enum HistoryGrouping {

    /// Month headers are user-visible, so the format follows the user's locale
    /// rather than a hardcoded English pattern. Built once: this runs on every
    /// keystroke and `DateFormatter` init is expensive.
    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMMMy")
        return formatter
    }()

    static func sections(from logs: [VisitLog], matching query: String) -> [MonthSection] {
        // Whitespace is not a search. Without trimming, a single space matches
        // every multi-word restaurant name and no single-word one.
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        // A visit whose `restaurant` relationship is nil cannot be rendered —
        // the row builder drops it — so admitting one here would produce a month
        // header with nothing beneath it. Filter before sectioning.
        //
        // Both inbound paths hydrate the relationship as of story 1.5, so this
        // should rarely exclude anything. It stays as the guard for the one case
        // still possible: a visit whose restaurant has not reached this device.
        let renderable = logs.filter { $0.restaurant != nil }

        let matchingLogs: [VisitLog]
        if trimmed.isEmpty {
            matchingLogs = renderable
        } else {
            matchingLogs = renderable.filter { log in
                (log.restaurant?.name.localizedStandardContains(trimmed) ?? false)
                    || (log.note?.localizedStandardContains(trimmed) ?? false)
            }
        }

        let calendar = Calendar.current
        let byMonth = Dictionary(grouping: matchingLogs) { log in
            calendar.dateComponents([.year, .month], from: log.visitedAt)
        }

        return byMonth
            .sorted { a, b in
                let ay = a.key.year ?? 0, am = a.key.month ?? 0
                let by = b.key.year ?? 0, bm = b.key.month ?? 0
                return ay == by ? am > bm : ay > by
            }
            .map { key, entries in
                let date = calendar.date(from: key) ?? .now
                let sorted = entries.sorted { $0.visitedAt > $1.visitedAt }
                let title = monthFormatter.string(from: date)
                return MonthSection(id: title, title: title, entries: sorted)
            }
    }
}
