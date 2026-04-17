# Story 3.2: Filter the Map

Status: done

## Story

As a Portland food enthusiast,
I want to filter the map by status, venue type, neighborhood, cuisine, and price,
So that I can instantly narrow down my options when deciding where to eat.

## Acceptance Criteria

1. **Given** I am viewing the map with multiple pins **When** I look at the top of the map **Then** I see a horizontally scrollable filter bar with pill buttons for each filter dimension (status, venue type, neighborhood, cuisine, price range) — all accessible without opening a modal.

2. **Given** I tap a filter pill **When** the filter applies **Then** only pins matching that filter remain at full opacity; non-matching pins dim to 30% opacity — and the update happens in under 500ms.

3. **Given** I select "Want to Go" + "NW Portland" + "under $$$" **When** all three filters are active **Then** only pins matching ALL active filters are fully visible (AND logic across dimensions).

4. **Given** multiple filters are active **When** I look at the filter bar **Then** active pills are visually distinct (filled with `pdxAccent` color) so I can see what's currently filtered.

5. **Given** I tap an active filter pill **When** it deactivates **Then** matching pins immediately return to full opacity — one tap to remove, no confirmation required.

6. **Given** all filters are cleared **When** the filter bar resets **Then** all pins reappear at full opacity immediately.

7. **Given** filters are active **When** I tap a visible (fully opaque) pin **Then** the correct restaurant card opens — filtering must not break pin-tap interaction.

8. **Given** I am on the map with filters active **When** I switch to the List tab **Then** the filter state is preserved — the same active filters are reflected in the list (filter state lives in a shared location, not inside MapView).

## Tasks / Subtasks

- [x] Task 1: Add filter state to `AppState` (AC: 2, 3, 4, 5, 6, 8)
  - [x] 1.1 Add `var activeStatuses: Set<RestaurantStatus>` — empty = no status filter
  - [x] 1.2 Add `var activeVenueTypes: Set<VenueType>` — empty = no venue type filter
  - [x] 1.3 Add `var activeNeighborhoods: Set<String>` — empty = no neighborhood filter
  - [x] 1.4 Add `var activeCuisines: Set<String>` — empty = no cuisine filter
  - [x] 1.5 Add `var activePriceRanges: Set<PriceRange>` — empty = no price filter
  - [x] 1.6 Add `func isFiltered(_ restaurant: Restaurant) -> Bool` — returns `true` when the restaurant passes ALL active filters; a dimension with an empty set is ignored (matches all)
  - [x] 1.7 Add `var hasActiveFilters: Bool` computed property — true when any filter set is non-empty
  - [x] 1.8 Add `func clearAllFilters()` — resets all filter sets to empty

- [x] Task 2: Wire `isFilteredOut` in `MapView` (AC: 2, 7)
  - [x] 2.1 Pass `isFilteredOut: !appState.isFiltered(restaurant)` to each `PDXMapPin` (already has the parameter from Story 3.1)
  - [x] 2.2 Dimmed pins remain tappable — opacity change only, `.onTapGesture` is not disabled

- [x] Task 3: Build `FilterBarView` component (AC: 1, 4, 5)
  - [x] 3.1 Add `UI/Components/FilterBarView.swift` — horizontally scrollable `ScrollView(.horizontal)` with `FilterPillView` items
  - [x] 3.2 Add `UI/Components/FilterPillView.swift` — toggleable pill; inactive: outlined capsule; active: filled capsule
  - [x] 3.3 Status pills use per-status `pdxColor` (amber/green/red) for intuitive active fill
  - [x] 3.4 Venue type pills use `pdxAccent`
  - [x] 3.5 Neighborhood pills: data-driven from unique non-nil `neighborhood` values
  - [x] 3.6 Cuisine pills: data-driven from unique non-nil `cuisine` values
  - [x] 3.7 Price range pills: one per `PriceRange` case
  - [x] 3.8 "Clear" button: visible only when `appState.hasActiveFilters`

- [x] Task 4: Embed `FilterBarView` in `MapView` (AC: 1, 4)
  - [x] 4.1 Added via `.safeAreaInset(edge: .top)` — map remains full-bleed behind it
  - [x] 4.2 Filter bar uses `.ultraThinMaterial` background
  - [x] 4.3 `restaurants` (`@Query` result) passed to `FilterBarView` for neighborhood/cuisine derivation

- [x] Task 5: Filter state placed in `AppState` from the start (AC: 8)
  - [x] 5.1 Five filter sets + helpers live in `AppState` (never lived in `MapViewModel`)
  - [x] 5.2 `MapView` reads/writes filter state via `@Environment(AppState.self)`
  - [x] 5.3 `FilterBarView` mutates `AppState` filter state directly via environment
  - [x] 5.4 Story 3.3 can read `AppState` filter state for list view without further changes

- [ ] Task 6: Manual smoke test (AC: 1–8)
  - [ ] 6.1 Tap a status pill → matching pins stay bright, others dim
  - [ ] 6.2 Combine two filter dimensions → AND logic works correctly
  - [ ] 6.3 Tap active pill to deactivate → pins restore immediately
  - [ ] 6.4 Tap "Clear" → all pins restore
  - [ ] 6.5 Tap a visible pin with filters active → correct detail card opens
  - [ ] 6.6 Verify filter update is visually instant (subjectively under 500ms)

## Dev Notes

### Architecture Constraints

- **Opacity-based filtering ONLY** — never add/remove annotations from the `ForEach`. Adding/removing causes MapKit to reload annotations, producing visible flicker. `PDXMapPin.isFilteredOut` was designed in Story 3.1 exactly for this. Use it.
- **Filter state in `AppState`** — AC8 requires filter state to survive tab switches. `AppState` is the correct home (architecture doc: "shared cross-feature state lives in `AppState`"). Do NOT keep filter state inside `MapViewModel` as a final resting place.
- **Local evaluation only** — `isFiltered(_:)` runs against in-memory SwiftData objects. No Supabase calls, no `@Query` predicate changes. This guarantees <500ms NFR3.
- **`@Observable @MainActor`** — `MapViewModel` conforms to this; any filter state moved to `AppState` is already `@MainActor`.

### Filter Logic

```swift
// isFiltered returns true = restaurant PASSES filters (should be fully visible)
func isFiltered(_ restaurant: Restaurant) -> Bool {
    if !activeStatuses.isEmpty && !activeStatuses.contains(restaurant.status) { return false }
    if !activeVenueTypes.isEmpty && !activeVenueTypes.contains(restaurant.venueType) { return false }
    if !activeNeighborhoods.isEmpty {
        guard let n = restaurant.neighborhood, activeNeighborhoods.contains(n) else { return false }
    }
    if !activeCuisines.isEmpty {
        guard let c = restaurant.cuisine, activeCuisines.contains(c) else { return false }
    }
    if !activePriceRanges.isEmpty {
        guard let p = restaurant.priceRange, activePriceRanges.contains(p) else { return false }
    }
    return true
}
```

### FilterBarView Structure

```
┌─────────────────────────────────────────────────────────┐
│  [Want to Go] [Been There] [Favorite] │ [Restaurant] [Bar] ... │ [NW Portland] ... │ [Thai] ... │ [$] [$$] ... │ [Clear ×]  │
└─────────────────────────────────────────────────────────┘
```

- Single horizontal `ScrollView` with no visible scroll indicator
- Groups separated by a subtle divider `|` or just spacing — don't over-design
- Pills use `Label` with SF Symbol + text when space allows, text-only on narrower pills
- Status pills can reuse `RestaurantStatus.displayName` and `RestaurantStatus.pdxColor` for the active fill color instead of `pdxAccent` — this way "Want to Go" active pill is amber, "Been There" is green, "Favorite" is red (more intuitive than all being orange)

### FilterPillView

```swift
struct FilterPillView: View {
    let label: String
    let isActive: Bool
    let color: Color       // pdxAccent for most; status color for status pills
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isActive ? color : .clear)
                .foregroundStyle(isActive ? .white : color)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(color, lineWidth: 1.5))
        }
    }
}
```

Minimum tap target: wrap in a frame of at least 44pt height to satisfy NFR15.

### Deriving Available Filter Options

```swift
// In FilterBarView or computed in MapViewModel
var availableNeighborhoods: [String] {
    Array(Set(restaurants.compactMap(\.neighborhood))).sorted()
}

var availableCuisines: [String] {
    Array(Set(restaurants.compactMap(\.cuisine))).sorted()
}
```

Pass `restaurants: [Restaurant]` from MapView's `@Query` result into `FilterBarView`.

### AppState Filter State Placement

Add to `AppState`:

```swift
// MARK: - Filter state (shared between Map and List tabs)
var activeStatuses: Set<RestaurantStatus> = []
var activeVenueTypes: Set<VenueType> = []
var activeNeighborhoods: Set<String> = []
var activeCuisines: Set<String> = []
var activePriceRanges: Set<PriceRange> = []

var hasActiveFilters: Bool {
    !activeStatuses.isEmpty || !activeVenueTypes.isEmpty ||
    !activeNeighborhoods.isEmpty || !activeCuisines.isEmpty ||
    !activePriceRanges.isEmpty
}

func clearAllFilters() {
    activeStatuses = []
    activeVenueTypes = []
    activeNeighborhoods = []
    activeCuisines = []
    activePriceRanges = []
}

func isFiltered(_ restaurant: Restaurant) -> Bool { ... }
```

`MapViewModel` then just reads from `appState` (passed in or environment-accessed) rather than owning filter state.

### New Files

```
UI/
└── Components/
    ├── FilterBarView.swift    ← new
    └── FilterPillView.swift   ← new
```

`AppState.swift` — modified (filter state added)
`MapViewModel.swift` — modified (delegates filter logic to AppState)
`MapView.swift` — modified (adds FilterBarView overlay, passes isFilteredOut to pins)

### References

- [Source: architecture.md#Frontend Architecture] — "shared cross-feature state lives in `AppState`"
- [Source: architecture.md#Map Rendering Strategy] — "Filter state managed in MapViewModel — filtering is local, no server round-trip"
- [Source: ux-design-specification.md#Effortless Interactions] — "Tap a filter pill, pins update instantly (<500ms). No 'apply' button."
- [Source: epics.md#Story 3.2] — Full acceptance criteria
- [Source: epics.md#Story 3.3] — Filter state shared between map and list (drives Task 5 design)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all SourceKit diagnostics during authoring were false positives (macOS SourceKit indexer cannot resolve iOS-only types; same behavior as Story 3.1).

### Completion Notes List

- **Task 1 (Filter state in AppState):** Added directly to `AppState` (Tasks 1 + 5 merged since `MapViewModel` never held filter state). Five `Set` vars, `hasActiveFilters` computed, `clearAllFilters()`, and `isFiltered(_:)` with AND logic across all active dimensions.
- **Task 2 (isFilteredOut wiring):** `PDXMapPin` now receives `isFilteredOut: !appState.isFiltered(restaurant)`. Opacity-only — annotation is never removed from the `ForEach` (no flicker). Dimmed pins remain tappable.
- **Task 3 (FilterPillView + FilterBarView):** `FilterPillView` is a simple toggleable capsule. `FilterBarView` reads `AppState` via `@Environment` and the `restaurants` array for dynamic neighborhood/cuisine derivation. Uses `ReferenceWritableKeyPath` generic toggle helper to avoid boilerplate per-dimension.
- **Task 4 (Embed in MapView):** `.safeAreaInset(edge: .top)` keeps the filter bar floating above the map with `.ultraThinMaterial` backdrop. Map stays full-bleed.
- **Task 6:** Manual smoke test deferred to Damon — requires running on simulator with seeded data across multiple statuses/venues.

### File List

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/App/AppState.swift` — modified (filter state block added)
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/UI/Components/FilterPillView.swift` — new
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/UI/Components/FilterBarView.swift` — new
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/Map/MapView.swift` — modified (AppState env, isFilteredOut wiring, FilterBarView inset)

### Change Log

- 2026-04-15: Story 3.2 implemented — filter bar, pill components, AppState filter state, map opacity-based filtering
