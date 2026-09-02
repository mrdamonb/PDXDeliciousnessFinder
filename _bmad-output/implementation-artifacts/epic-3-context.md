# Epic 3 Context: Find What to Eat Tonight

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can open a Portland map and see all their restaurants as color-coded, venue-typed pins; filter the map and a parallel list view by status, venue type, neighborhood, cuisine, and price in one motion; switch between map and list without losing filter state; and tap any pin or row to open a restaurant card. This is the "30-second sidewalk decision" moment — the app's core discovery loop for deciding where to eat right now, so it must be fast, one-handed, and fully usable offline against locally cached data.

## Stories

- Story 3.1: Portland Map with Restaurant Pins
- Story 3.2: Filter the Map
- Story 3.3: Restaurant List View with Filters
- Story 3.4: Neighborhood Detection
- Story 3.5: Search Your Restaurants

## Requirements & Constraints

- Map renders all pins in under 2 seconds on a mid-range iPhone; filter/search updates apply in under 500ms — both targets assume purely local (on-device) filtering, no server round-trip.
- Status must be conveyed through both pin color AND icon, never color alone (colorblind accessibility).
- Venue-type icon (restaurant, bar, brewery, food cart) always renders on the pin regardless of status — food cart is a first-class venue type with its own distinct icon, not a subtype.
- All interactive tap targets meet the 44×44pt minimum; list/filter text supports Dynamic Type without layout breakage.
- Filters must be reachable and combinable in one motion — no modal filter screen, no burying filters in submenus (supports one-handed use while standing).
- Filter state is shared between map and list views: applying filters in one and switching to the other must preserve them.
- Neighborhood detection runs entirely offline via a local, on-device lookup — no network call and no CLGeocoder — and must degrade gracefully (empty neighborhood field, not a blocking error) when no match is found.
- In-app list/history search (this epic, FR26/27) is a separate concern from the Places-lookup search used to *add* a new restaurant (Epic 4, FR13/`search-places` Edge Function) — do not conflate the two; this epic's search is a local substring filter over restaurants/visit notes the user already owns.
- Search narrows *within* the active filter set rather than replacing it, and always resets to empty when leaving and returning to a tab (must not act as a silent hidden filter).
- Epic 2 (`RestaurantList`, restaurant card) and Epic 4 (search-to-add) are prerequisites/adjacent systems this epic's map and list route into — this epic does not own restaurant CRUD or the add flow.

## Technical Decisions

- Map is built with SwiftUI `Map` + `MapAnnotation` for custom pins — no Google Maps SDK, no billing/API key. Dense pin clusters use `MKAnnotationView` with `clusteringIdentifier`.
- Pin appearance = venue-type icon (SF Symbols: restaurant `fork.knife`, bar `wineglass`, brewery `mug.fill`, food cart custom/`house.fill`-based) rendered inside a status-colored teardrop pin (34×42pt standard, 38×46pt for Favorite with a star accent above). Status colors are the shared tokens already defined in project CLAUDE.md (want_to_go #D97706, been_there #16A34A, favorite #DC2626).
- Resolved design conflict (validated in user testing 2026-04-15): Been There pins keep the venue-type icon rather than swapping to a checkmark — the green fill alone carries the "been there" signal, since a checkmark made venue type unreadable at a glance. Do not reintroduce a checkmark treatment.
- VoiceOver label format for pins: `"[Name], [Status], [Venue Type], [Neighborhood]"`.
- Map and list both read only from the local SwiftData cache; MapKit tiles cache automatically. This is what makes the app fully functional offline and hits the render/filter performance targets.
- `MapViewModel`, `ListViewModel`, and a `FilterViewModel`/shared `FilterState` follow the standard ARCH-8/9/10 rules: `ViewState<T>` for async state (no raw `isLoading`), all data access via Repository methods (no direct `supabase.from()` calls — filtering itself is local anyway), `SupabaseTables` enum if any table reference is needed.
- Filter state lives in shared app-level state (e.g. `AppState` in the SwiftUI environment) observed by both `MapViewModel` and `ListViewModel`, which is the mechanism that keeps filters in sync across the map↔list toggle.
- Neighborhood detection: local GeoJSON polygon lookup shipped in the app bundle (Portland neighborhood boundaries). No specific polygon data source is named in the architecture/PRD/UX docs — this technical note originates from the epic/story spec itself, not a separate architecture decision.
- The `pg_trgm` fuzzy-matching extension exists in the architecture for Epic 5 duplicate detection (address + name similarity); it is not used for Story 3.5's search, which is a local/client-side substring match over already-owned data.

## UX & Interaction Patterns

- Filter UI is a two-level chip strip: top-level category chips (Status / Venue / Neighborhood / Cuisine / Price) that drill into that category's option pills on tap — this keeps the strip from overflowing as neighborhood/cuisine option counts grow. No "Apply" button; filters take effect instantly.
- Neighborhood and cuisine filter categories hide entirely when no saved restaurant has that field set, rather than showing an empty option list.
- Status filter pills use the pill's own status color when active; other filter dimensions use a neutral accent color.
- Empty states are distinct per cause: first-launch/no-restaurants (warm prompt over a faded map), zero-results-from-filters ("No places match these filters" + a Clear Filters action), and zero-results-from-search (names the search term as the cause, offers to clear it) — these three must read as different states, not one generic "nothing here."
- Portland identity cues apply throughout: neighborhood labels visible on map/list, warm earthy palette, food carts treated as a first-class, visually distinct venue type.

## Cross-Story Dependencies

- Story 3.3 (list view filters) and Story 3.2 (map filters) share one `FilterState` — build the filter model once, not twice.
- Story 2.8 (History tab "Add a Visit") and a planned web parity spec both depend on and reuse Story 3.5's search implementation — treat 3.5's search as a shared component, not History-tab-specific or List-tab-specific.
- Story 3.4 (neighborhood detection) feeds the neighborhood filter used by both 3.2 and 3.3, and re-runs whenever a restaurant's address is edited (Epic 2 edit flow).
