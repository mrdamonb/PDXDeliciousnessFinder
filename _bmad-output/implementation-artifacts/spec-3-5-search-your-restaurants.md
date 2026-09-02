---
title: 'Search Your Restaurants'
type: 'feature'
created: '2026-09-01'
status: 'in-progress'
review_loop_iteration: 0
context: []
baseline_commit: 'bf7c13016c15020ca0332a154a4bcb366ace04c3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Neither the List tab nor the History tab has free-text search — users must scroll or assemble filters to reach a restaurant they already own, and visit notes on History aren't searchable at all.

**Approach:** Add `.searchable` to both views, computing the searched set as a top-level `let` in `body` (preserving `@Observable` change tracking per Story 3.3's precedent), filtering History logs before grouping into month sections, and clearing search state on `.onDisappear` in both.

## Boundaries & Constraints

**Always:** Compute filtered/searched sets as top-level `let`s in `body`, never in a nested closure or computed property (required for `@Observable` tracking). Use `localizedStandardContains(_:)` for matching. Search narrows within the active filter set; it never clears, overrides, or is overridden by filters. Clear search text via `.onDisappear` on both views. In History, filter logs before grouping so empty month sections never render. Keep `HistoryViewModel` on `ViewState<[MonthSection]>` (ARCH-8) and sourced from `VisitLogRepository.fetchAllVisits()` (ARCH-13); no new `Core/` → `Features/` dependencies (ARCH-12).

**Ask First:** None — story is fully scoped.

**Never:** Search on the Map tab (deliberate — different filter-state architecture, see story notes). Server-side or full-text search. Fuzzy/typo-tolerant matching. Search history, recent searches, or suggestions. Persisting the query across launches or tab switches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List: type query | Type "thai" on List tab, no filters active | List narrows live to name/cuisine/neighborhood matches; filter bar stays visible | N/A |
| List: filter + search combined | Status filter active, then type a query | Results satisfy both filter AND search simultaneously | N/A |
| List: no matches | Query matches nothing | Empty state names the query, offers "Clear Search" — visually distinct from the existing filter "No matches" state | N/A |
| List: clear search | Search field cleared | List returns to filtered set, all filters still intact | N/A |
| History: note match | Query matches only a visit's note text | That visit's row appears under its correct month | N/A |
| History: empty months | Query matches nothing in some months | Those month sections are omitted entirely — no bare headers | N/A |
| Tab switch | Leave a tab with an active search, return | Search field is empty; full (filtered) list is restored | N/A |

</frozen-after-approval>

## Code Map

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift` -- `body` (L22-70); existing top-level `let filtered = restaurants.filter { appState.isFiltered($0) }` at L24 with a `sorted` derivation at L25-27 — chain the searched `let` after this; `FilterBarView` via `.safeAreaInset(edge: .top)` at L39-41; `.navigationTitle("My List")` at L38 — attach `.searchable` alongside it; row rendering in `list(_:)` at L74-86; empty states `noRestaurantsState` (L88-106, `restaurants.isEmpty`) and `noResultsState` (L108-126, `sorted.isEmpty` with "Clear Filters" calling `appState.clearAllFilters()`) — branch logic at L29-37. No existing `.searchable` or search `@State`.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift` -- `body` (L8-26) wraps `content` in `NavigationStack` (L9) with `.navigationTitle("History")` (L11) and `.toolbar` (L18) — attach `.searchable` after these; `MonthSection` rendering switches on `viewModel.state` (L28-60), loaded case at L38-51 (`List { ForEach(sections) { Section(section.title) { ForEach(section.entries) ... } } }`); data loads via `.onAppear { viewModel.load(repository:) }` (L23-25) — **no `.onDisappear` exists yet**, add one; `emptyState` (L62-68, `ContentUnavailableView`) covers true-empty only — a distinct no-search-results state is needed. No existing `.searchable` or search `@State`.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryViewModel.swift` -- `grouped(_:)` at L25 (`private func grouped(_ logs: [VisitLog]) -> [MonthSection]`); `load(repository: any VisitLogRepositoryProtocol)` at L15 calls `try repository.fetchAllVisits()` at L18; `state: ViewState<[MonthSection]> = .idle` at L13, set to `.loading`/`.loaded(grouped(logs))`/`.error(.unknown(underlying:))`.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/ViewState.swift` -- `enum ViewState<T> { case idle, loading, loaded(T), error(AppError) }` (L5-25) plus `isLoading`/`loadedValue`/`errorValue` helpers.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Models/Restaurant.swift` -- `name: String` (L58, non-optional), `cuisine: String?` (L65), `neighborhood: String?` (L62).
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Models/VisitLog.swift` -- `note: String?` (L12), `restaurant: Restaurant?` (L15).

## Tasks & Acceptance

**Execution:**
- [x] `Features/RestaurantList/RestaurantListView.swift` -- Add `@State private var searchText = ""`; attach `.searchable(text: $searchText)`; compute `let searched = filtered.filter { matches($0, searchText) }` (or apply directly to `sorted`, matching existing chain) as a top-level `let` in `body`; add a private `matches(_:_:)` helper using `localizedStandardContains` over `name`, `cuisine`, `neighborhood`; pass `searched` into `list(_:)`; add `.onDisappear { searchText = "" }`; add a new empty state for `searched.isEmpty && !filtered.isEmpty` that names `searchText` and offers "Clear Search", distinct from `noResultsState` -- covers I/O rows 1-4
- [x] `Features/History/HistoryViewModel.swift` -- Modify `grouped(_:)` (or add a query parameter) to filter `logs` by `log.restaurant?.name` and `log.note` via `localizedStandardContains` **before** building `[MonthSection]`, so months with zero matches are never constructed -- covers I/O row 6
- [x] `Features/History/HistoryView.swift` -- Add `@State private var searchText = ""`; attach `.searchable(text: $searchText)` on the `NavigationStack` content; pass `searchText` down to the view model's (now query-aware) grouping call; add `.onDisappear { searchText = "" }`; add an empty state distinguishing zero-search-results from true-empty -- covers I/O rows 5-7

**Acceptance Criteria:**
- Given the List tab with an active status filter, when I type a search term, then results satisfy both the filter and the search simultaneously, and clearing search alone restores the filtered set
- Given a List search matching nothing, when the list renders, then the empty state names the search term and offers to clear it, visibly distinct from the filter empty state
- Given I search on the History tab for text that appears only in a visit note, when results render, then that visit appears correctly grouped under its month
- Given a History search term matches nothing in some months, when results render, then those month headers do not appear at all
- Given I leave a tab with an active search and return to it, when the view reappears, then the search field is empty and the full (filtered) list is shown

## Design Notes

Reuse one matching approach (`localizedStandardContains`) across both views with different field sets — List: name/cuisine/neighborhood; History: restaurant name/note. `.searchable` installs into the navigation bar and should coexist with `RestaurantListView`'s `.safeAreaInset` filter bar, but the story flags this as the AC most likely to look wrong in practice — verify on-device in both the filter bar's collapsed and expanded states.

## Verification

**Manual checks (no CLI test suite for this iOS app):**
- List tab: type a partial name, a cuisine, and a neighborhood — each narrows the list live
- Set a filter, then search — both apply; clear search, filter survives
- Search for nonsense on the List tab — empty state names the query and offers to clear it
- History tab: search a word that exists only in a visit note — the visit is found under its month
- History tab: search a term matching only one month — no empty month headers appear elsewhere
- Switch tabs away and back on both List and History — search field is empty, full list restored

### Review Findings

Code review 2026-09-01. Four layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor. All four returned; none failed. Severities set by the parent after reading the code at each location, not from the diff hunks.

- [x] [Review][Decision] **RESOLVED 2026-09-01 — option (b): recompute sections into `state` on query change, so `ViewState` is the single render source.** Damon's call. Becomes a patch. Original finding: **`HistoryViewModel` now has two sources of truth; the `ViewState` payload is dead in the render path** — `load()` computes `grouped(fetchedLogs)` into `state`, but `body` renders `searched` from the separate `logs` cache and uses the `.loaded` payload only for the `sections.isEmpty` test. `grouped` therefore runs twice per load. The letter of ARCH-8 holds (no `isSearching: Bool`), but the view no longer renders what `ViewState` carries. Options: (a) keep the cache and accept it with a comment, (b) recompute sections into `state` on query change so `ViewState` stays the single render source, (c) derive the emptiness test from `logs.isEmpty` instead. Sources: blind-hunter+edge-case-hunter+verification-gap+acceptance-auditor.
- [x] [Review][Decision] **RESOLVED 2026-09-01 — option (a): adopt `ContentUnavailableView.search(text:)` on both surfaces and drop the bespoke `VStack` state.** Damon's call. Becomes a patch. ⚠️ **This narrows a written AC:** the story's List AC says the empty state "names the search term as the cause **and offers to clear it**", and `ContentUnavailableView.search(text:)` names the term but carries no clear button. The intent is still met because `.searchable` renders the system clear (✕) control in the search field itself, which is the standard iOS affordance and the reason Apple's own state omits one. The AC wording should be updated to say so rather than left contradicting the code. Original finding: **The two no-results states diverge, and History offers no way out** — List hand-rolls a `VStack` with a prominent "Clear Search" button; History uses the system `ContentUnavailableView.search(text:)`, which names the term but carries no clear affordance. The story's Design Notes asked for one reused approach across both views. Options: (a) adopt `ContentUnavailableView.search` on both and drop the bespoke state, (b) add a clear action to History, (c) accept the split deliberately. Sources: blind-hunter+acceptance-auditor.

- [ ] [Review][Patch] **List-tab search is wiped when you open a restaurant, not just on tab switch** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift:77] — `HomeView.swift:23` owns the `NavigationStack`; `RestaurantListView` is its root content, so pushing `RestaurantDetailView` fires the root's `.onDisappear` and clears the query. Type "thai", tap a result, tap back: the search is gone. `HistoryView` is immune because its `.onDisappear` sits outside its own `NavigationStack`, so the two tabs behave oppositely for the same gesture. The AC scopes clearing to tabs. Verified by reading `HomeView.swift`. **high**
- [ ] [Review][Patch] **A note-only match on a visit with no restaurant relationship renders a bare month header** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryViewModel.swift:45] — the predicate matches `log.note` independently of the relationship, but `HistoryView.swift:55` gates each row on `if let restaurant = log.restaurant`. A section whose only match is an orphan renders a header with zero rows, and because `searched` is non-empty the no-results branch does not fire either. Directly violates the AC "empty month sections do not appear". **high**
- [ ] [Review][Patch] **Neither query is trimmed, so a single space is treated as a real search** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift:29] — both sites guard only on `.isEmpty`. `localizedStandardContains(" ")` then matches multi-word names only, so "Pok Pok" survives and "Ataula" vanishes, and List can render `No results for " "`. Same at `HistoryViewModel.swift:42`. Repo precedent trims first (`AddRestaurantView.swift:52`, `PDXConfirmationCard.swift:63`). **medium**
- [ ] [Review][Patch] **Autocorrect will fight name search** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift:44] — no `.autocorrectionDisabled()` or `.textInputAutocapitalization(.never)` on either field. Restaurant names are proper nouns, so iOS rewrites partial names mid-typing and produces phantom zero-result states that read as a search bug. **medium**
- [ ] [Review][Patch] **`DateFormatter` is allocated on every keystroke** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryViewModel.swift:52] — `grouped` constructs one per call, and `sections(searching:)` now runs on every `body` evaluation rather than once per load. Hoist to a `static let`. The `"MMMM yyyy"` pattern is also hardcoded rather than localized (`setLocalizedDateFormatFromTemplate("MMMMy")`). Also runs in `.idle`/`.loading`/`.error`, where the result is discarded. **medium**
- [ ] [Review][Patch] **A filter that excludes everything hides the active search with no way to clear it** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift:33] — `sorted.isEmpty` is tested before `searched.isEmpty`, so the filter empty state wins while a search is still active and invisible. **medium**
- [ ] [Review][Patch] **`matches(_:_:)` dropped the empty-query guard the story specified** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift:84] — the story's reference implementation opens `guard !q.isEmpty else { return true }`; correctness now rests entirely on the caller's ternary, and `"abc".localizedStandardContains("")` is `false`. Story 2.8's picker is explicitly built on this helper. **low**
- [ ] [Review][Patch] **Neither `.searchable` supplies a `prompt:`, so the scope is undiscoverable** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift:17] — nothing tells the user that List covers cuisine and neighborhood, or that History searches visit notes, which is the entire point of History search. **low**
- [ ] [Review][Patch] **Story artifacts not closed out, and the flagged on-device check has no recorded result** — `3-5-search-your-restaurants.md` still reads "Ready for Dev" while every task here is `[x]`; no Dev Notes or change log entry. More importantly, the Design Notes named `.searchable` coexisting with the `FilterBarView` `.safeAreaInset` as the AC most likely to look wrong in practice and asked for an on-device check in both collapsed and expanded states. **That check needs your hands — it cannot be settled by reading code.** **medium**

- [x] [Review][Defer] **`VisitLogDTO.toModel()` never hydrates the `restaurant` relationship** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Network/DTOs/VisitLogDTO.swift:66] — deferred, pre-existing. This is the root cause behind the bare-header finding above. Only `AddVisitView.swift:66` sets the relationship, so every visit arriving via `pullFromRemote` or realtime insert is an orphan and never renders in History at all. After an Xcode reinstall, which the Sprint 1 checklist treats as routine, the local store is repopulated entirely from remote and **every** visit becomes an orphan. Worth its own story; the patch above only stops the bare header, it does not make synced visits visible.
- [x] [Review][Defer] **No test target exists anywhere in the repo** — deferred, pre-existing. No `XCTest` or `import Testing` in any `.swift` file, no test `PBXNativeTarget`, no scheme with a TestAction. `grouped(_:matching:)` is now pure, deterministic, testable logic and `matches(_:_:)` is the reusable predicate for Story 2.8 and web parity, but `matches` is a `private func` on a `View` and unreachable from a test target even if one existed.
- [x] [Review][Defer] **`RestaurantDetailViewModel.markVisited` and `.addVisit` are dead code** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/RestaurantDetailViewModel.swift:13] — deferred, pre-existing. Found while verifying the orphan-relationship finding. `RestaurantDetailView.swift:177` and `:180` both route through `AddVisitView` instead. Both dead methods construct `VisitLog` without setting the relationship, so they are also latent instances of the bug above.
- [x] [Review][Defer] **Accessibility gaps in the new List empty state** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift:147] — deferred, pre-existing pattern. Fixed `.font(.system(size: 64))` ignores Dynamic Type, the decorative icon is not `.accessibilityHidden(true)`, and a long pasted query has no `lineLimit`. The existing `noRestaurantsState` and `noResultsState` use the identical pattern, so this is repo-wide rather than introduced here.
- [x] [Review][Defer] **A matched note gives no visible reason for the row appearing** [PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift:100] — deferred, pre-existing. `HistoryRowView` renders `log.note` with `.lineLimit(1)` and there is no match highlighting, so a visit matching on a word deep in a note appears with nothing on screen explaining why.

**Dismissed as noise (1):** "the same word returns different results on each tab" — List matches name/cuisine/neighborhood, History matches name/note. This is the spec's design, not a defect; the missing `prompt:` patch above is the real mitigation.
