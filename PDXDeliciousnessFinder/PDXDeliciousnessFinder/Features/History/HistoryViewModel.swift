import Foundation
import Observation

struct MonthSection: Identifiable {
    let id: String
    let title: String
    let entries: [VisitLog]
}

@Observable
@MainActor
final class HistoryViewModel {
    /// The single source for what History renders. `.loaded` always carries the
    /// sections for the *current* query — a query change re-derives this rather
    /// than the view rendering from a separate cache.
    /// (Code review 2026-09-01, decision 1.)
    var state: ViewState<[MonthSection]> = .idle

    /// Whether the last load returned any *renderable* visit, independent of the
    /// active query. Lets the view tell "no visits yet" apart from "nothing
    /// matched your search" now that `state` only ever holds searched sections.
    private(set) var hasAnyVisits = false

    /// Raw visits from the last successful load, retained so a query change
    /// re-groups without re-fetching. Never rendered directly.
    private var logs: [VisitLog] = []
    private var query = ""

    /// Month headers are user-visible, so the format follows the user's locale
    /// rather than a hardcoded English pattern. Built once: `grouped` now runs
    /// on every query change, and `DateFormatter` init is expensive.
    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMMMy")
        return formatter
    }()

    func load(repository: any VisitLogRepositoryProtocol) {
        state = .loading
        do {
            let fetched = try repository.fetchAllVisits()
            logs = fetched
            hasAnyVisits = fetched.contains { $0.restaurant != nil }
            state = .loaded(grouped(fetched, matching: query))
        } catch {
            state = .error(.unknown(underlying: error))
        }
    }

    /// Re-derives `state` for a new query. A no-op unless a load has already
    /// succeeded, so typing can never push `.idle`, `.loading` or `.error`
    /// into `.loaded`.
    func search(_ newQuery: String) {
        query = newQuery
        guard case .loaded = state else { return }
        state = .loaded(grouped(logs, matching: newQuery))
    }

    private func grouped(_ logs: [VisitLog], matching query: String = "") -> [MonthSection] {
        // Whitespace is not a search. Without trimming, a single space matches
        // every multi-word restaurant name and no single-word one.
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        // A visit whose `restaurant` relationship is nil cannot be rendered —
        // the row builder drops it — so admitting one here would produce a month
        // header with nothing beneath it. Filter before sectioning.
        //
        // Orphans are reachable: only `AddVisitView` sets the relationship, so
        // every visit arriving via `pullFromRemote` or a realtime insert has a
        // nil restaurant. See deferred-work.md — the real fix belongs in
        // `VisitLogDTO.toModel()`; this only stops the empty header.
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
                let title = Self.monthFormatter.string(from: date)
                return MonthSection(id: title, title: title, entries: sorted)
            }
    }
}
