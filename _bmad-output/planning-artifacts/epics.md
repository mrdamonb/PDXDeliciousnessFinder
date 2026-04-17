---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# PDX Deliciousness Finder - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for PDX Deliciousness Finder, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can add a restaurant to their personal list
FR2: Users can view a restaurant card showing all saved details for a restaurant
FR3: Users can edit any field on a restaurant card after saving
FR4: Users can delete a restaurant from their list
FR5: Users can assign a venue type to a restaurant (restaurant, bar, brewery, food cart)
FR6: Users can assign a cuisine type to a restaurant
FR7: Users can assign a price range to a restaurant
FR8: Users can add a restaurant by sharing any URL from any iOS app via the system share sheet
FR9: The system extracts restaurant name, address, website, cuisine, venue type, and price from a shared URL using schema.org structured data
FR10: The system falls back to a Places API lookup when schema.org data is unavailable or incomplete
FR11: Users can review and edit all pre-filled fields before saving (confirmation card)
FR12: Users can add a restaurant manually by entering name and address
FR13: Users can find and add a restaurant by searching for it by name within the app
FR14: Users can save a restaurant with only name and address when other data is unavailable
FR15: Users can set a restaurant's status to "Want to Go" (default) or "Been There"
FR16: Users can mark a Been There restaurant as a Favorite
FR17: Users can log multiple visits to a restaurant, each with a date
FR18: Users can add a general note to a restaurant that persists across all visits
FR19: Users can add a per-visit note to any visit log entry
FR20: Users can view the complete visit history for a restaurant
FR21: Users can view all their saved restaurants on a Portland map
FR22: The map displays pins color-coded by restaurant status (Want to Go, Been There, Favorite)
FR23: The map displays a venue-type icon on each pin (restaurant, bar, brewery, food cart)
FR24: Users can tap a map pin to open that restaurant's card
FR25: Users can filter the map by status, venue type, neighborhood, cuisine, and price range
FR26: Users can view their restaurants in a list view
FR27: Users can filter the list by status, venue type, neighborhood, cuisine, and price range
FR28: The system detects the Portland neighborhood of a restaurant from its address
FR29: Users can invite another person to connect as a friend via phone number or email
FR30: Users can accept or decline a friend invitation
FR31: Users can browse a connected friend's restaurant list in a dedicated Friends tab
FR32: Users can view a connected friend's restaurants on a map view within the Friends tab
FR33: Users can enable sync for a connected friend so that friend's new additions appear on the user's map
FR34: Users can disable sync for a connected friend without disconnecting from them
FR35: When a synced friend adds a restaurant the user does not have, it appears on the user's map with a friend attribution badge
FR36: When a synced friend adds a restaurant the user already has, a friend attribution badge is added without modifying the user's existing metadata
FR37: The system detects duplicate restaurants using address and name similarity matching
FR38: Users can add a friend's restaurant from the Friends tab into their own personal list
FR39: Users receive a daily digest notification summarizing new restaurants added by synced friends
FR40: Users can opt out of the daily digest notification
FR41: Users receive an immediate notification when a friend invitation is received or accepted
FR42: Users can create an account and sign in using email and password (Supabase Auth); Sign in with Apple may be added before App Store submission
FR43: Users can access their complete data on any iOS device using the same account (same email / Supabase user)
FR44: The system syncs user data across devices in real time via a cloud database
FR45: Users can manage notification preferences within the app
FR46: Users can view and manage all friend connections, including connected and synced states
FR47: Users can disconnect from a friend

### NonFunctional Requirements

NFR1: Map view renders all existing pins on a Portland-area map in under 2 seconds on a mid-range iPhone
NFR2: Share extension presents a pre-filled confirmation card within 3 seconds of activation for a typical restaurant URL
NFR3: List view filter results update in real time (under 500ms) as filters are applied or changed
NFR4: App cold start to usable map view in under 3 seconds
NFR5: Friend sync delivers new additions to a synced user's map within 60 seconds of the friend saving a restaurant
NFR6: All data transmitted between device and backend is encrypted in transit (TLS 1.2+)
NFR7: All user data stored in the backend database is encrypted at rest
NFR8: For v1, authentication uses email and password via Supabase Auth; credentials are not stored in the app (Supabase handles them). Sign in with Apple is out of scope for v1 TestFlight and optional before App Store if required by guideline 4.8
NFR9: User restaurant lists and notes are private by default; accessible only to the account owner and explicitly connected friends
NFR10: Friend connections require mutual acceptance before any data is shared; no user can access another's list without permission
NFR11: Backend architecture supports scaling to 10,000 active users without requiring architectural changes
NFR12: Data model is designed to support multi-city expansion without schema migrations to existing user records
NFR13: App supports iOS Dynamic Type for all text elements
NFR14: Map pin status is conveyed through both color and icon (not color alone) so the app is usable by colorblind users
NFR15: All interactive tap targets meet Apple HIG minimum size of 44×44pt
NFR16: The app must feel like a personal journal, not a public directory — no public profiles, follower counts, review prompts, or social performance signals
NFR17: schema.org scraping handles failed or malformed responses gracefully — falls back to Places API rather than crashing
NFR18: Places API fallback handles rate limits and errors gracefully — presents a partially-filled confirmation card rather than a failure state
NFR19: Apple Push Notification Service (APNs) delivers immediate notifications (invites, accepted connections) within 30 seconds
NFR20: Cloud database sync handles network interruptions without data loss — queues writes locally and retries when connectivity is restored
NFR21: Offline read access to the full restaurant list and map is maintained regardless of network state

### Additional Requirements

From Architecture — these drive story content, acceptance criteria, and implementation sequencing:

- ARCH-1: Xcode project with main app target + Share Extension as a separate target; both share an App Groups entitlement for the shared data container
- ARCH-2: SwiftData as local cache layer (UI source of truth); Supabase PostgreSQL as the authoritative remote store
- ARCH-3: SyncQueue + NWPathMonitor pattern for offline write queue — writes enqueue locally and flush on connectivity restore with exponential back-off retry (3 attempts)
- ARCH-4: Supabase Realtime subscriptions for foreground friend sync; BGAppRefreshTask polling for background sync (~15 min minimum)
- ARCH-5: Two-stage enrichment pipeline — schema.org scraping on-device (stage 1, free, no secrets); Supabase Edge Function calling Places API server-side (stage 2, fallback only)
- ARCH-6: pg_trgm fuzzy matching (address + name similarity) for duplicate detection at add time and sync time
- ARCH-7: Non-destructive sync merge — sync can only add to a user's list, never overwrite existing user metadata
- ARCH-8: ViewState<T> enum pattern required for all async UI state (idle / loading / loaded / error); raw isLoading booleans are prohibited on ViewModels
- ARCH-9: All Supabase mutations must route through SyncQueue — direct supabase.from() calls from ViewModels are prohibited
- ARCH-10: SupabaseTables enum for all table name references — no raw string literals in feature code
- ARCH-11: CodingKeys on all Supabase DTOs for snake_case ↔ camelCase mapping
- ARCH-12: Feature-first directory structure: Features/ → Core/UI only; Core/ must not import Features; ShareExtension imports Core only
- ARCH-13: Core/Storage/Repositories/ pattern — RestaurantRepository, VisitLogRepository, FriendRepository as the data access layer
- ARCH-14: Two environment configurations: pdx-dev and pdx-prod, managed via Config.xcconfig (gitignored) loaded at build time
- ARCH-15: Xcode Cloud CI/CD for automated TestFlight distribution on push to main

### UX Design Requirements

Note: UX Design Specification is in progress (executive summary captured; full screen-level spec pending merge). Stories marked [UX-PENDING] should be revisited once the full spec is available. High-fidelity mockups covering all 6 primary screens are available at github.com/mrdamonb/Delicious-screens.

UX-DR1: Map view must support one-handed filter application while standing — filters must be dead-simple, not modal
UX-DR2: Share extension confirmation card must feel auto-filled and trustworthy; every field must be clearly editable; transition from iOS share sheet must feel native and fast (<3s)
UX-DR3: Two-tier social model (Connected vs Synced) must be immediately understandable without onboarding text or tooltips [UX-PENDING]
UX-DR4: Status transitions (Want to Go → Been There → Favorite) must feel natural; mark-as-visited + log notes flow must be discoverable without instruction
UX-DR5: Portland identity: neighborhood labels on map, warm earthy color palette, food carts as first-class venue type with distinct pin icon
UX-DR6: First map open "aha moment" — personal food geography of Portland lit up with color-coded pins must be maximized; empty state design must guide first-time users clearly
UX-DR7: Friend attribution badges on map pins and restaurant cards ("Mia loves this") as trust and decision signals [UX-PENDING]
UX-DR8: iOS-native visual language throughout all 6 primary screens (Map, Detail, Share Confirmation, List, Friends, Empty State)
UX-DR9: Filter combination flow (status + neighborhood + price simultaneously) must feel effortless — accessible in one motion, not buried in menus
UX-DR10: Design system: consistent color tokens for status colors (Want to Go / Been There / Favorite), venue-type iconography, and spacing — defined in UI/Theme/ [UX-PENDING]

### NFRs Covered by Architecture (No Dedicated Story Needed)

- NFR6 (TLS 1.2+): Enforced by Supabase infrastructure — all PostgREST/Realtime/Auth traffic is TLS by default
- NFR7 (encryption at rest): Enforced by Supabase PostgreSQL configuration
- NFR11 (10,000 user scalability): Validated by Supabase horizontal scaling + RLS-based architecture
- NFR12 (multi-city without migration): Validated by the `city` column on `restaurants` table — no schema change needed to support additional cities

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 2 | Add restaurant to personal list |
| FR2 | Epic 2 | View restaurant card |
| FR3 | Epic 2 | Edit restaurant card fields |
| FR4 | Epic 2 | Delete restaurant |
| FR5 | Epic 2 | Assign venue type |
| FR6 | Epic 2 | Assign cuisine type |
| FR7 | Epic 2 | Assign price range |
| FR8 | Epic 4 | Add via iOS share sheet |
| FR9 | Epic 4 | schema.org extraction |
| FR10 | Epic 4 | Places API fallback |
| FR11 | Epic 4 | Confirmation card edit before save |
| FR12 | Epic 2 | Manual add (name + address) |
| FR13 | Epic 4 | Search-to-add |
| FR14 | Epic 2 | Save with partial data |
| FR15 | Epic 2 | Want to Go / Been There status |
| FR16 | Epic 2 | Favorite sub-state |
| FR17 | Epic 2 | Log multiple visits with dates |
| FR18 | Epic 2 | General restaurant note |
| FR19 | Epic 2 | Per-visit note |
| FR20 | Epic 2 | View full visit history |
| FR21 | Epic 3 | Map view of all restaurants |
| FR22 | Epic 3 | Status color-coded pins |
| FR23 | Epic 3 | Venue-type icons on pins |
| FR24 | Epic 3 | Tap pin → restaurant card |
| FR25 | Epic 3 | Filter map |
| FR26 | Epic 3 | List view |
| FR27 | Epic 3 | Filter list |
| FR28 | Epic 3 | Neighborhood detection |
| FR29 | Epic 5 | Send friend invite |
| FR30 | Epic 5 | Accept/decline invite |
| FR31 | Epic 5 | Browse friend's list in Friends tab |
| FR32 | Epic 5 | View friend's restaurants on map |
| FR33 | Epic 5 | Enable sync for a friend |
| FR34 | Epic 5 | Disable sync without disconnecting |
| FR35 | Epic 5 | New synced restaurant → map with badge |
| FR36 | Epic 5 | Existing restaurant → add badge only |
| FR37 | Epic 5 | Duplicate detection |
| FR38 | Epic 5 | Add friend's restaurant to own list |
| FR39 | Epic 5 | Daily digest notification |
| FR40 | Epic 5 | Opt out of digest |
| FR41 | Epic 5 | Immediate invite notifications |
| FR42 | Epic 1 | Email/password sign-up and sign-in (Supabase) |
| FR43 | Epic 1 | Multi-device access |
| FR44 | Epic 1 | Real-time cloud sync |
| FR45 | Epic 5 | Notification preferences |
| FR46 | Epic 5 | View/manage friend connections |
| FR47 | Epic 5 | Disconnect from a friend |

## Epic List

### Epic 1: Signed In & Ready
Users can install the app, create an account or sign in with email and password, and land in a functional shell that persists their session across devices and app launches. The foundational storage and sync infrastructure (SwiftData, SyncQueue, Core/Storage/Repositories) is in place so every subsequent epic builds on a solid foundation.
**FRs covered:** FR42, FR43, FR44
**Also covers:** ARCH-1 through ARCH-15 (Xcode project, App Groups, SwiftData models, SyncQueue, Core/Sync, repositories pattern)

### Epic 2: Your Portland Food Journal
Users can add restaurants manually, view and edit a restaurant card with all its details, track status (Want to Go / Been There / Favorite), log visits with dates and notes, and delete restaurants. This is the complete personal curation loop and the quick win foundation.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20

### Epic 3: Find What to Eat Tonight
Users can open a Portland map and see all their restaurants as color-coded, venue-typed pins, filter the map and list view by status / neighborhood / cuisine / price, and tap any pin to open its restaurant card. This is the 30-second sidewalk decision moment.
**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28

### Epic 4: Add Restaurants Instantly
Users can share any restaurant URL from Safari, Google Maps, Yelp, or any iOS app and get a pre-filled confirmation card (name, address, cuisine, venue type, price) in under 3 seconds — no manual entry required on the happy path.
**FRs covered:** FR8, FR9, FR10, FR11

### Epic 5: Your Trusted Circle
Users can invite friends, browse a friend's restaurant list in a dedicated Friends tab, toggle sync so a friend's new additions appear on their map with attribution badges, and manage the two-tier connection/sync relationship independently.
**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR45, FR46, FR47

---

## Epic 1: Signed In & Ready

Users can install the app, sign up or sign in with email and password, and have their session persist across devices and app launches. The foundational storage and sync infrastructure (SwiftData, SyncQueue, Core/Storage/Repositories) is in place so every subsequent epic builds on a solid foundation.

**FRs covered:** FR42, FR43, FR44
**NFRs:** NFR8, NFR20, NFR21
**Also covers:** ARCH-1 through ARCH-15

### Story 1.1: App Foundation & Email Sign-In

As a Portland food enthusiast,
I want to sign up or sign in with my email and password and have my session persist across app launches,
So that I can start using the app on TestFlight without a paid Apple Developer account and still sync across devices with the same account.

**Acceptance Criteria:**

**Given** the app is freshly installed
**When** I open it
**Then** I see an onboarding screen with email and password fields (and a clear path to create an account if I am new)

**Given** I enter a valid email and password and submit sign-in (or complete sign-up if I am new)
**When** Supabase authentication succeeds
**Then** I am taken to the app's home screen

**Given** I have previously signed in
**When** I open the app
**Then** I land directly on the home screen without seeing the onboarding screen

**Given** I am on the home screen
**When** I tap "Sign Out"
**Then** I am returned to the onboarding screen and my Supabase session is cleared from the Keychain

**Given** the app builds for the Debug scheme
**When** any Supabase client call is made
**Then** it routes to the pdx-dev project using credentials loaded from Config.xcconfig (not hardcoded in Swift)

**Given** a new user authenticates for the first time
**When** authentication succeeds
**Then** a user profile row is automatically created in the public.users table via the handle_new_user trigger (on any `auth.users` insert, regardless of provider)

*Covers: FR42, NFR8, ARCH-1, ARCH-14*

---

### Story 1.2: SwiftData Core Storage Layer

As a Portland food enthusiast,
I want the app to store my restaurant data locally on my device,
So that the app is fast and works fully without an internet connection.

**Acceptance Criteria:**

**Given** the app is launched with no network connection
**When** I navigate to the restaurant list
**Then** all previously saved restaurants are visible without any loading delay

**Given** the SwiftData ModelContainer is initialized
**When** it is configured
**Then** it uses the App Groups shared container path so the Share Extension can access the same data store in a future epic

**Given** a Restaurant model exists in SwiftData
**When** I inspect its properties
**Then** it contains: id, userId, name, address, latitude, longitude, neighborhood, city, website, cuisine, venueType, priceRange, status, generalNote, placeId, sourceUrl, createdAt, updatedAt — with venueType constrained to (restaurant, bar, brewery, food_cart) and status to (want_to_go, been_there, favorite)

**Given** a VisitLog model exists in SwiftData
**When** I inspect its properties
**Then** it contains: id, restaurantId, userId, visitedAt, note, createdAt

**Given** RestaurantRepository.save() is called
**When** the operation completes
**Then** the restaurant is immediately available in SwiftData queries without waiting for a Supabase round-trip

*Covers: NFR21, ARCH-2, ARCH-3, ARCH-12, ARCH-13*

---

### Story 1.3: Offline Write Queue (Outbound Sync)

As a Portland food enthusiast,
I want changes I make while offline to sync automatically when I'm back online,
So that I never lose data regardless of connectivity.

**Acceptance Criteria:**

**Given** I add a restaurant while online
**When** the save completes
**Then** the restaurant is written to SwiftData immediately AND enqueued to sync to Supabase — the UI confirms save before the network round-trip completes

**Given** I add a restaurant while offline
**When** connectivity is restored
**Then** the queued restaurant syncs to Supabase automatically within 30 seconds, with up to 3 retry attempts using exponential backoff

**Given** a sync operation fails all 3 retry attempts
**When** the final failure occurs
**Then** the error is surfaced inline via the ViewState pattern — no blocking modal alert is shown

**Given** any ViewModel performs a write operation
**When** the write is triggered
**Then** it routes through SyncQueue via a Repository method — no direct supabase.from() calls exist in ViewModel code

**Given** the device transitions from offline to online (detected via NWPathMonitor)
**When** the queue contains pending operations
**Then** they flush in insertion order automatically

*Covers: FR43, NFR20, ARCH-3, ARCH-8, ARCH-9*

---

### Story 1.4: Realtime Inbound Sync (Multi-Device)

As a Portland food enthusiast,
I want restaurants I add on one device to appear on my other devices automatically,
So that my list is always current no matter which device I'm using.

**Acceptance Criteria:**

**Given** I am signed in on two devices
**When** I add a restaurant on Device A while Device B is foregrounded
**Then** the restaurant appears on Device B's list within 60 seconds via Supabase Realtime subscription

**Given** the app is foregrounded
**When** a Realtime subscription is active
**Then** changes from the remote database (inserts, updates, deletes) are written into the local SwiftData store automatically

**Given** the app has been in the background
**When** I bring it to the foreground
**Then** the Realtime subscription reconnects and any missed changes are reconciled

**Given** a restaurant exists locally and a remote update arrives for the same record
**When** the sync reconciliation runs
**Then** the remote authoritative data is applied without losing any locally queued but unsynced writes

*Covers: FR44, NFR20, ARCH-4*

---

## Epic 2: Your Portland Food Journal

Users can add restaurants manually, view and edit a restaurant card with all its details, track status (Want to Go / Been There / Favorite), log visits with dates and notes, and delete restaurants. This is the complete personal curation loop and the quick win foundation.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR12, FR14, FR15, FR16, FR17, FR18, FR19, FR20
**NFRs:** NFR13, NFR15, NFR16, NFR20
**Note:** FR13 (search-to-add) moved to Epic 4 — requires enrichment Edge Function.

### Story 2.1: Add a Restaurant Manually

As a Portland food enthusiast,
I want to add a restaurant to my list by typing its name and optionally filling in its details,
So that I can capture a recommendation immediately even without a URL.

**Acceptance Criteria:**

**Given** I tap "Add Restaurant"
**When** the add form appears
**Then** name is the only required field; address, venue type (restaurant/bar/brewery/food cart), cuisine, and price range ($/$$/$$$/$$$$) are optional

**Given** I enter a restaurant name and tap Save
**When** the save completes
**Then** the restaurant appears in my list with status "Want to Go" by default

**Given** I save a restaurant with only a name (no address)
**When** it is saved
**Then** it saves successfully and displays gracefully in the list without an address

**Given** I save a restaurant while offline
**When** connectivity is restored
**Then** the restaurant syncs to Supabase automatically with no data loss

**Given** I attempt to save with no name entered
**When** I tap Save
**Then** an inline validation error appears and the save is blocked

*Covers: FR1, FR5, FR6, FR7, FR12, FR14, NFR15, NFR20*

---

### Story 2.2: View Your Restaurant List

As a Portland food enthusiast,
I want to see all my saved restaurants in a scrollable list,
So that I can browse what I've collected and tap into any restaurant's card.

**Acceptance Criteria:**

**Given** I have restaurants saved
**When** I view the restaurant list
**Then** each row shows restaurant name, venue type, status badge, and cuisine — all readable at a glance

**Given** I tap a restaurant row
**When** the restaurant card opens
**Then** I see all saved fields: name, address, website, venue type, cuisine, price range, status, general note, and visit count

**Given** I have no restaurants saved
**When** I open the list
**Then** I see an empty state with a clear prompt to add my first restaurant

**Given** I add a restaurant
**When** I return to the list view
**Then** the new restaurant appears at the top without requiring a manual refresh

*Covers: FR2, UX-DR6, NFR13, NFR15*

*Navigation note: The PRD designates the map as the primary home view and the list as secondary. In Epic 2 (before map exists), the list view serves as the temporary home screen. In Epic 3, the map becomes the default landing screen with a toggle to switch between map and list. Stories in Epic 2 should not hardcode list-as-home navigation assumptions.*

---

### Story 2.3: Edit a Restaurant's Details

As a Portland food enthusiast,
I want to edit any field on a restaurant card after saving it,
So that I can fix mistakes or add details I didn't have at first.

**Acceptance Criteria:**

**Given** I am viewing a restaurant card
**When** I tap "Edit"
**Then** all fields become editable: name, address, website, venue type, cuisine, price range, general note

**Given** I edit a field and tap Save
**When** the save completes
**Then** the updated value is immediately visible on the card and in the list

**Given** I edit a restaurant while offline
**When** connectivity is restored
**Then** the updated restaurant syncs to Supabase with no data loss

**Given** I tap Edit and then tap Cancel
**When** I return to the card
**Then** no changes were saved

*Covers: FR3, NFR20*

---

### Story 2.4: Set Restaurant Status

As a Portland food enthusiast,
I want to mark a restaurant as Want to Go, Been There, or Favorite,
So that my list reflects my actual relationship with each place.

**Acceptance Criteria:**

**Given** I save a new restaurant
**When** it appears in my list
**Then** its status is "Want to Go" by default

**Given** I am viewing a restaurant card
**When** I tap "Mark as Visited"
**Then** the status changes to "Been There" and a visit log entry is created with today's date

**Given** a restaurant has status "Been There"
**When** I tap the Favorite toggle
**Then** the status becomes "Favorite" and the restaurant is visually distinguished in the list

**Given** a restaurant has status "Favorite"
**When** I tap the Favorite toggle again
**Then** the status reverts to "Been There" (not to "Want to Go")

**Given** I change a restaurant's status
**When** I return to the list
**Then** the status badge reflects the new state immediately — no refresh needed

*Covers: FR15, FR16, UX-DR4*

---

### Story 2.5: Log Visits & Notes

As a Portland food enthusiast,
I want to log each time I visit a restaurant and capture what I thought,
So that I can remember my experiences and build a useful personal record.

**Acceptance Criteria:**

**Given** I mark a restaurant as visited
**When** the visit is logged
**Then** a visit entry is created with today's date and I am prompted to add an optional per-visit note

**Given** a restaurant has existing visits
**When** I tap "Add Visit"
**Then** I can log a new visit with a custom date (not just today) and an optional note

**Given** I am viewing a restaurant card
**When** I scroll to the visit history section
**Then** I see all visits in reverse chronological order, each with its date and note (if any)

**Given** I am viewing a restaurant card
**When** I tap the general note field
**Then** I can add or edit a note that persists across all visits (separate from per-visit notes)

**Given** I add a per-visit note while offline
**When** connectivity is restored
**Then** the note syncs to Supabase with no data loss

*Covers: FR17, FR18, FR19, FR20, NFR20*

---

### Story 2.6: Delete a Restaurant

As a Portland food enthusiast,
I want to delete a restaurant from my list,
So that I can keep my list clean when a place closes or I no longer want it.

**Acceptance Criteria:**

**Given** I am viewing a restaurant card
**When** I tap "Delete"
**Then** a confirmation prompt appears with the restaurant name before anything is deleted

**Given** I confirm the deletion
**When** the delete completes
**Then** the restaurant and all its visit logs are removed from both SwiftData and Supabase

**Given** I delete a restaurant while offline
**When** connectivity is restored
**Then** the deletion syncs to Supabase automatically

**Given** I cancel the deletion prompt
**When** I return to the card
**Then** the restaurant is unchanged

*Covers: FR4, NFR20*

---

## Epic 3: Find What to Eat Tonight

Users can open a Portland map and see all their restaurants as color-coded, venue-typed pins, filter by status / neighborhood / cuisine / price in one motion, switch to a list view with the same filters, and tap any pin or row to open a restaurant card. This is the 30-second sidewalk decision moment.

**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28
**NFRs:** NFR1, NFR3, NFR4, NFR13, NFR14
**UX-DRs:** UX-DR1, UX-DR5, UX-DR6, UX-DR8, UX-DR9

### Story 3.1: Portland Map with Restaurant Pins

As a Portland food enthusiast,
I want to see all my saved restaurants on a Portland map with pins that show me at a glance what each place is and whether I've been there,
So that I can see my personal food geography of Portland.

**Acceptance Criteria:**

**Given** I have restaurants with latitude/longitude saved
**When** I open the map view
**Then** I see a MapKit map centered on Portland with a pin for each restaurant, rendered in under 2 seconds

**Given** a restaurant has status "Want to Go"
**When** it renders on the map
**Then** its pin is a distinct color from "Been There" and "Favorite" — and status is conveyed through both color AND icon so the map is usable by colorblind users

**Given** a restaurant has a venue type set
**When** it renders on the map
**Then** its pin displays a venue-type icon (restaurant, bar, brewery, food cart) — food carts are a first-class venue type with a distinct icon

**Given** I tap a pin on the map
**When** the tap is registered
**Then** the restaurant card opens for that restaurant

**Given** I have no restaurants saved
**When** I open the map
**Then** I see the Portland-area map with an empty state overlay guiding me to add my first restaurant

**Given** the map requests location permission
**When** I grant "When In Use"
**Then** the map centers on my current position within Portland

*Covers: FR21, FR22, FR23, FR24, NFR1, NFR4, NFR14, UX-DR5, UX-DR6*

---

### Story 3.2: Filter the Map

As a Portland food enthusiast,
I want to filter the map by status, venue type, neighborhood, cuisine, and price,
So that I can instantly narrow down my options when deciding where to eat.

**Acceptance Criteria:**

**Given** I am viewing the map with multiple pins
**When** I open the filter bar
**Then** I see filter options for: status, venue type, neighborhood, cuisine, and price range — all accessible in one motion, not buried in sub-menus

**Given** I select "Want to Go" + "NW Portland" + "under $$$"
**When** the filters apply
**Then** only pins matching all three criteria remain visible, and the update happens in under 500ms

**Given** I apply a filter
**When** I then clear all filters
**Then** all pins reappear immediately

**Given** multiple filters are active
**When** I look at the filter bar
**Then** the active filter count or active labels are visible so I know what's currently filtered

**Given** filters are active
**When** I tap a visible pin
**Then** the correct restaurant card opens — filtering doesn't break pin-tap interaction

*Covers: FR25, NFR1, NFR3, UX-DR1, UX-DR9*

---

### Story 3.3: Restaurant List View with Filters

As a Portland food enthusiast,
I want to switch to a list view of my restaurants with the same filter options as the map,
So that I can browse my list when I want a scannable format instead of geography.

**Acceptance Criteria:**

**Given** I am on the map view
**When** I tap the list view toggle
**Then** I see my restaurants in a scrollable list, sorted by name or most recently added

**Given** I am in list view
**When** I apply filters (status, venue type, neighborhood, cuisine, price)
**Then** the list updates in real time (under 500ms) to show only matching restaurants

**Given** I apply filters in the map view and switch to list view
**When** the list renders
**Then** it reflects the same active filters — the filter state is shared between map and list

**Given** I tap a restaurant row in the list
**When** the tap is registered
**Then** the restaurant card opens for that restaurant

**Given** I am in list view with all text at default size
**When** I increase iOS Dynamic Type size in settings
**Then** all text in the list adjusts to the larger type size without layout breakage

*Covers: FR26, FR27, NFR3, NFR13, UX-DR8*

---

### Story 3.4: Neighborhood Detection

As a Portland food enthusiast,
I want the app to automatically detect which Portland neighborhood a restaurant is in,
So that I can filter by neighborhood without manually entering it.

**Acceptance Criteria:**

**Given** I save a restaurant with a Portland address
**When** the address is processed
**Then** the app assigns a Portland neighborhood (e.g., Alberta, Division, Hawthorne, Pearl, Mississippi, NW 23rd) based on the address

**Given** a restaurant has a detected neighborhood
**When** I view it in the list or card
**Then** the neighborhood label is displayed

**Given** the neighborhood detection cannot determine a match
**When** the restaurant is saved
**Then** the neighborhood field is left empty (not a blocking error) and the restaurant saves successfully

**Given** I edit a restaurant's address
**When** I save the edit
**Then** the neighborhood is re-detected from the updated address

*Covers: FR28, UX-DR5*

*Technical note: Neighborhood detection should use a local GeoJSON polygon lookup shipped in the app bundle — Portland neighborhoods have well-defined boundaries. This approach works offline, has zero latency, and requires no network call. Do not use CLGeocoder or a server-side call for this.*

---

## Epic 4: Add Restaurants Instantly

Users can share any restaurant URL from Safari, Google Maps, Yelp, or any iOS app and get a pre-filled confirmation card in under 3 seconds — no manual entry required on the happy path. The two-pass enrichment pipeline (schema.org on-device, Places API server-side fallback) and search-to-add flow live here.

**FRs covered:** FR8, FR9, FR10, FR11, FR13
**NFRs:** NFR2, NFR17, NFR18
**ARCH:** ARCH-5
**UX-DRs:** UX-DR2

### Story 4.1: Share Extension & Schema.org Enrichment

As a Portland food enthusiast,
I want to share a restaurant URL from any iOS app and see a pre-filled confirmation card appear instantly,
So that I can save a restaurant in seconds without typing anything.

**Acceptance Criteria:**

**Given** I find a restaurant on any website, Google Maps, or Yelp
**When** I tap the iOS share button and select PDX Deliciousness Finder
**Then** the share extension opens and presents a confirmation card within 3 seconds

**Given** the shared URL contains schema.org structured data
**When** the extension parses it
**Then** the confirmation card is pre-filled with restaurant name, address, website, cuisine, venue type, and price (all fields that are extractable)

**Given** the schema.org parse succeeds
**When** I review the confirmation card
**Then** every pre-filled field is clearly editable — I can correct any field before saving

**Given** I tap Save on the confirmation card
**When** the save completes
**Then** the restaurant is written to the shared SwiftData store (App Groups) with status "Want to Go" and I'm returned to the source app

**Given** the share extension writes a restaurant
**When** I open the main app
**Then** the new restaurant appears in my list and on the map without requiring a manual refresh

**Given** the shared URL has no schema.org data
**When** the parse returns incomplete
**Then** the extension does NOT crash — it proceeds to the Places API fallback (Story 4.2)

*Covers: FR8, FR9, FR11, NFR2, NFR17, ARCH-5, UX-DR2*

---

### Story 4.2: Places API Fallback via Edge Function

As a Portland food enthusiast,
I want the app to fill in restaurant details from a Places API when the shared URL doesn't have structured data,
So that the confirmation card is still useful even for URLs without schema.org markup.

**Acceptance Criteria:**

**Given** a shared URL yields incomplete schema.org data (e.g., missing address or name)
**When** the extension detects incomplete data
**Then** it calls the Supabase enrich-restaurant Edge Function with the available data (name, URL, partial address) to request Places API enrichment

**Given** the Edge Function receives a request
**When** it queries the Places API
**Then** it returns name, address, latitude, longitude, cuisine, venue type, and price — merged with any data already extracted from schema.org

**Given** the Edge Function returns enriched data
**When** the confirmation card updates
**Then** all returned fields are pre-filled and editable

**Given** the Edge Function fails (rate limit, timeout, or error)
**When** the failure is handled
**Then** the confirmation card shows whatever data is available (even if only the URL) with empty fields ready for manual entry — no error modal is shown

**Given** the user is offline when the share extension fires
**When** the extension runs
**Then** the restaurant is saved locally with whatever data is available; the enrichment call is deferred until connectivity is restored

**Given** the Places API key
**When** the system architecture is inspected
**Then** the key exists only in Supabase Edge Function environment variables — it is never shipped on-device

*Covers: FR10, NFR18, ARCH-5*

---

### Story 4.3: Search-to-Add Within the App

As a Portland food enthusiast,
I want to search for a restaurant by name from inside the app and add it to my list,
So that I have a fallback when I don't have a URL to share.

**Acceptance Criteria:**

**Given** I am on the add restaurant screen
**When** I type a restaurant name and tap "Search"
**Then** the app calls the search-places Edge Function and returns matching restaurants with name, address, and available metadata

**Given** search results are displayed
**When** I tap a result
**Then** the confirmation card opens pre-filled with the result's data — all fields editable before saving

**Given** the search returns no results
**When** I see the empty state
**Then** I am offered a clear path to the manual add form instead

**Given** I search while offline
**When** the search fails
**Then** an inline message explains search requires connectivity and offers manual add as an alternative

*Covers: FR13, ARCH-5*

---

## Epic 5: Your Trusted Circle

Users can invite friends, browse a friend's restaurant list in a dedicated Friends tab, toggle sync so a friend's new additions flow into their own map with attribution badges, manage the two-tier connection/sync relationship, and receive notifications about friend activity.

**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR45, FR46, FR47
**NFRs:** NFR5, NFR9, NFR10, NFR19
**ARCH:** ARCH-4, ARCH-6, ARCH-7
**UX-DRs:** UX-DR3, UX-DR7

### Story 5.1: Invite & Connect with Friends

As a Portland food enthusiast,
I want to invite friends to connect with me in the app,
So that we can share our restaurant lists within a trusted circle.

**Acceptance Criteria:**

**Given** I am signed in
**When** I navigate to the Friends tab
**Then** I see a list of my existing connections (if any) and a clear option to "Invite a Friend"

**Given** I tap "Invite a Friend"
**When** the invite form appears
**Then** I can enter a phone number or email address to send the invitation

**Given** I send an invitation
**When** the recipient opens the app and is signed in
**Then** they see a pending invitation they can accept or decline

**Given** a friend accepts my invitation
**When** the acceptance is processed
**Then** the connection status becomes "connected" for both parties and each can browse the other's list

**Given** a friend declines my invitation
**When** the decline is processed
**Then** the invitation is removed from both views — no error, no awkwardness

**Given** I receive a friend invitation
**When** I open the app
**Then** I see a notification badge on the Friends tab and the pending invitation is prominently displayed

**Given** I already have a connection with a user
**When** I try to invite the same person again
**Then** the app prevents a duplicate invitation and shows an appropriate message

*Covers: FR29, FR30, NFR9, NFR10*

---

### Story 5.2: Browse a Friend's Restaurant List

As a Portland food enthusiast,
I want to browse a connected friend's restaurant list and see their restaurants on a map,
So that I can discover places they know about.

**Acceptance Criteria:**

**Given** I have a connected friend
**When** I tap their name in the Friends tab
**Then** I see their restaurant list — each entry showing name, venue type, status, and cuisine

**Given** I am viewing a friend's list
**When** I tap the map toggle
**Then** I see their restaurants rendered on a Portland map with the same pin color/icon conventions as my own map

**Given** I am browsing a friend's list
**When** I tap a restaurant
**Then** I see the restaurant card with the friend's details — their notes, status, and visit count

**Given** I am not connected with someone
**When** I attempt to view their data
**Then** I cannot access it — RLS policies enforce mutual connection

*Covers: FR31, FR32, NFR9, NFR10*

---

### Story 5.3: Add a Friend's Restaurant to My List

As a Portland food enthusiast,
I want to add a restaurant from a friend's list into my own list,
So that I can keep track of their recommendations in my personal map and filters.

**Acceptance Criteria:**

**Given** I am viewing a restaurant in a friend's list
**When** I tap "Add to My List"
**Then** the restaurant is copied into my personal list with status "Want to Go" and a "recommended by [friend name]" attribution tag

**Given** I add a friend's restaurant that I already have in my list (matched by address + name similarity)
**When** the duplicate is detected
**Then** a friend attribution badge is added to my existing restaurant without overwriting any of my metadata

**Given** two restaurants share the same address but have different names (e.g., food cart pod)
**When** the duplicate check runs
**Then** they are treated as separate restaurants and both are kept — no false merge

*Covers: FR38, FR37, ARCH-6, ARCH-7*

---

### Story 5.4: Sync a Friend's New Additions to My Map

As a Portland food enthusiast,
I want to toggle sync for a friend so their new restaurant additions automatically appear on my map,
So that I passively discover new places from people whose taste I trust.

**Acceptance Criteria:**

**Given** I am viewing a connected friend's profile
**When** I toggle "Sync" on
**Then** all new restaurants they add going forward appear on my map with a friend attribution badge

**Given** I have sync enabled for a friend
**When** they add a new restaurant
**Then** it appears on my map within 60 seconds if I have the app foregrounded (via Realtime subscription)

**Given** I have sync enabled for a friend
**When** they add a restaurant I already have (matched by address + name)
**Then** a friend badge is added to my existing entry without overwriting my metadata (non-destructive merge)

**Given** I want to stop receiving a friend's additions
**When** I toggle "Sync" off
**Then** sync stops immediately; previously synced restaurants remain on my map but no new ones flow in — and the friend connection is unchanged

**Given** I have the app in the background
**When** a synced friend adds restaurants
**Then** updates arrive via BGAppRefreshTask the next time it fires (~15 min cadence)

**Given** the two-tier model (Connected vs Synced)
**When** I view a friend's connection card
**Then** the distinction is immediately understandable — connected means "I can browse their list," synced means "their new adds flow to my map" [UX-PENDING]

*Covers: FR33, FR34, FR35, FR36, FR37, NFR5, ARCH-4, ARCH-6, ARCH-7, UX-DR3, UX-DR7*

---

### Story 5.5: Friend Notifications

As a Portland food enthusiast,
I want to receive notifications about friend activity,
So that I know when someone invites me, accepts my invite, or adds new restaurants.

**Acceptance Criteria:**

**Given** someone sends me a friend invitation
**When** the invitation is created
**Then** I receive an immediate push notification within 30 seconds

**Given** a friend accepts my invitation
**When** the acceptance is processed
**Then** I receive an immediate push notification within 30 seconds

**Given** I have synced friends who add new restaurants
**When** the daily digest fires
**Then** I receive a single notification summarizing how many new restaurants were added and by which friends

**Given** the daily digest notification is active
**When** I open app settings
**Then** I can opt out of the daily digest while still receiving immediate friend invite notifications

**Given** I have opted out of the digest
**When** a synced friend adds restaurants
**Then** I receive no digest notification — the restaurants still sync silently to my map

*Covers: FR39, FR40, FR41, NFR19*

---

### Story 5.6: Manage Friend Connections & Settings

As a Portland food enthusiast,
I want to manage all my friend connections and notification preferences in one place,
So that I stay in control of who can see my list and what notifications I receive.

**Acceptance Criteria:**

**Given** I open the Friends management screen
**When** it renders
**Then** I see all connections grouped by state: pending invites (sent and received), connected friends (with sync status for each)

**Given** I am viewing a connected friend
**When** I tap "Disconnect"
**Then** a confirmation prompt appears; confirming removes the connection for both parties — their synced restaurants remain in my list but the friend badge is removed

**Given** I am in app settings
**When** I view notification preferences
**Then** I can independently toggle: immediate invite notifications, daily digest notifications

**Given** I disconnect from a friend who was synced
**When** the disconnect completes
**Then** sync stops, the connection is removed, but restaurants I previously added from their list remain in my personal list as my own data

*Covers: FR45, FR46, FR47, NFR9*
