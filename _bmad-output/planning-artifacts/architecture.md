---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
inputDocuments:
  - /Users/damonbrennen/Documents/AI-Projects/BMAD/_bmad-output/planning-artifacts/prd.md
workflowType: architecture
lastStep: 8
status: complete
completedAt: '2026-04-01'
project_name: 'PDX Deliciousness Finder'
user_name: 'Damonbrennen'
date: '2026-04-01'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements: 47 FRs across 6 capability areas**

| Capability Area | FR Count | Architectural Weight |
|---|---|---|
| Restaurant Management | 7 | Low — standard CRUD on a well-defined entity |
| Data Enrichment & Ingestion | 7 | High — share extension target, two-pass enrichment pipeline, URL parsing |
| Status & Visit Tracking | 6 | Low-Medium — state machine + append-only visit log |
| Map & List Discovery | 8 | Medium — MapKit rendering, custom pins, filter stack, neighborhood detection |
| Social & Friends | 13 | High — connection/sync state machine, non-destructive merge, duplicate detection, push notifications |
| User Account & Settings | 5 | Medium — Supabase Auth (email/password v1), multi-device sync via cloud database |

**Non-Functional Requirements driving architecture:**
- Map renders in <2s → local data, not API-on-demand
- Share extension <3s → fast schema.org scrape, async Places API fallback
- Filters <500ms → local query, not server-side
- Friend sync <60s → real-time or near-real-time backend push
- Offline read for all data → local persistent store mandatory
- Writes queued offline → queue-and-retry sync pattern
- Data encrypted at rest + in transit → backend and device storage choices
- 10,000 user scalability target → backend must scale horizontally

**Scale & Complexity:**
- Project complexity: Medium (47 FRs, offline-first, real-time social sync, share extension, custom map rendering)
- Primary domain: iOS native mobile + cloud backend
- Estimated architectural components: ~10 distinct areas to design

### Technical Constraints & Dependencies

- **SwiftUI + MapKit** — decided; no Google Maps SDK
- **Supabase Auth (email/password for v1)** — primary auth path; backend validates sessions via Supabase. Sign in with Apple may be added before App Store if required.
- **iOS 16+ minimum** — modern SwiftUI, share extensions, Swift Data available
- **App Groups entitlement** — share extension and main app must share a data container; hard architectural constraint
- **BGAppRefreshTask** — background sync mechanism; Apple limits frequency (~15 min minimum)
- **schema.org scrape first, Places API second** — ingestion pipeline must be two-pass with graceful degradation
- **Non-destructive merge** — sync must detect duplicates by address + name similarity before merging; cannot overwrite user-owned data
- **Portland-specific scope** — neighborhood detection scoped to Portland; data model must support city expansion without migration

### Cross-Cutting Concerns Identified

1. **Offline-first** — affects every data operation; all reads must work from local store; all writes must queue when offline
2. **Multi-device sync** — cloud database is source of truth; local store is a cache; conflict resolution strategy needed
3. **Social attribution** — restaurant entity must carry friend attribution metadata from day one; cannot be bolted on later
4. **Share extension isolation** — extension runs in a sandboxed process separate from the main app; all shared data flows through App Groups; ingestion pipeline must work within extension memory limits (~120MB)
5. **Duplicate detection** — runs at sync time and at add time; must handle food cart pods (same address, different name)

## Starter Template Evaluation

### Primary Technology Domain

Native iOS — SwiftUI + Swift 6. No CLI starter equivalent exists; project is initialized via Xcode's iOS App template with manual configuration for share extension and backend.

### Project Structure

Feature-based architecture (not Xcode's default flat structure):

```
PDXDeliciousnessFinder/
├── App/
├── Features/      (RestaurantList, Map, Friends, Settings, Onboarding)
├── Core/          (Network, Storage, Sync, Extensions)
├── UI/            (Components, Theme)
└── Resources/
ShareExtension/
```

### Initialization Steps

1. New Xcode project → iOS App → SwiftUI interface → Swift language
2. File > New Target > Share Extension
3. Configure App Groups entitlement on both targets (required for shared data container)
4. Set `NSExtensionActivationSupportsWebURLWithMaxCount = 1` in Share Extension Info.plist (required for App Store; `TRUEPREDICATE` is rejected during review)
5. Add Supabase Swift SDK via Swift Package Manager
6. Apply feature-based folder structure

### Architectural Decisions Provided by Starter

**Language & Runtime:** Swift 6 with strict concurrency; `@Observable` ViewModels with `@MainActor`; async/await throughout

**UI Framework:** SwiftUI; `NavigationStack` with `NavigationPath` (not deprecated `NavigationView`)

**Maps:** MapKit (native; no API key; no billing)

**Local Storage:** SwiftData as local cache layer for offline-first support (note: `@FetchRequest` does not trigger UI updates across the App Groups process boundary — main app must observe refresh manually or via Supabase real-time subscription)

**Backend:** Supabase (PostgreSQL) — selected over Firebase Firestore for the following reasons:
- Relational data model (restaurants, users, connections, visits, notes) maps cleanly to PostgreSQL tables; Firestore requires denormalization
- Duplicate detection uses `pg_trgm` extension for address + name fuzzy matching — native to PostgreSQL, awkward in Firestore
- Friend sync queries ("give me restaurants my synced friends added that I don't have") are natural SQL JOINs — multiple round-trips in Firestore
- Row-Level Security (RLS) enforces private-by-default data access in one policy layer
- Predictable open-source pricing vs Firebase at scale

**Testing:** Swift Testing framework (modern replacement for XCTest)

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Local data caching scope (offline-first behavior)
- Offline write queue strategy
- Social sync delivery mechanism
- Enrichment pipeline location

**Important Decisions (Shape Architecture):**
- Supabase schema migration workflow
- CI/CD and TestFlight distribution

**Deferred Decisions (Post-MVP):**
- Push notification provider (APNs direct vs. Supabase push integration) — deferred until social layer is implemented
- Analytics/crash reporting — deferred until v1 ships

---

### Data Architecture

**Decision: SwiftData Caching Scope**
- **Choice:** Cache everything the user owns locally — all restaurants, visits, notes, friend connections, and sync preferences. Enrichment API calls and social invite actions require connectivity; all other operations work fully offline.
- **Rationale:** Matches NFR for full offline read access. Local store is always the source of UI truth; Supabase is the authoritative sync target.
- **Affects:** All feature modules, `Core/Storage`, `Core/Sync`

**Decision: Offline Write Queue Strategy**
- **Choice:** Optimistic local write (SwiftData immediately) + queued Supabase sync via `NWPathMonitor`. On connectivity restoration, flush queue in insertion order. Failed syncs retry with exponential back-off (3 attempts, then surface error to user).
- **Rationale:** App feels instant regardless of connectivity state. Simple, auditable queue. No complex CRDT needed — user data is private by default; conflicts only arise in friend sync (handled separately).
- **Affects:** `Core/Sync`, all write paths in feature modules

**Decision: Supabase Schema Migration Strategy**
- **Choice:** Supabase CLI (`supabase db push`) with version-controlled SQL migration files stored in the repo under `/supabase/migrations/`.
- **Rationale:** Standard Supabase practice; migrations are reviewable, reversible, and environment-aware (dev → prod). Enables clean schema evolution without manual SQL edits in the dashboard.
- **Affects:** `Core/Network`, backend setup

**Decision: Supabase Swift SDK Version**
- **Choice:** v2.43.0 (latest stable as of March 2026), installed via Swift Package Manager.
- **Version verified:** March 24, 2026 release
- **Rationale:** Latest stable; includes Swift concurrency thread-safety fixes relevant to `@Observable` + `async/await` patterns.
- **Affects:** All Supabase interactions

---

### Authentication & Security

**Decision: Supabase Auth (email/password v1; Apple optional later)**
- **Choice:** For v1 (TestFlight), email + password via Supabase Auth (`signUp` / `signIn`). Supabase validates credentials and issues sessions; the `anon` key is embedded in the app (standard practice); Row-Level Security policies enforce all data access boundaries at the database level. Sign in with Apple can be added later via Supabase’s Apple provider before App Store if guideline 4.8 or product goals require it.
- **Rationale:** Matches PRD for v1; avoids paid Apple Developer entitlement for early TestFlight. RLS ensures users can only read/write their own data and their synced friends' public additions — no bespoke authorization middleware needed.
- **Affects:** `Features/Onboarding`, `Core/Network`, all Supabase table policies

**Decision: API Key Management**
- **Choice:** Supabase `anon` key stored in the app's `Info.plist` (loaded via a `Config.xcconfig` file excluded from version control). Places API key stored exclusively in Supabase Edge Functions environment variables — never shipped on device.
- **Rationale:** The `anon` key is safe on-device when RLS is correctly configured (this is the intended Supabase architecture). Third-party Places API key must never be exposed in client code.
- **Affects:** `Core/Network`, Supabase Edge Function configuration

---

### API & Communication Patterns

**Decision: Social Sync Delivery**
- **Choice:** Supabase Realtime subscriptions (PostgreSQL LISTEN/NOTIFY via WebSocket) when the app is foregrounded. BGAppRefreshTask polling as the background fallback (fires every ~15 min per Apple limits). Daily digest push notification (APNs via Supabase) as the user-facing signal.
- **Rationale:** Realtime subscriptions deliver the "live sync" feel described in the PRD when the app is open. Background refresh ensures sync catches up even when the app hasn't been opened. This combination covers all usage patterns without over-engineering.
- **Affects:** `Core/Sync`, `Features/Friends`, app background modes entitlement

**Decision: Enrichment Pipeline Location (Hybrid)**
- **Choice:** Two-stage hybrid pipeline:
  1. **On-device (share extension):** `schema.org` scraping via `URLSession` + `SwiftSoup`. Fast, free, no secrets required. Runs within share extension memory limits.
  2. **Supabase Edge Function (Deno):** Places API fallback (Foursquare or OpenStreetMap Nominatim) called server-side when `schema.org` returns incomplete data. API key lives in Edge Function environment only.
- **Rationale:** Keeps the fast-path free and on-device. Centralises third-party API key management server-side. Edge Function is also reusable for the manual add flow (search-to-add) in v1.
- **Affects:** `ShareExtension`, `Core/Network`, Supabase Edge Functions

**Decision: Error Handling Standards**
- **Choice:** Swift `Result<Success, AppError>` type for all data layer operations. `AppError` is a project-wide enum with associated values covering: network failure, enrichment failure, sync conflict, auth failure, and quota exceeded. UI layer observes error state via `@Observable` ViewModels and surfaces contextual inline errors (not modal alerts, except for auth/critical failures).
- **Rationale:** Consistent error surface across async boundaries. Enum-based errors are exhaustively handled by the compiler.
- **Affects:** `Core/Network`, all ViewModels, `UI/Components`

---

### Frontend Architecture

**Decision: State Management**
- **Choice:** `@Observable` ViewModels (Swift 5.9+ Observation framework) scoped per feature. One ViewModel per screen; shared cross-feature state (e.g., current user, active filters) lives in an `AppState` singleton injected via SwiftUI environment. No third-party state management library.
- **Rationale:** Native Swift 6 pattern; zero dependencies; works correctly across main app and future widget/extension targets. `AppState` provides a single source of truth for global concerns without threading complexity.
- **Affects:** All feature modules

**Decision: Map Rendering Strategy**
- **Choice:** `Map` view (SwiftUI MapKit) with `MapAnnotation` for custom pins. Pin appearance driven by `venue_type` (icon) and `status` (color). Clustering via `MKAnnotationView` with `clusteringIdentifier` for dense areas. Filter state managed in `MapViewModel` — filtering is local, no server round-trip.
- **Rationale:** Native MapKit; no API key, no billing. Custom pins with venue-type icons + status colors match the agreed UI spec. Local filter evaluation keeps sub-500ms filter NFR achievable.
- **Affects:** `Features/Map`

**Decision: Share Extension ↔ Main App Handoff**
- **Choice:** App Groups shared container (`UserDefaults(suiteName:)` for small config, `SwiftData` store in shared container for restaurant data). Share extension writes directly to shared SwiftData store. Main app observes changes via `NotificationCenter` post from extension + Supabase Realtime for remote sync.
- **Rationale:** Hard requirement: both processes must access the same persistent store. SwiftData in a shared container is the cleanest pattern for this; avoids a custom IPC mechanism.
- **Affects:** `ShareExtension`, `Core/Storage`, App Groups entitlement config

---

### Infrastructure & Deployment

**Decision: CI/CD & Distribution**
- **Choice:** Xcode Cloud for automated builds, testing, and TestFlight distribution. Triggered on push to `main` branch. Two workflows: `dev` (run tests, distribute to internal TestFlight) and `release` (run tests + distribute to external TestFlight / App Store).
- **Rationale:** Lowest-friction CI for a solo iOS project; native App Store Connect integration; handles code signing automatically. No external CI account needed.
- **Affects:** Repository setup, App Store Connect configuration

**Decision: Environment Configuration**
- **Choice:** Two Supabase projects: `pdx-dev` and `pdx-prod`. Xcode build schemes (`Debug` / `Release`) load the appropriate `Config.xcconfig` file containing the correct Supabase URL and `anon` key. `.xcconfig` files excluded from version control (`.gitignore`); a `.xcconfig.example` template is committed.
- **Rationale:** Prevents dev data contaminating production. Standard Xcode configuration management pattern.
- **Affects:** All Supabase client initialization

---

### Decision Impact Analysis

**Implementation Sequence (order matters):**
1. Supabase project setup + schema migrations (blocks all data operations)
2. Email/password + Supabase Auth integration (blocks any user-scoped data)
3. `Core/Storage` — SwiftData models + offline write queue (blocks all feature development)
4. `Core/Sync` — Supabase sync + NWPathMonitor (depends on storage + auth)
5. Restaurant CRUD + status/visit log (first usable feature)
6. Map view with pins + local filtering (first primary UI)
7. Share extension + enrichment pipeline (primary add gesture)
8. Friends tab + connection/sync state machine (social layer)
9. Push notifications + daily digest (social layer polish)
10. Xcode Cloud CI/CD configuration (can run in parallel with 7–9)

**Cross-Component Dependencies:**
- `ShareExtension` is tightly coupled to `Core/Storage` via App Groups — the storage schema must be finalized before extension development
- Enrichment Edge Function must exist before the share extension confirmation card can be fully tested end-to-end
- Social sync (Realtime subscriptions) depends on both `Core/Sync` and `Features/Friends` being complete
- Map filtering depends on `Core/Storage` SwiftData queries, not on any server calls — can be developed independently once the data model is set

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 12 areas where AI agents could make incompatible choices without these rules (naming, structure, formats, async boundaries, sync routing, notifications).

### Naming Patterns

**Database Naming Conventions (Supabase / PostgreSQL):**

| Thing | Convention | Example |
|---|---|---|
| Table names | `plural_snake_case` | `restaurants`, `visit_logs`, `friend_connections` |
| Column names | `snake_case` | `venue_type`, `created_at`, `is_synced` |
| Foreign keys | `{table_singular}_id` | `user_id`, `restaurant_id` |
| Indexes | `idx_{table}_{column}` | `idx_restaurants_user_id` |
| Edge functions | `kebab-case` | `enrich-restaurant`, `search-places` |

**Code Naming Conventions (Swift):**

| Thing | Convention | Example |
|---|---|---|
| Types (struct, class, enum) | `PascalCase` | `Restaurant`, `VisitLog`, `AppError` |
| Files | Match primary type name | `RestaurantCard.swift`, `MapViewModel.swift` |
| Variables & functions | `camelCase` | `restaurantId`, `fetchRestaurants()` |
| SwiftData model properties | `camelCase` (mapped to DB via `CodingKeys` / transforms) | `venueType` ↔ `venue_type` |
| Supabase table references | String constants on `SupabaseTables` enum | `SupabaseTables.restaurants` |
| View files | `{Feature}View.swift` | `RestaurantDetailView.swift` |
| ViewModel files | `{Feature}ViewModel.swift` | `MapViewModel.swift` |

### Structure Patterns

**Project Organization:**

Every feature follows this shape:

```
Features/
└── RestaurantList/
    ├── RestaurantListView.swift
    ├── RestaurantListViewModel.swift
    ├── Components/          (views used only in this feature)
    └── Models/              (feature-specific DTOs, not SwiftData @Model types)
```

**Where shared artifacts live:**

| Type | Location |
|---|---|
| SwiftData `@Model` types | `Core/Storage/Models/` |
| Supabase client + table name constants | `Core/Network/` |
| Sync queue + `NWPathMonitor` | `Core/Sync/` |
| App-wide types (`AppError`, `ViewState`, `AppState`) | `Core/` |
| Reusable UI (buttons, cards, sheets) | `UI/Components/` |
| Design tokens (colors, fonts, spacing) | `UI/Theme/` |
| Tests | `PDXDeliciousnessFinderTests/` target, mirroring source paths |

### Format Patterns

**API Response Formats:**

- Supabase PostgREST returns JSON arrays/objects directly — no custom `{ data, error }` wrapper in client code; use Supabase Swift client's `throw` on failure.
- Edge Function responses: JSON object with explicit `success: Bool` + `data` / `error` fields for enrichment results (human-readable error strings for the confirmation card).

**Data Exchange Formats:**

- Dates: `Date` in Swift; `timestamptz` in PostgreSQL; ISO 8601 for any wire serialization.
- JSON field naming: `snake_case` from Supabase; decode to Swift `camelCase` via `CodingKeys` on every DTO.
- Booleans: `true`/`false` in JSON; never `1`/`0`.
- Nulls: Optional Swift properties; avoid sentinel strings like `"null"`.

**ViewState pattern (required for async UI):**

```swift
enum ViewState<T> {
    case idle
    case loading
    case loaded(T)
    case error(AppError)
}
```

Do not use raw `isLoading: Bool` flags on ViewModels for primary screen state.

### Communication Patterns

**Event System Patterns:**

- `NotificationCenter` names: `Notification.Name` static extensions only; string values `kebab-case`:

```swift
extension Notification.Name {
    static let restaurantAdded = Notification.Name("restaurant-added")
    static let syncCompleted = Notification.Name("sync-completed")
}
```

- Supabase Realtime channel naming: `{table}-changes-{userId}` (e.g., `restaurants-changes-abc123`).

**State Management Patterns:**

- `@Observable` ViewModels; one ViewModel per screen unless a child screen is trivial.
- Shared global state (`currentUser`, active filters) lives in `AppState` injected via SwiftUI environment.
- Immutable updates: mutate ViewModel properties on `@MainActor` only; no cross-thread mutation.

### Process Patterns

**Error Handling Patterns:**

- Data layer surfaces `AppError` (enum with associated values).
- ViewModels catch, set `viewState = .error(AppError)`, views show inline recovery.
- Auth failures and unrecoverable errors may use a sheet; routine failures never use blocking alerts.

**Loading State Patterns:**

- Use `ViewState` for screen-level load; use local `@State` only for micro-interactions (e.g., button pressed animation).
- No global loading overlay unless explicitly specified in UX.

**Offline Write Rule:**

- All Supabase mutations route through `SyncQueue` in `Core/Sync/` — ViewModels call repository methods that enqueue; direct `supabase.from(...)` calls from feature code are prohibited.

### Enforcement Guidelines

**All AI Agents MUST:**

1. Reference table names via `SupabaseTables` (or equivalent enum) — never raw string literals for table names in feature code.
2. Use `ViewState<T>` for async screen state — not parallel boolean flags.
3. Route writes through `SyncQueue` — not direct Supabase client calls from ViewModels.
4. Mark ViewModels `@MainActor` and use `async/await` — no `DispatchQueue` for UI updates.
5. Implement `CodingKeys` on all Supabase DTOs — map `snake_case` ↔ `camelCase`.
6. Place reusable UI in `UI/Components/`; feature-only UI stays under `Features/<Feature>/Components/`.
7. Define `Notification.Name` as static extensions — no inline magic strings.

**Pattern Enforcement:**

- SwiftLint rules (optional) can flag raw `Notification.Name` strings and `isLoading` property names on ViewModels.
- PR review checklist: verify new features follow the seven rules above.

### Pattern Examples

**Good Examples:**

- `RestaurantRepository.save(_:)` → enqueues `SyncQueue` → returns `Result<Void, AppError>`.
- `MapViewModel` exposes `var state: ViewState<[RestaurantPin]>`.

**Anti-Patterns:**

- `supabase.from("Restaurants")` with a typo-prone string in a ViewModel.
- `var isLoading = false` alongside `var error: String?` instead of `ViewState`.
- Calling Places API from the View layer instead of the enrichment service / Edge Function.

## Project Structure & Boundaries

### Complete Project Directory Structure

```
PDXDeliciousnessFinder/                    # Xcode project root (repository root)
├── PDXDeliciousnessFinder.xcodeproj
├── PDXDeliciousnessFinder/
│   ├── App/
│   │   ├── PDXDeliciousnessFinderApp.swift
│   │   └── AppDelegate.swift              # if needed for push / background
│   ├── Features/
│   │   ├── Map/
│   │   ├── RestaurantList/
│   │   ├── RestaurantDetail/
│   │   ├── Friends/
│   │   ├── Settings/
│   │   └── Onboarding/
│   ├── Core/
│   │   ├── Storage/
│   │   │   ├── Models/                    # @Model SwiftData types
│   │   │   └── PersistenceController.swift
│   │   ├── Network/
│   │   │   ├── SupabaseClient.swift
│   │   │   ├── SupabaseTables.swift
│   │   │   ├── AuthService.swift
│   │   │   └── DTOs/                      # Codable structs for PostgREST
│   │   ├── Sync/
│   │   │   ├── SyncQueue.swift
│   │   │   ├── FriendSyncService.swift
│   │   │   └── RealtimeSubscriptions.swift
│   │   ├── Enrichment/
│   │   │   ├── SchemaOrgParser.swift
│   │   │   └── EnrichmentCoordinator.swift
│   │   ├── AppState.swift
│   │   ├── AppError.swift
│   │   └── ViewState.swift
│   ├── UI/
│   │   ├── Components/
│   │   └── Theme/
│   ├── Resources/
│   │   ├── Assets.xcassets
│   │   └── Localizable.strings
│   └── Config/
│       └── Config.xcconfig                # gitignored; see repo-level example
├── ShareExtension/
│   ├── ShareViewController.swift          # or SwiftUI Share Extension entry
│   ├── ShareExtension.entitlements
│   └── Info.plist
├── PDXDeliciousnessFinderTests/
│   ├── CoreTests/
│   ├── FeaturesTests/
│   └── Mocks/
├── Config/
│   └── Config.xcconfig.example            # committed template
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
│       ├── enrich-restaurant/
│       └── search-places/
├── .gitignore
├── .swiftlint.yml                         # optional
└── README.md                              # optional at repo init
```

Xcode Cloud configuration lives in App Store Connect / Xcode; no extra repository folder is required.

### Architectural Boundaries

**API boundaries**

- **Client → Supabase:** PostgREST, Auth, Realtime, and Edge Function invocation only; no ad-hoc HTTP to Supabase outside `Core/Network/`.
- **Edge functions → third-party APIs:** Places / Nominatim (or chosen provider) keys exist only in Supabase secrets; the iOS app never embeds those keys.

**Component boundaries**

- **Features** may depend on **Core** and **UI**; **Core** must not import **Features**.
- **ShareExtension** may import **Core** (Storage, Enrichment, subset of Network); it must not import full **Features** app screens.

**Data boundaries**

- **SwiftData** is the UI source of truth; **Supabase** is the authoritative remote store; reconciliation and conflict handling live only in `Core/Sync/`.
- **DTOs** under `Core/Network/DTOs/` map to/from `@Model` types in repositories; SwiftUI views never decode raw JSON.

### Requirements to Structure Mapping

**FR category → primary location**

| FR category (PRD) | Primary location |
|---|---|
| Restaurant management | `Features/RestaurantDetail/`, `Core/Storage/Models/` |
| Data enrichment & ingestion | `ShareExtension/`, `Core/Enrichment/`, `supabase/functions/enrich-restaurant/` |
| Status & visit tracking | `Features/RestaurantDetail/`, `Core/Storage/Models/` (visits) |
| Map & list discovery | `Features/Map/`, `Features/RestaurantList/` |
| Social & friends | `Features/Friends/`, `Core/Sync/FriendSyncService.swift` |
| User account & settings | `Features/Onboarding/`, `Features/Settings/`, `Core/Network/AuthService.swift` |

**Cross-cutting concerns**

| Concern | Location |
|---|---|
| Offline queue & connectivity | `Core/Sync/SyncQueue.swift`, `NWPathMonitor` wiring |
| Realtime friend updates | `Core/Sync/RealtimeSubscriptions.swift` |
| Global app state | `Core/AppState.swift` |
| Design system | `UI/Theme/`, `UI/Components/` |

### Integration Points

**Internal communication:** View → ViewModel → Repository → `SyncQueue` / SwiftData / Supabase client.

**Share extension → main app:** Shared App Group container; same SwiftData store path; `NotificationCenter` for local change signals; Supabase for remote sync.

**External integrations:** Supabase Auth (email/password v1; Sign in with Apple optional pre–App Store); Supabase; APNs (post-MVP for digest); enrichment providers invoked only from Edge Functions.

### Data Flow (high level)

1. User action → ViewModel → Repository.
2. Repository writes SwiftData immediately and enqueues remote operations.
3. `SyncQueue` flushes to Supabase when online; Realtime delivers peer changes back into SwiftData via `Core/Sync/`.

### File Organization Patterns

**Configuration:** `Config/Config.xcconfig.example` committed; real `Config.xcconfig` per scheme gitignored; Supabase URL and `anon` key loaded at build time.

**Source:** Feature-first under `Features/`; shared logic under `Core/`; shared UI under `UI/`.

**Tests:** `PDXDeliciousnessFinderTests/` mirrors `Core/` and `Features/`; mocks live under `PDXDeliciousnessFinderTests/Mocks/`.

**Assets:** `Resources/Assets.xcassets`; pin icons and venue-type artwork colocated with map feature or under `Resources/` as appropriate.

### Development Workflow Integration

**Development:** Open `.xcodeproj`; run Debug scheme against `pdx-dev` Supabase (via `Config.xcconfig`).

**Build:** Xcode local builds; Xcode Cloud on push to `main` for TestFlight.

**Deployment:** Archive → App Store Connect; database changes via `supabase db push` from `/supabase/migrations/`.

## Architecture Validation Results

### Coherence Validation

**Decision compatibility:** Swift 6 / SwiftUI / MapKit / SwiftData / Supabase / App Groups / Share Extension / Edge Functions form a coherent stack. Hybrid enrichment (on-device schema.org + server-side Places), Realtime plus background refresh for social sync, and RLS for authorization align without contradiction. Supabase Swift SDK v2.43.0 is compatible with Swift 5.10+ and the chosen concurrency model.

**Pattern consistency:** Implementation patterns (`ViewState`, `SyncQueue` routing, `CodingKeys`, `SupabaseTables`, notification naming) reinforce the architectural decisions rather than fighting them.

**Structure alignment:** Feature / Core / UI layout supports stated boundaries (Core does not depend on Features; Share Extension imports Core only). `supabase/` mirrors backend ownership beside the iOS tree.

### Requirements Coverage Validation

**FR categories:** All six PRD capability areas map to explicit directories and services (see Requirements to Structure Mapping). Cross-cutting FRs (offline, sync, enrichment) are owned by named `Core/` modules.

**Non-functional requirements:** Offline-first reads (SwiftData), queued writes (`SyncQueue` + `NWPathMonitor`), map filter performance (local queries), friend sync latency (Realtime + BG refresh), and security (RLS, Edge Function secrets, `anon` key + policies) are each addressed by documented decisions or patterns.

### Implementation Readiness Validation

**Decision completeness:** Critical choices are recorded with rationale; Supabase Swift version is pinned. Deferred items (APNs detail, analytics) are explicitly labeled.

**Structure completeness:** Targets, folders, `supabase/migrations/` and `functions/` are specified. Repository access is implied by View → ViewModel → Repository flow; **concrete repository types** live under `Core/Storage/Repositories/` (add this folder when implementing the first data feature — mirrors the pattern already described in Implementation Patterns).

**Pattern completeness:** Naming, format, communication, process, and enforcement rules are documented with good and anti-examples.

### Gap Analysis Results

| Priority | Gap | Resolution |
|---|---|---|
| Important | PostgreSQL schema & RLS policies not fully specified | Expected next step during implementation; first migration defines tables and policies. |
| Important | Repository folder not in initial tree | **Resolved:** use `Core/Storage/Repositories/` for `RestaurantRepository`, etc. |
| Nice-to-have | SwiftLint rule bodies | Optional; add when the project exists. |
| Deferred | APNs + daily digest wiring | Already deferred in Core Decisions; unchanged. |

### Validation Issues Addressed

No blocking contradictions were found. The repository location clarifies the only structural ambiguity from the gap review.

### Architecture Completeness Checklist

**Requirements analysis**

- [x] Project context analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural decisions**

- [x] Critical decisions documented with versions where applicable
- [x] Technology stack specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project structure**

- [x] Directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements-to-structure mapping complete

### Architecture Readiness Assessment

**Overall status:** READY FOR IMPLEMENTATION

**Confidence level:** High — stack is consistent, FR/NFR coverage is traceable, and gaps are non-blocking or explicitly deferred.

**Key strengths:** Clear offline-first split (SwiftData vs Supabase); social model mapped to Realtime + queue; share extension and App Groups called out; enforcement rules reduce agent drift.

**Areas for future enhancement:** Full ERD and RLS policy text in repo; SwiftLint config; performance budgets per screen once UX is fixed.

### Implementation Handoff

**AI agent guidelines**

- Follow architectural decisions and patterns in this document as the single source of truth.
- Respect module boundaries: Features → Core/UI only; Share Extension → Core only.
- Route remote mutations through `SyncQueue`; use `ViewState` for async UI state.

**First implementation priority (order):**

1. Create Supabase `pdx-dev` project; add baseline SQL migrations under `supabase/migrations/`.
2. Wire email/password auth → Supabase Auth in the app.
3. Implement `Core/Storage` (SwiftData models, `PersistenceController`, `Core/Storage/Repositories/`).
4. Implement `Core/Sync` (`SyncQueue`, path monitor, first successful round-trip sync).

---

## Workflow Completion

The architecture workflow for **PDX Deliciousness Finder** is **complete**. This document is ready to drive consistent implementation and UX design handoff.

**Document status:** `complete` as of 2026-04-01.

**Suggested next steps:** Run `bmad-help` if you want a guided choice of the next BMAD skill (e.g. UX design, epics/stories, or implementation). When you are ready to build, create or open the Xcode project and execute the First Implementation Priority list above.
