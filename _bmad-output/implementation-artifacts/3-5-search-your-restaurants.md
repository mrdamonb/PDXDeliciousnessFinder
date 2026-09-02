# Story 3.5: Search Your Restaurants

**Epic:** 3 — Find What to Eat Tonight
**Status:** ✅ Done — implemented and reviewed 2026-09-01; **device-verified 2026-09-02**
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

---

## Dev Notes

**Implemented 2026-09-01** (`bmad-build`, separate session), **reviewed the same day** via `bmad-code-review` — four layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor. All four returned; none failed. Full findings in `spec-3-5-search-your-restaurants.md`.

The three traps this story called out in advance were all handled correctly in the original implementation: the top-level `let` in `body`, filtering History logs before grouping, and `localizedStandardContains` over the case-insensitive variant. The review findings were around the edges of those, not in them.

### Two decisions taken by Damon during review

1. **`HistoryViewModel` renders from `ViewState` alone.** The first implementation kept a `logs` cache that the view rendered from directly, leaving the `.loaded` payload dead and `grouped` running twice per load. Now `search(_:)` re-derives `state` on each query change; `logs` remains only as the un-grouped source. `hasAnyVisits` was added so the view can still tell "no visits yet" from "nothing matched".
2. **`ContentUnavailableView.search(text:)` on both tabs.** The bespoke `VStack` search-empty state in `RestaurantListView` was removed. ⚠️ **This narrows an AC**: the List AC asks for an empty state that "offers to clear it", and the system view has no clear button. The intent still holds because `.searchable` renders the system ✕ control in the field itself. **The AC wording should be updated to match** rather than left contradicting the code.

### Fixes applied

| Fix | Where |
|---|---|
| Search survives pushing a detail; clears only on a real tab change | `RestaurantListView`, `HistoryView` |
| Orphan visits filtered before sectioning — no more bare month headers | `HistoryViewModel.grouped` |
| `ViewState` is the single render source | `HistoryViewModel` |
| System search-empty state on both tabs | both views |
| Queries trimmed — whitespace is not a search | both |
| Autocorrect and autocapitalisation off in both fields | both views |
| `prompt:` on both search fields so their scope is discoverable | both views |
| Active search reported even when filters exclude everything | `RestaurantListView` branch order |
| `DateFormatter` hoisted to a `static let`, now locale-driven | `HistoryViewModel` |
| Empty-query guard restored inside `matches(_:_:)` | `RestaurantListView` |

### Still open — needs your hands

**The on-device check this story flagged in advance has not been run.** The Design Notes named `.searchable` coexisting with the `FilterBarView` `.safeAreaInset(edge: .top)` as "the AC most likely to look wrong in practice", to be verified in both the filter bar's collapsed and expanded states. It cannot be settled by reading code, and there is no CLI build for this target.

The three changed files pass `swiftc -parse`, which is **syntax only** — not a type-check, and not a build. **Nothing here has been compiled or run.**

### Deferred

Five items to `deferred-work.md`. The one that matters: **`VisitLogDTO.toModel()` never sets the `restaurant` relationship**, so every visit arriving by sync or realtime is invisible in History — and after an Xcode reinstall, that is all of them. The fix applied here only suppresses the empty month header; it does not make synced visits appear. That deserves its own story.

## Change Log

| Date | Change |
|---|---|
| 2026-09-01 | Story written, ready for dev |
| 2026-09-01 | Implemented via `bmad-build` |
| 2026-09-01 | Code review: 2 decisions resolved, 11 patches applied, 5 deferred, 1 dismissed |

---

## Device Verification, 2026-09-02

Damon ran the targeted cases on his phone. All confirmed:

1. **`.searchable` coexists with the `FilterBarView` safe-area inset.** The filter bar remains visible and usable with the search field revealed. **This closes the AC the story flagged before a line was written** as "the one most likely to look wrong in practice", and it is the only claim in this story that could never be settled by reading code.
2. **Search survives pushing a restaurant detail and popping back.** Confirms the review fix — before it, the List tab discarded the query whenever a result was opened, because `HomeView` owns that tab's `NavigationStack` and the push fired the root's `.onDisappear`.
3. Filter and search apply together; clearing search leaves the filter intact.
4. History finds a visit by a word that appears only in its note.
5. A single space does not empty the list — confirms the trimming patch.

Story closed. Epic 3 complete.
