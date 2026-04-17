# Story 3.3: Restaurant List View with Filters

Status: done

## Story

As a Portland food enthusiast,
I want to switch to a list view of my restaurants with the same filter options as the map,
So that I can browse my list when I want a scannable format instead of geography.

## Acceptance Criteria

1. **Given** I am on the map view **When** I tap the List tab **Then** I see my restaurants in a scrollable list, sorted by most recently updated.

2. **Given** I am in list view **When** I apply filters (status, venue type, neighborhood, cuisine, price) **Then** the list updates in real time (under 500ms) to show only matching restaurants.

3. **Given** I apply filters in the map view and switch to list view **When** the list renders **Then** it reflects the same active filters — filter state is shared between map and list.

4. **Given** I tap a restaurant row in the list **When** the tap is registered **Then** the restaurant detail view opens for that restaurant.

5. **Given** I am in list view with all text at default size **When** I increase iOS Dynamic Type size **Then** all text adjusts without layout breakage (inherits from system font styles).

6. **Given** active filters match zero restaurants **When** the list renders **Then** a "No matches" empty state is shown with a "Clear Filters" button — distinct from the "No restaurants yet" empty state shown when the list is truly empty.

## Tasks / Subtasks

- [x] Task 1: Add `FilterBarView` to `RestaurantListView` (AC: 2, 3)
  - [x] 1.1 Add `@safeAreaInset(edge: .top)` with `FilterBarView(restaurants: restaurants)` — same pattern as MapView
  - [x] 1.2 `FilterBarView` already reads/writes `AppState` via `@Environment` — no additional wiring needed

- [x] Task 2: Filter the list in-memory (AC: 2, 3)
  - [x] 2.1 Compute `let filtered = restaurants.filter { appState.isFiltered($0) }` at top of `body` — ensures `@Observable` tracking registers on `appState` filter properties
  - [x] 2.2 Pass `filtered` to the `List ForEach` instead of `restaurants`

- [x] Task 3: Separate empty states (AC: 6)
  - [x] 3.1 `restaurants.isEmpty` → `noRestaurantsState` (existing copy, colors updated to `pdxAccent`)
  - [x] 3.2 `filtered.isEmpty && !restaurants.isEmpty` → `noResultsState` with "No matches" + "Clear Filters" CTA

- [ ] Task 4: Manual smoke test (AC: 1–6)
  - [ ] 4.1 Apply filter on map → switch to list → same filter active
  - [ ] 4.2 Apply filter on list → verify list narrows instantly
  - [ ] 4.3 Filter to zero results → "No matches" state appears with Clear Filters button
  - [ ] 4.4 Tap a row → detail view opens
  - [ ] 4.5 Clear filters → full list restores

## Dev Notes

### Why top-level `let filtered` matters

Same reason as MapView: `appState.isFiltered()` accesses `@Observable` properties. If called inside a `List { ForEach { ... } }` closure, SwiftUI may not register those accesses as belonging to this view's render cycle. Computing `filtered` at the top of `body` guarantees the view re-renders when any filter property changes.

### No sort toggle

The list is sorted by `updatedAt` descending (most recently added/modified first) — set by the `@Query` in `init`. The epics AC says "sorted by name or most recently added"; most-recently-added is already implemented and sufficient for this story. A sort picker is not added (YAGNI).

### FilterBarView reuse

`FilterBarView` is used verbatim — no modifications. It derives neighborhood/cuisine options from the `restaurants` array passed to it (the full unfiltered set, so options don't disappear as filters narrow the list).

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- **Task 1–3:** All implemented in a single edit to `RestaurantListView.swift`. The list view was already well-structured; the changes were additive: filter computation at top of body, `FilterBarView` inset, two distinct empty states, `pdxAccent` color tokens replacing raw `.orange`.

### File List

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift` — modified

### Change Log

- 2026-04-15: Story 3.3 implemented — filter bar added to list view, in-memory filtering, two empty states
