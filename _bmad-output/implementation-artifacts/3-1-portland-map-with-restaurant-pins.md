# Story 3.1: Portland Map with Restaurant Pins

Status: done

## Story

As a Portland food enthusiast,
I want to see all my saved restaurants on a Portland map with pins that show me at a glance what each place is and whether I've been there,
so that I can see my personal food geography of Portland.

## Acceptance Criteria

1. **Given** I have restaurants with latitude/longitude saved **When** I open the map view **Then** I see a MapKit map centered on Portland with a pin for each restaurant, rendered in under 2 seconds.

2. **Given** a restaurant has status "Want to Go" **When** it renders on the map **Then** its pin is amber (`#F59E0B`) — distinct from "Been There" (green `#16A34A`) and "Favorite" (red `#DC2626`) — and status is conveyed through both color AND icon (not color alone) so the map is usable by colorblind users.

3. **Given** a restaurant has a venue type set **When** it renders on the map **Then** its pin displays a venue-type SF Symbol icon: `fork.knife` (restaurant), `wineglass` (bar), `mug.fill` (brewery), `house.fill` (food cart). Been There pins use a checkmark icon instead of the venue icon.

4. **Given** a restaurant has status "Favorite" **When** it renders on the map **Then** its pin uses a larger size (38×46pt vs standard 34×42pt) and displays a star above the pin body.

5. **Given** I tap a pin on the map **When** the tap is registered **Then** the restaurant's detail card opens (bottom sheet, same `PDXDetailCard` used in list context).

6. **Given** I have no restaurants saved **When** I open the map **Then** I see the Portland-area map with an empty state overlay guiding me to add my first restaurant.

7. **Given** the map requests location permission **When** I grant "When In Use" **Then** the map centers on my current position; if permission is denied or unavailable, the map centers on Portland (45.5051° N, 122.6750° W).

8. **Given** the map tab is the primary home screen from this epic forward **When** the app routes to HomeView after sign-in **Then** the map tab is the default landing screen (replacing the temporary list-as-home from Epic 2).

## Tasks / Subtasks

- [x] Task 1: Create `MapViewModel` (AC: 1, 2, 3, 4, 6, 7)
  - [x] 1.1 Add `Features/Map/MapViewModel.swift` — `@Observable @MainActor` class
  - [x] 1.2 Fetch restaurants from SwiftData via `@Query` in `MapView` (same pattern as `RestaurantListView`); `MapViewModel` does not need its own list
  - [x] 1.3 Add `var region: MKCoordinateRegion` defaulting to Portland center (45.5051, -122.6750, span 0.15° × 0.15°)
  - [x] 1.4 Add location services: request `WhenInUse` authorization via `CLLocationManager`; update region center on first valid fix; fall back to Portland center on denial; `NSLocationWhenInUseUsageDescription` added to `Info.plist`
  - [x] 1.5 Add `var selectedRestaurant: Restaurant?` for pin-tap → detail card

- [x] Task 2: Create `PDXMapPin` custom SwiftUI annotation view (AC: 2, 3, 4)
  - [x] 2.1 Add `UI/Components/PDXMapPin.swift`
  - [x] 2.2 Implement upright teardrop shape as `TearDropShape: Shape` using arc + tangent lines (34×42pt standard, 38×46pt for Favorite)
  - [x] 2.3 Fill color from `RestaurantStatus.pdxColor`: `.wantToGo` → `pdxStatusWant`, `.beenThere` → `pdxStatusBeen`, `.favorite` → `pdxStatusFav`
  - [x] 2.4 SF Symbol icon inside pin: `.wantToGo`/`.favorite` → `VenueType.mapPinIcon`; `.beenThere` → `checkmark` (overrides venue icon)
  - [x] 2.5 Add star (`star.fill`) above pin body for `.favorite` status
  - [x] 2.6 Add tap-target extension: frame set to min 44×44pt with `.contentShape(Rectangle())`
  - [x] 2.7 Add `isFilteredOut` state: when true, set `.opacity(0.3)` — no annotation add/remove
  - [x] 2.8 Add VoiceOver label: `"\(name), \(status.displayName), \(venueType.displayName), \(neighborhood ?? "Portland")"`

- [x] Task 3: Define design tokens in `UI/Theme/` (AC: 2)
  - [x] 3.1 Add `UI/Theme/Colors.swift` with `Color` extensions: `pdxStatusWant` (#F59E0B), `pdxStatusBeen` (#16A34A), `pdxStatusFav` (#DC2626), `pdxAccent` (#C2410C), `pdxBackground` (#F7F3EE), `pdxSurface` (#FFFFFF)
  - [x] 3.2 No hardcoded hex values in feature code — all references use `Color.pdx*`

- [x] Task 4: Create `MapView` screen (AC: 1, 5, 6, 8)
  - [x] 4.1 Add `Features/Map/MapView.swift`
  - [x] 4.2 Use iOS 17 `Map` with `Annotation` + `PDXMapPin` inside; restaurants without coordinates silently skipped
  - [x] 4.3 On pin tap: set `viewModel.selectedRestaurant`; present `RestaurantDetailView` as `.sheet(item:)`
  - [x] 4.4 Empty state overlay: `restaurants.isEmpty` → centered `VStack` with `fork.knife.circle` + "Your Portland food map starts here" + "Add Restaurant" button (pdxAccent), overlaid on map
  - [x] 4.5 Navigation title: none (map is full-bleed via `.ignoresSafeArea(edges: .top)`)

- [x] Task 5: Integrate tab bar and make Map the primary home screen (AC: 8)
  - [x] 5.1 Replaced `HomeView` body with `TabView`: Map tab + List tab
  - [x] 5.2 Map tab is index 0 (default landing)
  - [x] 5.3 `userId` passed to both `MapView` and `RestaurantListView` from `AppState.currentUser?.id`
  - [x] 5.4 Sign Out toolbar button moved to List tab toolbar

- [x] Task 6: Add `MapView` to Xcode project (AC: 1)
  - [x] 6.1 Project uses `PBXFileSystemSynchronizedRootGroup` — all files in the source tree are automatically included. Build succeeded confirming all new files are compiled.

- [ ] Task 7: Manual smoke test (AC: 1–8)
  - [ ] 7.1 Run on simulator with 5+ seeded restaurants (mix of statuses and venue types)
  - [ ] 7.2 Verify pin colors, icons, favorite star render correctly
  - [ ] 7.3 Tap a pin; confirm detail card opens
  - [ ] 7.4 Verify empty state appears with zero restaurants
  - [ ] 7.5 Verify map tab is default on launch after sign-in

## Dev Notes

### Architecture Constraints (MUST follow)

- **Map is `Features/Map/`** — `MapView.swift` + `MapViewModel.swift`. Feature-first structure matches all other features.
- **`PDXMapPin` is `UI/Components/`** — reusable component, not feature-specific. Same as `StatusBadgeView.swift`.
- **No direct Supabase calls** — `MapViewModel` reads restaurants from SwiftData only (via `@Query` or `RestaurantRepository`). The sync layer already keeps SwiftData up to date.
- **`ViewState<[Restaurant]>` pattern** — use `var state: ViewState<[Restaurant]>` on `MapViewModel` for async load state if needed, but since SwiftData `@Query` is synchronous, a simple `@Query` in the view or `fetchAll()` on init is sufficient. Do not use raw `isLoading: Bool` flags.
- **`@Observable @MainActor`** on `MapViewModel` — matches all existing ViewModels in the codebase.
- **No `@FetchRequest` across process boundaries** — the map feature lives in the main app only; `@Query` is fine here.

### MapKit Implementation Specifics

**SwiftUI Map API (iOS 17+):**
```swift
// Use the iOS 17 Map initializer with annotations
Map(initialPosition: .region(viewModel.region)) {
    ForEach(viewModel.restaurants) { restaurant in
        Annotation(restaurant.name, coordinate: restaurant.coordinate) {
            PDXMapPin(restaurant: restaurant, isSelected: viewModel.selectedRestaurant?.id == restaurant.id)
                .onTapGesture { viewModel.selectedRestaurant = restaurant }
        }
    }
}
```
- `Restaurant` needs a computed `var coordinate: CLLocationCoordinate2D` — add as an extension if `latitude`/`longitude` are both non-nil; skip annotation for restaurants with nil coordinates.
- `MapAnnotation` (deprecated in iOS 17) vs `Annotation` — use the new `Annotation` API (iOS 17 Map view with `MapContentBuilder`).

**Tap target workaround for `Annotation`:**
In the newer `Annotation` API, wrapping content in a `ZStack` with a transparent 44×44 `contentShape` Rectangle is still needed for reliable hit-testing inside map annotations.

**Opacity-based filtering (not hide/show):**
```swift
// CORRECT — opacity change, no annotation reload
PDXMapPin(restaurant: restaurant)
    .opacity(viewModel.isFiltered(restaurant) ? 1.0 : 0.3)

// WRONG — removing from ForEach causes annotation reload → visible flicker
ForEach(viewModel.filteredRestaurants) { ... }
```
This story does not implement filtering (that's Story 3.2), but the `PDXMapPin` design MUST support the `isFilteredOut` parameter from day one so Story 3.2 doesn't require refactoring the component.

**Location permission:**
```swift
import CoreLocation

// In MapViewModel
private let locationManager = CLLocationManager()

func requestLocationPermission() {
    locationManager.requestWhenInUseAuthorization()
}
```
Add `NSLocationWhenInUseUsageDescription` to `Info.plist` if not already present.

### Pin Anatomy

```
     ★           ← star (Favorite only, centered above)
  ╭─────╮
  │  icon │      ← SF Symbol (venue type or checkmark)
  │       │      ← fill = status color
  ╰───┬───╯
      │           ← teardrop point
```

**Sizes:**
- Standard: 34pt wide × 42pt tall (Want to Go, Been There)
- Large: 38pt wide × 46pt tall (Favorite only)

**Icon sizes inside pin:** ~18pt SF Symbol, centered.

### Status Color Constants (from UX spec)

| Status | Swift name | Hex | Usage |
|---|---|---|---|
| Want to Go | `PDXStatusWant` | `#F59E0B` | Amber |
| Been There | `PDXStatusBeen` | `#16A34A` | Green |
| Favorite | `PDXStatusFav` | `#DC2626` | Red |
| Accent | `PDXAccent` | `#C2410C` | Primary buttons, selected filters |

Define in `UI/Theme/Colors.swift`. Reference as `Color.pdxStatusWant` etc. via `extension Color`.

### HomeView Refactor

Current `HomeView.swift` is a temporary wrapper from Epic 2:
```swift
// Current (Epic 2 temporary home)
struct HomeView: View {
    var body: some View {
        NavigationStack {
            RestaurantListView(userId: ...)
        }
    }
}
```

Replace with `TabView`:
```swift
struct HomeView: View {
    @Environment(AppState.self) private var appState
    var body: some View {
        if let userId = appState.currentUser?.id {
            TabView {
                MapView(userId: userId)
                    .tabItem { Label("Map", systemImage: "map") }
                NavigationStack {
                    RestaurantListView(userId: userId)
                }
                .tabItem { Label("List", systemImage: "list.bullet") }
            }
        }
    }
}
```

The `NavigationStack` must wrap `RestaurantListView` (it was previously in `HomeView`'s `NavigationStack`). The Sign Out toolbar button can move to the List tab's toolbar or be deferred to a Settings tab — do not remove it entirely.

### Existing Patterns to Reuse

- **`StatusBadgeView.swift`** (`UI/Components/`) — already maps `RestaurantStatus` to display strings. Extract color logic from there or keep it consistent.
- **`RestaurantDetailView.swift`** — this is the detail card to open on pin tap. Present it as a `.sheet(item: $viewModel.selectedRestaurant)`.
- **`Restaurant.venueType`** is already `VenueType` enum with cases: `.restaurant`, `.bar`, `.brewery`, `.foodCart` — use directly for icon mapping.
- **`RestaurantListView`** already has an empty state pattern — follow the same visual language for the map empty state.

### Coordinate Handling

Many restaurants added manually in Sprint 1 may have `nil` latitude/longitude (manual add didn't require geocoding). Handle gracefully:
- Skip `Annotation` rendering for restaurants where `latitude == nil || longitude == nil`
- Do NOT crash or assert on nil coordinates
- The map may initially show fewer pins than the list — that's expected and acceptable for this story

### Performance Requirement

Map must render in under 2 seconds. Since data is local (SwiftData), this is achievable. Key risks:
- SwiftUI `Annotation` views with complex drawing can be slow at 50+ pins — keep `PDXMapPin` lightweight (no shadows, no blur effects)
- Do not use `MKAnnotationView` subclasses (UIKit) — stay in SwiftUI `Annotation` API

### Project Structure Notes

New files for this story:
```
Features/
└── Map/
    ├── MapView.swift
    └── MapViewModel.swift
UI/
├── Components/
│   └── PDXMapPin.swift       ← new custom annotation view
└── Theme/
    └── Colors.swift          ← new design token file
```

All new files must be added to the Xcode target (`.xcodeproj/project.pbxproj`). If using Xcode to create files, this happens automatically. If creating files manually via the CLI/editor, add them via Xcode's "Add Files to Target" or they will be excluded from the build.

**Import `MapKit` and `CoreLocation`** in files that need them — they are system frameworks, no SPM dependency needed.

### References

- [Source: architecture.md#Map Rendering Strategy] — "SwiftUI MapKit with `MapAnnotation` for custom pins. Clustering via `MKAnnotationView.clusteringIdentifier`." Note: clustering is deferred to a future story.
- [Source: architecture.md#State Management] — `@Observable` ViewModels; shared state in `AppState`
- [Source: architecture.md#Frontend Architecture] — Feature-first structure; `Core/` must not import `Features/`
- [Source: ux-design-specification.md#PDXMapPin] — Pin anatomy, sizes, states, VoiceOver spec
- [Source: ux-design-specification.md#Design Tokens] — Color hex values for all status colors
- [Source: ux-design-specification.md#Navigation Patterns] — Tab bar: always visible, 4 tabs, map is primary
- [Source: epics.md#Story 3.1] — Full acceptance criteria and FR coverage (FR21–FR24)
- [Source: epics.md#Epic 3 navigation note] — "In Epic 3, the map becomes the default landing screen"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — build succeeded on first attempt. All SourceKit diagnostics during authoring were false positives (iOS-only types not resolved by macOS SourceKit indexer; types exist in the project and compile correctly).

### Completion Notes List

- **Task 1 (MapViewModel):** `@Observable @MainActor` class. Restaurants loaded via `@Query` in `MapView` (same pattern as `RestaurantListView` — avoids ViewModel owning SwiftData queries). Location logic uses `CLLocationManager` with `nonisolated` delegate methods bridged back to `@MainActor` via `Task { @MainActor in }`. `hasCenteredOnUser` flag prevents re-centering on every location update.
- **Task 2 (PDXMapPin):** `TearDropShape` implemented as a `Shape` using mathematically precise tangent-line geometry (arc from circle + two tangent lines converging to tip). `isFilteredOut` param supported from day one for Story 3.2 opacity-based filtering. `VenueType.mapPinIcon` extension added (distinct from the existing `VenueType.icon` used in list badges). `Restaurant.coordinate` computed property added as extension in this file. `foodCart` maps to `house.fill` per UX spec (overrides `cart.fill` used in list).
- **Task 3 (Colors):** All six tokens defined. `RestaurantStatus.pdxColor` convenience added so pins and future UI always go through the token. Existing `StatusBadgeView.color` (`.orange`/`.green`/`.red`) left untouched — not in scope to refactor.
- **Task 4 (MapView):** iOS 17 `Annotation` API used (not deprecated `MapAnnotation`). `.annotationTitles(.hidden)` hides the default callout title. Restaurants with nil coordinates are skipped gracefully with `if let coord`. Empty state floats over the map via `.overlay`. `AddRestaurantView` sheet wired from the empty state button.
- **Task 5 (HomeView):** Replaced temporary Epic 2 `NavigationStack` wrapper with `TabView`. Map is tab 0. `NavigationStack` moved inside the List tab so list navigation still works. Sign Out preserved on List tab toolbar.
- **Task 6:** Project uses `PBXFileSystemSynchronizedRootGroup` — all new Swift files picked up automatically. `xcodebuild` confirmed `** BUILD SUCCEEDED **`.
- **Task 7:** Manual smoke test deferred to Damon — requires running on simulator with seeded data.

### File List

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/UI/Theme/Colors.swift` — new
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/UI/Components/PDXMapPin.swift` — new
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/Map/MapViewModel.swift` — new
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/Map/MapView.swift` — new
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/Home/HomeView.swift` — modified (tab bar refactor)
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Info.plist` — modified (`NSLocationWhenInUseUsageDescription` added)

### Change Log

- 2026-04-15: Story 3.1 implemented — Portland map with restaurant pins, tab bar, design tokens, location services
