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
    var state: ViewState<[MonthSection]> = .idle

    func load(repository: any VisitLogRepositoryProtocol) {
        state = .loading
        do {
            let logs = try repository.fetchAllVisits()
            state = .loaded(grouped(logs))
        } catch {
            state = .error(.unknown(underlying: error))
        }
    }

    private func grouped(_ logs: [VisitLog]) -> [MonthSection] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"

        let byMonth = Dictionary(grouping: logs) { log in
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
                return MonthSection(
                    id: formatter.string(from: date),
                    title: formatter.string(from: date),
                    entries: sorted
                )
            }
    }
}
