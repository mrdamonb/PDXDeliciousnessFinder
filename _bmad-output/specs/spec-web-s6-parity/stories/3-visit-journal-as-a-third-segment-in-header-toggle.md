---
title: 'The visit journal, as a third segment in the header toggle'
type: 'feature'
created: '2026-09-08'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'fc363fd3e9bca2d790b9a0773b162868765d4792'
context: ['{project-root}/_bmad-output/specs/spec-web-s6-parity/SPEC.md', '{project-root}/_bmad-output/specs/spec-web-s6-parity/parity-audit.md', '{project-root}/_bmad-output/specs/spec-web-s6-parity/edge-cases.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CAP-2. The web app has no way to see every logged visit across all restaurants in one place — only per-restaurant history inside each panel. iOS has had this (History tab, story 2.7) since 2026-09-01; web has not moved.

**Approach:** A third segment, "Journal," in the existing header Map/List toggle. It shows every `visit_logs` row for the signed-in user, reverse-chronological, grouped under month/year headers, mirroring iOS `HistoryView` + `HistoryGrouping`. Tapping a row opens that restaurant's panel. This story ships CAP-2 only — adding a visit from the journal (CAP-3) and editing one (CAP-4) are stories 4 and 5.

## Boundaries & Constraints

**Always:** Filter unrenderable entries (join returned no restaurant) BEFORE grouping — a month header must never render with nothing beneath it (this was violated on iOS 3.5 despite being an explicit AC). Switching Map/List/Journal preserves `filterState` untouched — Journal itself ignores it; it always shows the full unfiltered visit set, same as iOS. Journal content and filters/search are unaffected by each other. Status badge colors stay `#D97706`/`#16A34A`/`#DC2626`. Server components fetch; `getAllVisitLogs()` is a server action called from the client `HistoryView`, following the existing `getVisitLogs`/`RestaurantPanel` pattern — not a raw client Supabase call.

**Ask First:** None — the third segment and its wiring are pre-approved (Damon, 2026-09-06); no further header layout change is needed here.

**Never:** No search field inside the journal itself (out of this story's scope). No add-visit or edit-visit UI here (stories 4, 5). No pagination or server-side filtering — personal-scale, client-side grouping, matching `filters.ts`'s existing approach.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No visits ever | Zero `visit_logs` rows | Warm empty state: "Your food adventures will show up here." | N/A |
| Visits across months | Rows spanning several months | Month/year headers descending; entries descending within each | N/A |
| Entry's restaurant missing | Visit row whose join returns no restaurant | Entry filtered out before grouping; no empty header | N/A |
| Row tapped | Any row, any filter state | Opens that restaurant's panel (map view), regardless of active filters/search | N/A |
| Fetch fails | `getAllVisitLogs()` throws | Inline error message, no crash | Catch and display "Could not load your visits." |

</frozen-after-approval>

## Code Map

- `web/src/app/actions.ts` -- add `getAllVisitLogs()`: server action, selects `visit_logs` joined to `restaurants` (`restaurant:restaurants(id, name, neighborhood, venue_type, status)`) for the signed-in user, ordered `visited_at desc`. New exported type `VisitLogWithRestaurant`.
- `web/src/lib/historyGrouping.ts` -- new. Pure function `groupVisitsByMonth(logs: VisitLogWithRestaurant[]): MonthSection[]`, mirrors `PDXDeliciousnessFinder/.../Features/History/HistoryGrouping.swift`: filter `restaurant === null` first, group by year+month, sort months desc, entries within month desc by `visited_at`.
- `web/src/components/HistoryView.tsx` -- new. Client component, fetches via `getAllVisitLogs()` in `useEffect` (loading/error/data `useState`s, same shape as `RestaurantPanel.tsx:70-95`). Renders month sections; each row shows venue icon, name, red star if `status === 'favorite'`, neighborhood, one-line note snippet when present, and the date — mirrors `HistoryRowView` in the iOS file above. Empty and error states inline, no shared component needed.
- `web/src/components/HomeView.tsx` -- `view` state widens to `'map' | 'list' | 'journal'`; add a third toggle button (new inline `JournalIcon`, same 15x15 stroke style as `MapIcon`/`ListIcon`) reusing the existing toggle group markup. Render `<HistoryView onSelectRestaurant={(id) => { setSelectedId(id); setView('map') }} />` when `view === 'journal'`, same `paddingTop: TOP_BAR_HEIGHT` wrapper as List. Gate the floating `FilterButton`/`FilterPopover` to `view === 'map' || view === 'list'` — they have no effect on Journal content, so showing them there is misleading. Pass `restaurants={restaurants}` (full, unfiltered list) to `MapView` as a new prop.
- `web/src/components/MapView.tsx` -- `Props` gains `restaurants: Restaurant[]` (full list). Resolve `selected` from `restaurants`, not `filteredRestaurants` (`MapView.tsx:187`), so a journal row for a restaurant currently excluded by active filters still opens its panel. Pins/markers keep using `filteredRestaurants` — unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/app/actions.ts` -- add `VisitLogWithRestaurant` type and `getAllVisitLogs()` -- CAP-2 data source
- [x] `web/src/lib/historyGrouping.ts` -- add `groupVisitsByMonth` -- pure, unit-testable grouping mirroring iOS
- [x] `web/src/components/HistoryView.tsx` -- add journal view component -- renders CAP-2 UI
- [x] `web/src/components/MapView.tsx` -- resolve `selected` from full `restaurants` list -- lets a filtered-out journal entry still open its panel
- [x] `web/src/components/HomeView.tsx` -- add third toggle segment, wire `HistoryView`, gate `FilterButton` to map/list -- CAP-2 entry point

**Acceptance Criteria:**
- Given visits across three different months, when the journal opens, then three month headers appear newest-first, each with entries newest-first.
- Given a visit whose restaurant was deleted, when the journal groups entries, then that entry does not appear and no header is rendered empty for it.
- Given an active status filter that excludes restaurant X, when a journal row for X is tapped, then the map view opens with X's panel shown.
- Given zero visits, when the journal opens, then the warm empty state renders, not a blank surface.

## Design Notes

Two small deviations from a literal reading of "inherits the toggle's behaviour," both scoped tightly to avoid drifting into a header redesign:

1. **Journal ignores `filterState` entirely** rather than applying it — CAP-2's success criterion is "every row in `visit_logs`," and iOS's History tab is likewise independent of the List/Map filters. Filters persist in state across the toggle (nothing resets them) but only affect Map/List content.
2. **`FilterButton` is hidden on Journal** because it would otherwise sit on screen doing nothing. This is a floating action button below the header, not a header layout change, so it doesn't trigger the "ask before touching the header" constraint.

`MapView`'s panel-resolution fix (full list instead of filtered list) is required because Journal — unlike List, whose rows are already a subset of `filteredRestaurants` — can show a row for a restaurant the active filters exclude. Without this fix, tapping such a row would silently fail to open a panel.

## Verification

**Commands:**
- `cd web && npm run build` -- expected: zero errors
- `cd web && npx tsc --noEmit` -- expected: zero TypeScript errors

**Manual checks (if no CLI):**
- Open the journal with visits spanning multiple months: headers descending, entries descending, note snippets visible where present.
- Set a filter that excludes some restaurant with a visit; open the journal, tap that restaurant's entry; confirm its panel opens on the map.
- Delete a restaurant that has a visit logged (via another tab/session or direct DB action); confirm its journal entry disappears and no orphaned month header remains.
- With zero visits, confirm the empty state renders.
- Select a restaurant on Map/List, then apply a filter that excludes it — confirm the panel intentionally stays open (Design Notes: panel resolution reads from the full restaurant list, independent of active filters) rather than silently auto-closing like it did before this story.

## Suggested Review Order

**Journal as a third toggle segment**

- Entry point: `view` widens to include `'journal'`, driving every conditional below.
  [`HomeView.tsx:82`](../../../../web/src/components/HomeView.tsx#L82)

- Third toggle button, styled identically to the existing Map/List pair.
  [`HomeView.tsx:172`](../../../../web/src/components/HomeView.tsx#L172)

- Journal content mounts here, routing row taps back into the existing `selectedId`/`view` state.
  [`HomeView.tsx:367`](../../../../web/src/components/HomeView.tsx#L367)

- `FilterButton`/`FilterPopover` hidden on Journal — they have no effect on its unfiltered content.
  [`HomeView.tsx:389`](../../../../web/src/components/HomeView.tsx#L389)

**Journal view and month grouping**

- `HistoryView` fetches on mount and owns loading/error/data state, same shape as `RestaurantPanel`'s visit fetch.
  [`HistoryView.tsx:28`](../../../../web/src/components/HistoryView.tsx#L28)

- Retry affordance re-runs the fetch without depending on the component remounting.
  [`HistoryView.tsx:35`](../../../../web/src/components/HistoryView.tsx#L35)

- Row rendering: venue icon, favorite star, neighborhood, note snippet, date — mirrors iOS `HistoryRowView`.
  [`HistoryView.tsx:161`](../../../../web/src/components/HistoryView.tsx#L161)

- Pure grouping: filters unresolvable entries before grouping, so no month header ever renders empty.
  [`historyGrouping.ts:29`](../../../../web/src/lib/historyGrouping.ts#L29)

- Same-day visits break ties on `created_at` instead of an arbitrary Postgres order.
  [`historyGrouping.ts:56`](../../../../web/src/lib/historyGrouping.ts#L56)

**Data source and runtime-safety fix**

- `getAllVisitLogs()` joins `visit_logs` to `restaurants` in one query for the whole journal.
  [`actions.ts:134`](../../../../web/src/app/actions.ts#L134)

- Normalizes Supabase's embedded-relation result before trusting its shape, since this is the codebase's first to-one embed.
  [`actions.ts:121`](../../../../web/src/app/actions.ts#L121)

**Cross-filter panel resolution**

- `MapView` now resolves the selected restaurant from the full list, not the filtered one, so a Journal row for a filtered-out restaurant still opens its panel.
  [`MapView.tsx:196`](../../../../web/src/components/MapView.tsx#L196)
- Select a restaurant on Map/List, then apply a filter that excludes it — confirm the panel intentionally stays open (Design Notes: panel resolution reads from the full restaurant list, independent of active filters) rather than silently auto-closing like it did before this story.
