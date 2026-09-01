# Story 3.5: Search Your Restaurants

**Epic:** 3 — Find What to Eat Tonight
**Status:** 🔲 Ready for Dev
**Effort:** Small–Medium (two existing views, no backend, no schema)
**Blocks:** Story 2.8 (the restaurant picker *is* this search), and Phase 1 of the S6 web parity spec

---

## User Story

As a Portland food enthusiast,
I want to type a few letters and find a place in my own list,
So that I can reach a restaurant directly instead of scrolling or assembling filters to get to it.

---

## Context

Verified 2026-09-01: **neither surface has free-text search.** `RestaurantListView` has filters and a sort menu and no `.searchable`. The only search in the codebase is `search-places`, which queries Google for a restaurant to **add** — not the list you already own.

Story 2.7 explicitly deferred this: its Out of Scope reads *"Filtering or searching within the History tab (defer to future story if needed)."* This is that story.

---

## Acceptance Criteria

**Given** I am on the List tab
**When** I reach for search
**Then** a search field is available and the filter bar is still visible and usable — neither displaces the other

---

**Given** I type into search
**When** each character lands
**Then** the list narrows live against restaurant **name**, **cuisine**, and **neighborhood** — case- and diacritic-insensitive, matching any substring, not prefix only

---

**Given** I have filters active and then type a search term
**When** both are set
**Then** results satisfy **both** — search narrows within the filtered set; it never clears, overrides, or is overridden by the filters

---

**Given** my search matches nothing
**When** the list is empty
**Then** the empty state names the search term as the cause and offers to clear it, and is visibly distinct from the existing "No restaurants match your current filters" state

---

**Given** I clear the search field
**When** it empties
**Then** the list returns to the filtered set with every filter still intact

---

**Given** I am on the History tab
**When** I search
**Then** matching runs over restaurant name **and the visit note text**, so I can find a visit by something I wrote about it

---

**Given** I search on the History tab and some months have no matches
**When** results render
**Then** empty month sections do not appear — no bare "July 2026" header with nothing under it

---

**Given** I leave a tab and come back
**When** the view reappears
**Then** the search field is empty — search must never persist as an invisible filter that silently hides data on a later visit

---

## Technical Notes

### The one that will bite: keep filtering at the top level of `body`

`RestaurantListView` deliberately computes its filtered set as a top-level `let` inside `body`:

```swift
let filtered = restaurants.filter { appState.isFiltered($0) }
```

Story 3.3's Dev Notes record why: `@Observable` change tracking only fires if the observable read happens during `body` evaluation. Burying it in a nested closure or a helper breaks live updates on filter change.

**Search must follow the same pattern.** Compute the searched set as another top-level `let` in `body`, chained after `filtered`. Do not extract it into a computed property or a ViewModel.

### Matching

Use `localizedStandardContains(_:)`, not `localizedCaseInsensitiveContains(_:)`. It gives case-, diacritic-, and width-insensitivity in one call, which is what the AC asks for. `cuisine` and `neighborhood` are optionals — a nil field simply does not match, it is not a failure.

```swift
func matches(_ r: Restaurant, _ q: String) -> Bool {
    guard !q.isEmpty else { return true }
    return r.name.localizedStandardContains(q)
        || (r.cuisine?.localizedStandardContains(q) ?? false)
        || (r.neighborhood?.localizedStandardContains(q) ?? false)
}
```

### Search state must be cleared on disappear

`.searchable` bound to `@State private var searchText` will **survive a tab switch**, because `TabView` keeps tab content alive. That directly violates the last AC. Clear it explicitly in `.onDisappear`, and verify by switching tabs rather than assuming.

### `.searchable` versus the filter bar

`FilterBarView` is attached via `.safeAreaInset(edge: .top)`. `.searchable` installs into the navigation bar. They should coexist, but this is the AC most likely to look wrong in practice — check it on a device, and check it with the filter bar in both its collapsed and expanded states.

### History: filter before grouping

`HistoryViewModel.grouped(_:)` builds `[MonthSection]` from the full log set. If search is applied after grouping, empty sections render as bare headers. **Apply the predicate to the logs, then group.** The View passes the query down; the grouping function never sees an unfiltered set.

History matches on `log.restaurant?.name` and `log.note` — note text is the point of searching History at all.

### Architecture constraints (non-negotiable)

| Constraint | Requirement |
|---|---|
| ARCH-8 | `HistoryViewModel` stays on `ViewState<[MonthSection]>` — do not introduce a `isSearching: Bool` |
| ARCH-12 | No new `Core/` dependencies on `Features/` |
| ARCH-13 | History data still comes from `VisitLogRepository.fetchAllVisits()` — no direct SwiftData queries added to the ViewModel |

### Deliberately not in this story: search on the Map tab

Damon asked for search on the list and history pages. iOS map filtering runs through `appState`, so adding search there would mean promoting search into shared state — a bigger change with a different failure mode. **This is a decision, not an oversight.** Note that the web app will behave differently here: web holds one `filterState` for both map and list, so adding `query` to it narrows the pins for free. That asymmetry is accepted and recorded in the S6 spec.

---

## Files to Modify

| File | Change |
|---|---|
| `Features/RestaurantList/RestaurantListView.swift` | `.searchable`, top-level searched `let`, clear on disappear, search-specific empty state |
| `Features/History/HistoryView.swift` | `.searchable`, pass query to the ViewModel, clear on disappear |
| `Features/History/HistoryViewModel.swift` | Accept a query; filter logs **before** grouping; drop empty sections |

No new files. No repository changes. No schema changes.

---

## Out of Scope

- Search on the Map tab (see above — deliberate)
- Server-side or full-text search. This is a personal-scale list; in-memory filtering is correct and any Postgres FTS work here is premature
- Fuzzy or typo-tolerant matching. Substring is enough and false positives are worse than a second keystroke
- Searching friends' lists (Epic 5)
- Search history, recent searches, or suggestions
- Persisting the query across launches — explicitly forbidden by the last AC

---

## Verification

- Build and run on device
- List tab: type a partial name, a cuisine, and a neighborhood — each narrows the list
- Set a filter, then search — both apply; clear search, filter survives
- Search for nonsense — empty state names the query and offers to clear it
- History tab: search a word that exists only in a visit **note** — the visit is found
- History tab: search a term matching only one month — no empty month headers appear
- Switch tabs away and back — search field is empty, full list restored
