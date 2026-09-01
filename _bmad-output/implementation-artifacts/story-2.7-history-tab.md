# Story 2.7: History Tab — Visit Journal

**Epic:** 2 — Your Portland Food Journal  
**Status:** 🔲 Backlog  
**Effort:** Small (single screen, no backend changes, data already exists)

---

## User Story

As a Portland food enthusiast,
I want a History tab that shows all my visit log entries in reverse-chronological order grouped by month,
So that I can quickly see where I've eaten recently without hunting through individual restaurant cards.

---

## Acceptance Criteria

**Given** I open the app  
**When** I look at the tab bar  
**Then** I see three tabs: Map, List, and History — in that order — each with an appropriate SF Symbol icon (History uses `fork.knife`)

---

**Given** I tap the History tab  
**When** my visit log has entries  
**Then** I see a flat list of visit entries grouped under month/year section headers ("June 2026", "May 2026"…) in descending order — most recent month first, most recent entry first within each month

---

**Given** a visit entry in the History list  
**When** I look at the row  
**Then** I see:
- Restaurant name (primary text)
- Neighborhood as subtitle (e.g., "Buckman") — omitted if not set
- Human-readable date (e.g., "June 4") in secondary color
- Venue type icon matching the existing map pin iconography
- Red star badge if the restaurant status is `favorite` (reuse existing `StatusBadgeView` or equivalent — must match the red/star treatment used elsewhere in the app)
- Visit note snippet (first line, truncated) if a note exists on that visit entry — omitted if note is nil

---

**Given** I tap any row in the History list  
**When** the tap registers  
**Then** I am pushed to `RestaurantDetailView` for that restaurant, where I can edit notes, log another visit, or take any other existing action

---

**Given** I open the History tab and have never logged a visit  
**When** the tab loads  
**Then** I see a warm empty state (no blank white screen) with a short encouraging message — e.g., "Your food adventures will show up here. Log your first visit to get started." — and no list content

---

**Given** the History tab is visible  
**When** the view appears  
**Then** the list is fetched fresh from SwiftData (fetch-on-appear) — no persistent Realtime subscription needed for this view

---

## Technical Notes

### New method required on `VisitLogRepository`

Add `fetchAllVisits() throws -> [VisitLog]` — fetches all `VisitLog` records for the current user across all restaurants, sorted by `visitedAt` descending. No `restaurantId` filter. Must conform to the `VisitLogRepositoryProtocol` (add method to protocol as well).

```swift
func fetchAllVisits() throws -> [VisitLog]
```

### ViewModel grouping

`HistoryViewModel` groups the flat array into `[MonthSection]` using:

```swift
Dictionary(grouping: logs) { log in
    Calendar.current.dateComponents([.year, .month], from: log.visitedAt)
}
```

Sort sections descending by year then month. Sort entries within each section descending by `visitedAt`.

### Data available via existing relationship

`VisitLog.restaurant: Restaurant?` is already populated by SwiftData — access `restaurant.name`, `restaurant.neighborhood`, `restaurant.venueType`, `restaurant.status` directly. No extra fetch needed.

### Section header format

Use `DateFormatter` with `"MMMM yyyy"` format applied to the first entry's `visitedAt` in each section group.

### Architecture constraints (non-negotiable)

| Constraint | Requirement |
|---|---|
| ARCH-8 | `HistoryViewModel` uses `ViewState<[MonthSection]>` — no raw `isLoading: Bool` |
| ARCH-12 | New files live in `Features/History/` — `HistoryView.swift`, `HistoryViewModel.swift` |
| ARCH-13 | Data access via `VisitLogRepository.fetchAllVisits()` — no direct SwiftData queries in the ViewModel |

### Tab bar change

Add History as the third `Tab` entry in the app's `TabView` (likely `HomeView.swift` or the root tab container). Tab order: Map → List → History.

---

## Files to Create

| File | Purpose |
|---|---|
| `Features/History/HistoryView.swift` | Tab root view — List with section headers, rows, empty state |
| `Features/History/HistoryViewModel.swift` | Fetches all visits, groups into `[MonthSection]`, exposes `ViewState<[MonthSection]>` |

## Files to Modify

| File | Change |
|---|---|
| `Core/Storage/Repositories/VisitLogRepository.swift` | Add `fetchAllVisits() throws -> [VisitLog]` |
| `Core/Storage/Repositories/VisitLogRepositoryProtocol.swift` | Add `fetchAllVisits()` to protocol |
| `HomeView.swift` (or root tab container) | Add History tab entry |

---

## Out of Scope

- Filtering or searching within the History tab (defer to future story if needed)
- Deleting visit entries from the History tab (use RestaurantDetail)
- Pull-to-refresh (fetch-on-appear is sufficient for a local SwiftData view)
- Realtime subscription for live updates
