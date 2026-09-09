---
title: 'Search your own restaurant list'
type: 'feature'
created: '2026-09-08'
status: 'done'
review_loop_iteration: 0
baseline_commit: '94c34597dbf575d186c0dff71dc514f902ad02bb'
context:
  - '{project-root}/_bmad-output/specs/spec-web-s6-parity/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-web-s6-parity/parity-audit.md'
  - '{project-root}/_bmad-output/specs/spec-web-s6-parity/edge-cases.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app has no way to narrow the restaurant list by typing. iOS 3.5 shipped this (device-verified); web's `FilterState` has no query field and no search input exists on any surface.

**Approach:** Add a `query` field to the existing `filters.ts` pipeline (`FilterState`, `EMPTY_FILTER`, `filterRestaurants`, `activeFilterCount`) and a search input in `HomeView.tsx`, so the single filtered list already shared by `ListView` and `MapView` narrows by both filters and query together. No parallel filtering path.

## Boundaries & Constraints

**Always:** Query ANDs with existing filters, never replaces or clears them. Matching is substring (not prefix), case- and diacritic-insensitive, against `name`, `cuisine`, `neighborhood` only. Filtering stays client-side over the already-fetched set. Query state lives in `HomeView`'s existing local state alongside `filterState` — since the restaurant detail panel renders inline (no route change, no unmount), the query is never reset by opening/closing a restaurant; it only changes when the user edits or clears it.

**Ask First:** Any change to the `<header>` element's existing flex layout (title / Map-List toggle / user menu row) — it has two prior repaint regressions (`c096d6a`, `c036895`) and SPEC.md requires asking Damon first. Default plan: place the search input in a new row below `<header>`, not inside it.

**Never:** No server-side search, no pagination. Do not touch `MapView.tsx`'s rendering logic — it already renders whatever `filteredRestaurants` it's given. Do not change `activeFilterCount`'s per-dimension counting for the five existing array fields. Do not reuse or modify `normalizeForMatch` in `importPipeline.ts`/`actions.ts` (import-matching semantics, no diacritic stripping) — add a separate helper in `filters.ts`. Do not touch CAP-2/3/4 (journal) work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Search with filters active | Filter = "Favorite", query = "tha" | Only favorites whose name, cuisine, or neighborhood contains "tha" | N/A |
| Search matches nothing | Query = "zzz" | Empty state naming the query, with a clear-search action — distinct from "No places match these filters" | N/A |
| Clear search | Query emptied | Returns to the filtered set, filters intact | N/A |
| Search on map view | Query set while map is showing | Pins narrow to the same set the list would show (map takes the same `filteredRestaurants`) | N/A |
| Diacritic/case query | Query = "cafe" matches a restaurant named "Café" | Matches | N/A |
| Search, then leave and return | Query set, open a restaurant panel, close it | Query is unchanged — never silently reset (this is the iOS 3.5 defect, in web form) | N/A |

</frozen-after-approval>

## Code Map

- `web/src/lib/filters.ts` -- `FilterState` (~L1-6), `EMPTY_FILTER` (~L13-15), `activeFilterCount` (~L24-32, sums `.length` on arrays), `filterRestaurants` (~L34-42, AND'd `if return false` checks) -- extend all four.
- `web/src/lib/supabase/restaurants.ts` L3-19 -- `Restaurant`: `name: string`, `cuisine: string | null`, `neighborhood: string | null` -- flat, no array-flattening needed.
- `web/src/components/HomeView.tsx` -- `filterState` useState (~L54-60), `filteredRestaurants = filterRestaurants(...)` (L63) feeds both `MapView` (L226) and `ListView` (L247), `<header>` (L76-173, Ask-First zone), duplicated map-empty-state block (L377-420).
- `web/src/components/ListView.tsx` -- full file (92 lines); empty state JSX L25-57 (`filtersActive`/`onClearFilters` props).
- `web/src/lib/importPipeline.ts` L42-48 -- `normalizeForMatch` (lowercase + curly-quote, no diacritic stripping) -- reference only, do not modify.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/lib/filters.ts` -- add `query: string` to `FilterState`/`EMPTY_FILTER` (default `''`); add `normalizeSearchText(s)` (lowercase + NFD diacritic strip); add `matchesQuery(r, normalizedQuery)` over `name`/`cuisine ?? ''`/`neighborhood ?? ''`; AND a sixth check into `filterRestaurants` when `state.query.trim()`; add 1 to `activeFilterCount` when query is non-empty.
- [x] `web/src/components/HomeView.tsx` -- add a search `<input>` in a new row below `<header>` (not inside it), controlled via `filterState.query`, same `{ ...filterState, query: next }` update pattern as `FilterPopover`; pass `query`/`onClearSearch` to `ListView`; mirror the same branch in the map-empty-state block (L377-420).
- [x] `web/src/components/ListView.tsx` -- add `query`/`onClearSearch` props; when query is non-empty and `restaurants` is empty, render `No results for "{query}"` + "Clear search" instead of the filters-empty copy.
- [x] Verify every row of the I/O & Edge-Case Matrix (no test target on web beyond `tsc`/`build`) -- done by code-level trace (below); live in-browser walkthrough blocked by a local dev-server sign-in issue unrelated to this story, deferred to Damon verifying in production after deploy.

**Acceptance Criteria:**
- Given a filter active, when a query is typed, then only restaurants matching both show, on list and map alike.
- Given a diacritic/case-varied query, when it substring-matches normalized `name`/`cuisine`/`neighborhood`, then that restaurant is included.
- Given a query matching nothing, when the list renders, then a distinct query-empty state appears (not the filters-empty one), with a working Clear search.
- Given a query set, when a restaurant is opened then closed, then the query and results are unchanged.
- Given `<header>`'s existing layout, when this story ships, then it is byte-for-byte unchanged.

## Spec Change Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit` -- zero TypeScript errors
- `cd web && npm run build` -- zero build errors

**Manual checks:** walk the I/O & Edge-Case Matrix above end-to-end in the running app; diff `<header>` against `main` to confirm no change.

## Suggested Review Order

**Matching logic**

- Entry point: query ANDs with the five existing filter dimensions as a sixth check.
  [`filters.ts:63`](../../../../web/src/lib/filters.ts#L63)

- Diacritic/case normalization, kept separate from `importPipeline.ts`'s unrelated normalizer.
  [`filters.ts:42`](../../../../web/src/lib/filters.ts#L42)

- Substring match over `name`/`cuisine`/`neighborhood` only, per iOS parity.
  [`filters.ts:49`](../../../../web/src/lib/filters.ts#L49)

- Query counts toward the filter badge as a first-class dimension.
  [`filters.ts:26`](../../../../web/src/lib/filters.ts#L26)

**Search UI and state**

- The search row itself: new row below `<header>`, not inside it (Ask-First constraint respected).
  [`HomeView.tsx:186`](../../../../web/src/components/HomeView.tsx#L186)

- `clearFilters` preserves the query; `clearSearch` only clears the query — the two must stay distinct.
  [`HomeView.tsx:74`](../../../../web/src/components/HomeView.tsx#L74)

- Query and `onClearSearch` threaded into `ListView` alongside the existing filter props.
  [`HomeView.tsx:327`](../../../../web/src/components/HomeView.tsx#L327)

- Map-view empty state branches on query vs. filters, mirroring `ListView`'s.
  [`HomeView.tsx:476`](../../../../web/src/components/HomeView.tsx#L476)

**Distinct empty state**

- `ListView`'s zero-results branch: search-empty vs. filters-empty, each with its own clear action.
  [`ListView.tsx:28`](../../../../web/src/components/ListView.tsx#L28)

**Layout constants (review-driven)**

- `HEADER_HEIGHT`/`SEARCH_ROW_HEIGHT`/`TOP_BAR_HEIGHT` exported as the single source of truth for offsets below the header.
  [`HomeView.tsx:29`](../../../../web/src/components/HomeView.tsx#L29)

- `FilterButton` and `FilterPopover` import `TOP_BAR_HEIGHT` instead of hardcoding the header+search-row total.
  [`FilterButton.tsx:3`](../../../../web/src/components/FilterButton.tsx#L3), [`FilterPopover.tsx:5`](../../../../web/src/components/FilterPopover.tsx#L5)
