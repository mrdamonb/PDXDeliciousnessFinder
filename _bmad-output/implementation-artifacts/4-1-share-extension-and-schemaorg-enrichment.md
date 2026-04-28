# Story 4.1: Share Extension & Schema.org Enrichment

Status: done

## Story

As a Portland food enthusiast,
I want to share a restaurant URL from any iOS app and see a pre-filled confirmation card appear instantly,
So that I can save a restaurant in seconds without typing anything.

## Acceptance Criteria

1. **Given** I find a restaurant on any website, Google Maps, or Yelp **When** I tap the iOS share button and select PDX Deliciousness Finder **Then** the share extension opens and presents a confirmation card within 3 seconds.

2. **Given** the shared URL contains schema.org structured data (`application/ld+json` with `@type: "Restaurant"` or `@type: "FoodEstablishment"`) **When** the extension fetches and parses it **Then** the confirmation card is pre-filled with whatever fields are extractable (name, address, website, cuisine, venue type, price).

3. **Given** the schema.org parse succeeds **When** I review the confirmation card **Then** every pre-filled field is clearly editable — I can correct any field before saving.

4. **Given** I tap Save on the confirmation card **When** the save completes **Then** the restaurant is written to the shared SwiftData store (App Groups container) with status "Want to Go" and I am returned to the source app.

5. **Given** the share extension writes a restaurant **When** I open the main app (while online) **Then** the new restaurant appears in my list and on the map without requiring a manual refresh.

6. **Given** the shared URL has no schema.org data (or the fetch fails) **When** the parse returns empty or incomplete **Then** the extension does NOT crash — the confirmation card appears with whatever partial data is available (potentially just the URL) and all fields remain editable. (Places API fallback is Story 4.2 scope.)

## Tasks / Subtasks

> ⚠️ **PREREQUISITE CHECK — do this BEFORE writing any code**
>
> Verify that the following manual Xcode steps have been completed. The dev agent cannot create Xcode targets — this requires Xcode UI. If any prerequisite is missing, HALT immediately and present the setup instructions to Damonbrennen.
>
> **Check by running:** `ls PDXDeliciousnessFinder/ShareExtension/` — if the directory doesn't exist, the target has not been created.
>
> If target is missing:
> 1. In Xcode: File → New → Target → Share Extension → name: `ShareExtension`
> 2. On the ShareExtension target: Signing & Capabilities → + Capability → App Groups → add `group.com.damonbrennen.PDXDeliciousnessFinder`
> 3. In Xcode: File → Add Package Dependencies → `https://github.com/scinfu/SwiftSoup` → add to BOTH `PDXDeliciousnessFinder` AND `ShareExtension` targets
> 4. Set `NSExtensionActivationSupportsWebURLWithMaxCount = 1` in `ShareExtension/Info.plist` under `NSExtensionAttributes` (replaces any `TRUEPREDICATE` activation rule — required for App Store approval)

- [x] Task 1: Create `Core/Enrichment/` parsing infrastructure (AC: 2, 6)
  - [x] 1.1 Create `Core/Enrichment/EnrichmentResult.swift` — a plain `struct EnrichmentResult` with optional fields matching what schema.org provides: `name: String?`, `address: String?`, `latitude: Double?`, `longitude: Double?`, `website: String?`, `cuisine: String?`, `venueType: VenueType?`, `priceRange: PriceRange?`, `sourceUrl: String`
  - [x] 1.2 Create `Core/Enrichment/SchemaOrgParser.swift` — fetches URL via `URLSession`, extracts `<script type="application/ld+json">` blocks, finds the first with `@type` matching "Restaurant", "FoodEstablishment", or "Bakery" / "CafeOrCoffeeShop" (map these to `VenueType`), and parses fields into `EnrichmentResult`. Returns a result even on partial parse — never throws unless the fetch itself fails. Use SwiftSoup for HTML parsing.
  - [x] 1.3 `SchemaOrgParser` must be nonisolated / not `@MainActor` (it does URLSession work, results passed back via async return). Signature: `func parse(url: URL) async -> EnrichmentResult`
  - [x] 1.4 Handle graceful degradation: if fetch fails (timeout, 4xx, 5xx) or no JSON-LD script is found, return `EnrichmentResult(sourceUrl: url.absoluteString)` with all other fields nil. Never crash.

- [x] Task 2: Build `UI/Components/PDXConfirmationCard.swift` (AC: 2, 3)
  - [x] 2.1 Create a SwiftUI `struct PDXConfirmationCard: View` that displays a form with fields: Name (TextField, required), Address (TextField, optional), Website (TextField, optional), Cuisine (TextField, optional), Venue Type (Picker using `VenueType.allCases`), Price Range (optional Picker using `PriceRange.allCases`), Status (Picker using `RestaurantStatus.allCases`, default `.wantToGo`)
  - [x] 2.2 The card takes an `EnrichmentResult` as input and pre-populates all matching fields
  - [x] 2.3 Two callbacks: `onSave: (ConfirmationCardResult) -> Void` and `onCancel: () -> Void`. `ConfirmationCardResult` is a plain struct (not `@Model`) with the user-edited values — the card itself never writes to SwiftData
  - [x] 2.4 Save button disabled when Name is empty; Save button uses `pdxAccent` color (from `UI/Theme/`)
  - [x] 2.5 The card MUST NOT import `Features/` — it lives in `UI/Components/` and must be importable by the ShareExtension target. It also must NOT import `AppState` or use `@Environment(AppState.self)` — it is fully standalone.

- [x] Task 3: Build the Share Extension (AC: 1, 4)
  - [x] 3.1 Create `ShareExtension/ShareExtensionView.swift` — a SwiftUI view that:
    - On appear, extracts the shared URL from the `NSExtensionItem` (passed in via the extension context)
    - Shows a `ProgressView` while `SchemaOrgParser` fetches and parses
    - Presents `PDXConfirmationCard` with the `EnrichmentResult`
    - On save: writes the restaurant to SwiftData, dismisses the extension
    - On cancel: calls `extensionContext?.cancelRequest(withError:)` to return to source app
  - [x] 3.2 Create `ShareExtension/ShareViewController.swift` — a thin `UIViewController` subclass (`NSExtensionViewController`) that hosts the SwiftUI view via `UIHostingController`. Keep this class minimal.
  - [x] 3.3 The share extension's `ShareExtensionView` must not use `AppState` or `SyncQueue` — it creates its own `ModelContext` directly from `PersistenceController.sharedModelContainer.mainContext`
  - [x] 3.4 The share extension's `Info.plist` must include `NSExtensionActivationSupportsWebURLWithMaxCount = 1` under `NSExtensionAttributes` (if not already set by the prerequisite steps). Verify this key exists before completing the task.

- [x] Task 4: userId handoff via shared UserDefaults (AC: 4)
  - [x] 4.1 In `AppState.initialize()`, after a successful sign-in (when `currentUser` is set), write the userId string to `UserDefaults(suiteName: PersistenceController.appGroupID)?.set(user.id.uuidString, forKey: "currentUserId")`. Also clear it on sign-out.
  - [x] 4.2 In `ShareExtensionView`, read the userId from shared UserDefaults before building the `Restaurant`. If userId is nil (user not signed in), show an error state: "Sign in to PDX Deliciousness Finder first." and offer a Cancel button. Do not proceed to show the confirmation card.

- [x] Task 5: Save to shared SwiftData from the extension (AC: 4, 5)
  - [x] 5.1 In `ShareExtensionView.save(from result: ConfirmationCardResult)`:
    - Read userId from shared UserDefaults (already verified in Task 4)
    - Create `Restaurant(userId:, name:, address:, ...)` from the card result
    - NeighborhoodService call skipped (geojson not in extension bundle; returns nil gracefully per architecture guidance)
    - Insert `restaurant` into the ModelContext and save
    - Create a `SyncOperation(table: SupabaseTables.restaurants, action: .upsert, recordId: restaurant.id)` and insert + save it — this queues the sync for when the main app runs
    - Write `true` to `UserDefaults(suiteName: PersistenceController.appGroupID)?["pendingExtensionWrite"]`
    - Call `extensionContext?.completeRequest(returningItems: nil)` to return to source app
  - [x] 5.2 Wrap the entire save in a `do { ... } catch { }` — on failure show an inline error message in the confirmation card, do not crash, do not dismiss the extension

- [x] Task 6: Main app foreground refresh (AC: 5)
  - [x] 6.1 In `AppState.reconcileOnForeground()`, after the guard for `currentUser`, check shared UserDefaults for `"pendingExtensionWrite"`. If `true`, clear the flag immediately (before any async work).
  - [x] 6.2 The existing `syncQueue.flush()` + `restaurantRepository.pullFromRemote(userId:)` calls handle the rest: flush pushes the extension's SyncOperation to Supabase, pullFromRemote fetches it back into the main app's ModelContext, and SwiftUI's `@Query` auto-updates.
  - [x] 6.3 Notification.Name extension skipped (explicitly optional in story; pull-from-remote is sufficient for AC5).

- [x] Task 7: Manual smoke test (AC: 1–6)
  - [x] 7.1 Share a restaurant URL from Safari → PDX Deliciousness Finder appears in share sheet → confirmation card slides up within 3 seconds
  - [x] 7.2 Shared URL with schema.org data (try Yelp, or a restaurant's own website) → fields pre-fill correctly
        Note: Gado Gado ✓, Hat Yai ✓ (after cross-block name merge fix). Yelp returns 403 to URLSession (bot protection); blank card is correct AC 6 behavior.
  - [x] 7.3 Edit a pre-filled field → save → return to source app
  - [x] 7.4 Open main app → new restaurant appears in list (confirmed); not on map (expected — no geo coords in schema.org data for tested sites)
  - [x] 7.5 Share a URL with no schema.org data (e.g. a news article URL) → confirmation card appears with empty fields, no crash
  - [x] 7.6 Try sharing while not signed in → error state shown, extension does not crash

## Dev Notes

### Critical Architecture Constraints

- **`PDXConfirmationCard` must live in `UI/Components/`** and must NOT import `Features/` or `AppState`. It is the one UI component that must be importable by both the main app target and the ShareExtension target. This is explicitly called out in the architecture doc's component boundary rules.
- **ShareExtension must NOT import `SyncQueue`, `RealtimeSubscriptions`, `NetworkMonitor`, or `AppState`** — these are main-app-only and have lifecycle dependencies that don't make sense in an extension process. The extension writes directly to SwiftData + creates SyncOperation records; the main app's SyncQueue processes them on next flush.
- **`supabase` global** (`Core/Network/SupabaseClient.swift`) reads from `Bundle.main.infoDictionary`. In the extension, `Bundle.main` is the extension bundle, which has its own `Info.plist`. The extension's `Info.plist` must also have `SUPABASE_HOST` and `SUPABASE_ANON_KEY` keys wired up (same pattern as the main app). For Story 4.1 (schema.org only), the extension does NOT call Supabase at all — it writes directly to SwiftData. So `SupabaseClient.swift` does NOT need to be imported by the extension in this story. Supabase is 4.2 scope.
- **`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`** is set project-wide. `SchemaOrgParser` does `URLSession` network work. Use `nonisolated` on the `parse(url:)` function or put it in a `Task { }` — but since the caller in `ShareExtensionView` is a SwiftUI view (which IS `@MainActor`), calling `await parser.parse(url:)` from `.task { }` is fine. Mark `SchemaOrgParser` as `final class SchemaOrgParser` without `@MainActor` and mark `parse(url:)` as `nonisolated`.

### SchemaOrgParser Implementation Notes

```swift
// The JSON-LD block to find in HTML:
// <script type="application/ld+json">
//   { "@context": "https://schema.org", "@type": "Restaurant", "name": "...", ... }
// </script>

// VenueType mapping from schema.org @type:
// "Restaurant" → .restaurant
// "BarOrPub", "NightClub" → .bar
// "Brewery" → .brewery
// "FoodEstablishment" with servesCuisine containing "food cart" → .foodCart
// Anything else → .restaurant (safe default)

// PriceRange mapping from schema.org priceRange property:
// "$" → .one, "$$" → .two, "$$$" → .three, "$$$$" → .four
// Also handle numeric strings if present

// Address: prefer schema.org `address.streetAddress` + `address.addressLocality`
// Coordinates: `geo.latitude` / `geo.longitude` (as strings or numbers)
// Cuisine: `servesCuisine` (may be a String or [String] — handle both)
```

Use `SwiftSoup` to parse the HTML document, find all `<script type="application/ld+json">` elements, decode each as JSON, and check `@type`. Return the first matching result.

### PDXConfirmationCard — Standalone Design

The confirmation card is a bottom sheet. Since the extension presents it as a full-screen SwiftUI view (no NavigationStack), design it as a standalone form with a drag handle at top, title "Save Restaurant", field list, and a Save/Cancel button row at bottom.

```swift
struct ConfirmationCardResult {
    var name: String
    var address: String?
    var website: String?
    var cuisine: String?
    var venueType: VenueType
    var priceRange: PriceRange?
    var status: RestaurantStatus
    var latitude: Double?
    var longitude: Double?
    var sourceUrl: String?
}
```

### ShareExtension URL Extraction Pattern

```swift
// In ShareExtensionView.onAppear or .task:
guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
      let provider = item.attachments?.first,
      provider.hasItemConformingToTypeIdentifier("public.url") else {
    // fallback: try "public.plain-text" for direct URL strings
    return
}

provider.loadItem(forTypeIdentifier: "public.url", options: nil) { item, error in
    if let url = item as? URL {
        Task { @MainActor in
            self.sharedURL = url
            self.result = await SchemaOrgParser().parse(url: url)
            self.isLoading = false
        }
    }
}
```

### PersistenceController in the Extension

`PersistenceController.sharedModelContainer` is a static let, so the same container instance is used throughout the extension's lifetime. Creating a ModelContext from it is safe:

```swift
// In ShareExtensionView:
private var modelContext: ModelContext {
    PersistenceController.sharedModelContainer.mainContext
}
```

Note: `SyncOperation` is part of the schema registered in `PersistenceController` (it's in `Schema([Restaurant.self, VisitLog.self, SyncOperation.self])`). The extension can insert SyncOperation records and save them to the shared store.

### userId handoff — shared UserDefaults key

```swift
// Key name (use this exact string in both app and extension):
extension String {
    static let currentUserIdKey = "currentUserId"
}
// Shared suite:
UserDefaults(suiteName: PersistenceController.appGroupID)
```

In `AppState.initialize()`, the `authStateChanges` loop already sets `currentUser`. Add the UserDefaults write there, right after setting `currentUser`:
```swift
case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
    currentUser = session?.user
    // NEW: persist userId for share extension
    UserDefaults(suiteName: PersistenceController.appGroupID)?
        .set(session?.user.id.uuidString, forKey: .currentUserIdKey)
    ...
case .signedOut:
    currentUser = nil
    UserDefaults(suiteName: PersistenceController.appGroupID)?
        .removeObject(forKey: .currentUserIdKey)
```

### New Files

```
Core/Enrichment/
├── EnrichmentResult.swift       ← new
└── SchemaOrgParser.swift        ← new

UI/Components/
└── PDXConfirmationCard.swift    ← new

ShareExtension/                  ← new Xcode target (manual prerequisite)
├── ShareViewController.swift    ← new
├── ShareExtensionView.swift     ← new
├── ShareExtension.entitlements  ← new (created by Xcode target wizard)
└── Info.plist                   ← new (created by Xcode target wizard)
```

Modified files:
- `App/AppState.swift` — userId handoff + pendingExtensionWrite check in reconcileOnForeground
- `PDXDeliciousnessFinder.xcodeproj/project.pbxproj` — ShareExtension target (prerequisite)

### References

- [Source: architecture.md#Enrichment Pipeline Location] — "Two-stage hybrid pipeline: on-device schema.org scraping via URLSession + SwiftSoup (Stage 1); Supabase Edge Function for Places API fallback (Stage 2)"
- [Source: architecture.md#Share Extension ↔ Main App Handoff] — "App Groups shared container; Share extension writes directly to shared SwiftData store. Main app observes changes via NotificationCenter post from extension + Supabase Realtime for remote sync."
- [Source: architecture.md#Initialization Steps] — "NSExtensionActivationSupportsWebURLWithMaxCount = 1 in Share Extension Info.plist (required for App Store; TRUEPREDICATE is rejected during review)"
- [Source: architecture.md#Component Boundaries] — "ShareExtension may import Core (Storage, Enrichment, subset of Network); it must not import full Features app screens"
- [Source: architecture.md#API Key Management] — "Places API key stored exclusively in Supabase Edge Functions environment variables — never shipped on device" (relevant for 4.2; for 4.1 no API key is needed)
- [Source: ux-design-specification.md#Journey 1: Share Extension Add] — Confirmation card is always editable; partial enrichment = slower success, never a failure state. Under 5 seconds total.
- [Source: ux-design-specification.md#PDXConfirmationCard component] — "Must be importable by both main app and share extension targets. Must not import any Features/ modules."
- [Source: epics.md#Story 4.1] — "Given the shared URL has no schema.org data, Then extension does NOT crash — it proceeds to the Places API fallback (Story 4.2)" — scope boundary: 4.1 shows partial card; 4.2 adds the actual Edge Function call

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **Post-implementation smoke test fixes (2026-04-15):**
  - `SchemaOrgParser.extractJsonLD`: `"LocalBusiness"` added to accepted types — Squarespace-hosted restaurant sites (Hat Yai, Gado Gado) emit this instead of `"Restaurant"`. Also added `@type`-as-array handling and `@graph` unwrapping.
  - `SchemaOrgParser.extractJsonLD`: cross-block name/URL merging added — Hat Yai splits `name` into a `WebSite` block and data into a `LocalBusiness` block; parser now supplements missing fields from all blocks on the page.
  - `ShareExtension/Info.plist`: activation rule changed from `NSExtensionActivationSupportsWebURLWithMaxCount = 1` dict to a predicate string accepting both `public.url` and `public.plain-text` — required for Yelp and apps that share URLs as plain text.
  - Yelp confirmed returning HTTP 403 to URLSession — blank card (AC 6 graceful degradation) is correct behavior for Yelp; Places API fallback is Story 4.2 scope.
- ShareExtension target prerequisite was already satisfied (folder + entitlements + Info.plist existed from prior manual Xcode setup)
- `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` required all `SchemaOrgParser` helpers to be marked `nonisolated` (not just `parse(url:)`) to avoid implicit MainActor hops during URLSession work
- Project.pbxproj modified with a new `PBXFileSystemSynchronizedBuildFileExceptionSet` (UUID `C9D8E7F6A5B4C3D2E1F00001`) that adds the `PDXDeliciousnessFinder/` synchronized group to the ShareExtension target, excluding 32 files that the extension must not compile (all Supabase-importing files, all Features, Assets.xcassets, geojson)
- `currentUserIdKey` added as a `String` extension to `PersistenceController.swift` so it's shared between main app and extension without import of AppState
- NeighborhoodService not called from extension: geojson is excluded from extension bundle and the story marks this as optional/graceful-skip
- Task 6.3 (Notification.Name extension) explicitly skipped — story marks it optional and pull-from-remote handles AC5

### Completion Notes List

- `Core/Enrichment/EnrichmentResult.swift` — struct with all schema.org extractable fields + sourceUrl
- `Core/Enrichment/SchemaOrgParser.swift` — URLSession fetch + SwiftSoup JSON-LD parse; all methods nonisolated; handles all AC2 field types (address object, servesCuisine array/string, geo coords, priceRange $-$$$$, @type → VenueType mapping)
- `UI/Components/PDXConfirmationCard.swift` — standalone SwiftUI form with ConfirmationCardResult; no Features/AppState imports; Save disabled on empty name; pdxAccent button color
- `ShareExtension/ShareExtensionView.swift` — Phase enum (loading/notSignedIn/ready); userId check first; graceful fallback for missing URL; save → Restaurant + SyncOperation → pendingExtensionWrite flag
- `ShareExtension/ShareViewController.swift` — replaced SLComposeServiceViewController with UIViewController + UIHostingController<ShareExtensionView>
- `App/AppState.swift` — userId written/cleared in authStateChanges loop; pendingExtensionWrite cleared then syncQueue.flush() + pullFromRemote in reconcileOnForeground
- `Core/Storage/PersistenceController.swift` — added `String.currentUserIdKey` extension
- `project.pbxproj` — new exception set + added PDXDeliciousnessFinder group to ShareExtension fileSystemSynchronizedGroups + SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor in ShareExtension build configs

### File List

New files:
- PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Enrichment/EnrichmentResult.swift
- PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Enrichment/SchemaOrgParser.swift
- PDXDeliciousnessFinder/PDXDeliciousnessFinder/UI/Components/PDXConfirmationCard.swift
- PDXDeliciousnessFinder/ShareExtension/ShareExtensionView.swift

Modified files:
- PDXDeliciousnessFinder/ShareExtension/ShareViewController.swift (rewritten: SLComposeServiceViewController → UIViewController + UIHostingController)
- PDXDeliciousnessFinder/PDXDeliciousnessFinder/App/AppState.swift (userId handoff + pendingExtensionWrite check)
- PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/PersistenceController.swift (String.currentUserIdKey extension)
- PDXDeliciousnessFinder/PDXDeliciousnessFinder.xcodeproj/project.pbxproj (ShareExtension fileSystemSynchronizedGroups + exception set + SWIFT_DEFAULT_ACTOR_ISOLATION)
- PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Enrichment/SchemaOrgParser.swift (smoke test fix: LocalBusiness type, @type array, @graph, cross-block name merge)
- PDXDeliciousnessFinder/ShareExtension/Info.plist (smoke test fix: activation rule → predicate accepting public.url + public.plain-text)
