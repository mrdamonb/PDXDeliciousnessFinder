---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain-skipped, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
workflowStatus: complete
completedAt: 2026-04-01
classification:
  projectType: mobile_app
  domain: general
  complexity: medium
  projectContext: greenfield
inputDocuments:
  - /Users/damonbrennen/Downloads/pdx_deliciousness_finder_concept.md
  - /Users/damonbrennen/Documents/AI-Projects/BMAD/_bmad-output/brainstorming/brainstorming-session-2026-03-26-session.md
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
---

# Product Requirements Document - PDX Deliciousness Finder

**Author:** Damonbrennen
**Date:** 2026-04-01

## Executive Summary

PDX Deliciousness Finder is a native iOS application for Portland food enthusiasts who need a personal, mobile-first system to track restaurants they want to try, places they've been, and favorites — and to share that knowledge within a trusted circle of friends. It replaces the failed workarounds (Google Sheets, Notes, Google Maps lists) that break down on mobile and provide no trusted social signal.

The product is Portland-specific by design. City expansion is a future decision, not a launch consideration.

**Target Users:** Portland residents who eat out regularly, follow local food media, and actively collect restaurant recommendations from friends, Instagram, and publications like Eater PDX. They are not tourists seeking discovery, critics writing reviews, or anyone who wants input from strangers.

**Problem Statement:** Portland food lovers receive more restaurant recommendations than any existing tool can manage well. Spreadsheets aren't filterable on a sidewalk. Notes apps have no structure. Google Maps lists lack trusted social context. When it's time to decide where to eat, these tools fail — the data is there but the decision support isn't.

### What Makes This Special

**Core Insight:** Yelp solves discovery for strangers. PDX Deliciousness Finder solves decisions for people who already have taste and a trusted circle. *Yelp is a mall food court. PDX Deliciousness Finder is a dinner party recommendation.*

**Zero-Friction Add:** The primary entry point is an iOS share extension. Share any restaurant URL (their website, a Google Maps page, a Yelp listing) and a confirmation card appears pre-filled with name, address, website, cuisine, venue type, and price — populated via schema.org scraping (free tier) with a Places API fallback. Manual add and search-to-add serve as graceful fallbacks. All paths land on the same confirmation card.

**Opinionated Simplicity:** Every restaurant exists in one of three states: Want to Go, Been There (with visit log and per-visit notes), or Favorite (a sub-state of Been There). Disliked places are deleted — no "meh" state. This is a curation tool, not a filing cabinet.

**Trusted Social Layer:** Friends connect via invite (not a public follow model). Connections have two independent levels: connected (viewable in a Friends tab) and synced (their new additions flow into your master list, tagged with their name). Sync is opt-in per friend and revocable without disconnecting. The social layer enriches your personal list without turning the app into a social network.

**Portland-Native Map:** The primary home view is a MapKit map of Portland with pins color-coded by status (Want to Go / Been There / Favorite) and venue-type icons (restaurant, bar, brewery, food cart). List view with filters (status, venue type, neighborhood, cuisine, price) serves as the secondary view.

## Project Classification

| Attribute | Value |
|---|---|
| **Project Type** | Native iOS mobile application (SwiftUI + MapKit) |
| **Domain** | General — consumer lifestyle, food & dining |
| **Complexity** | Medium — social sync architecture, share extension, multi-source data enrichment |
| **Project Context** | Greenfield |
| **Platform** | iOS-only at launch; Apple Sign In for auth; multi-device via shared database |
| **Scope** | Portland-first; city expansion is a post-launch decision |

## Success Criteria

### User Success

- A restaurant can be added via share extension in under 5 seconds on the happy path (URL with schema.org data)
- The confirmation card correctly pre-fills name, address, venue type, and cuisine for 80%+ of shared URLs from restaurant websites, Google Maps, and Yelp
- A user can answer "where should I eat tonight?" using only the app — filtering their list by status, neighborhood, and cuisine without leaving the app
- The map view renders all personal pins on a Portland-area map in under 2 seconds
- The "aha moment" is achieved: a user opens the map and sees their personal food geography of Portland lit up with Want to Go, Been There, and Favorite pins
- A user who shares their list with a friend receives a useful, unsolicited recommendation via the sync layer within the first week of connecting

### Business Success

- **Phase 1 — Personal (Months 1–2):** Damonbrennen is using PDX Deliciousness Finder as his primary restaurant tracker, has stopped using his Google Sheet, and has at least 25 restaurants in the app
- **Phase 2 — Small Circle (Months 3–6):** 5–10 active Portland users, at least 3 mutual friend connections with active sync, and at least one "I went there because of your list" moment
- **Phase 3 — Portland Product (TBD):** Sufficient Phase 2 signal to decide whether to pursue wider Portland distribution; no specific targets defined until Phase 2 is validated

### Technical Success

- iOS share extension functions correctly from Safari, Chrome, Google Maps, Yelp, and restaurant websites
- Apple Sign In + database backend supports seamless multi-device use (install on new device, data fully restored)
- Friend list sync delivers a new restaurant addition to a synced friend's map within 60 seconds
- App is installable via TestFlight for Phase 1–2; App Store submission is a Phase 3 decision
- App handles offline gracefully: existing list and map readable without a connection; adds queued and synced when back online

### Measurable Outcomes

| Outcome | Target | Phase |
|---|---|---|
| Restaurants in app | 25+ | Phase 1 |
| Active users | 5–10 | Phase 2 |
| Friend connections with sync active | 3+ | Phase 2 |
| Share extension success rate | 80%+ | Launch |
| Map load time | <2 seconds | Launch |
| Add via share extension | <5 seconds | Launch |

## User Journeys

### Journey 1: The Solo Curator — Happy Path
**Persona: Damon** — Portland food enthusiast, eats out 3–4x/week, currently managing a deteriorating Google Sheet of restaurant recs

It's Saturday night at a friend's dinner party. Someone mentions Tasty n Daughters on SE Division. Damon has heard of it but never been. He pulls out his iPhone, finds it on Google Maps, taps the share button. PDX Deliciousness Finder appears in the share sheet. He taps it. A confirmation card slides up: "Tasty n Daughters — 3808 N Williams Ave — American brunch — $$." Status defaults to "Want to Go." He taps Save. Ten seconds, one hand, mid-conversation.

Three weeks later, standing on a sidewalk in SE with two friends who can't decide where to eat. Damon opens the app. Map view — SE Portland lit up with his pins. He filters: Want to Go, SE, under $$$. Tasty n Daughters is sitting right there. They walk over. Afterward, he opens the restaurant card, taps "Mark as Visited," logs today's date, and types a visit note: *"Got the hash brown bowl. Incredible. The spicy option."* He stars it as a Favorite.

**Capabilities revealed:** Share extension → confirmation card, status toggle, map view with filters, restaurant card, mark visited flow, visit log, per-visit notes, Favorite designation.

---

### Journey 2: The Social Discovery — Sync in Action
**Persona: Mia** — Damon's friend, equally food-obsessed, connected and synced on the app

Mia accepted Damon's invite last month and toggled sync on for his list. Tuesday morning she opens the app with no particular goal — just browsing. Three new pins have appeared overnight, each with a small friend badge. One is a food cart on N Mississippi she's never heard of. She taps the pin: "Güero — N Mississippi Ave — Mexican — $." Damon's note reads: *"Found from Eater PDX — Korean-Mexican fusion tacos, cash only, closes at 3pm."* She taps "Add to My List" and it moves from the friend layer into her personal Want to Go queue with a "Damon recommended" tag.

Two weeks later she goes. She marks it visited, adds her own note, and stars it as a Favorite. Damon now sees a friend badge on the Güero pin in his own map: "Mia loves this."

**Capabilities revealed:** Friend sync layer, friend badge on map pins, add-from-friend-list flow, per-restaurant attribution tag, cross-friend Favorite visibility.

---

### Journey 3: The Incoming Friend — First-Time User
**Persona: Jamie** — receives a TestFlight invite from Damon, has never heard of the app

Jamie gets a text: *"Hey, I'm using this app to track Portland restaurants — want to join so we can share lists?"* She taps the TestFlight link, installs, opens the app. Apple Sign In — one tap, done. The app shows her an empty map and a single prompt: *"Add your first restaurant."* She tries the manual form, adds Nong's Khao Man Gai from memory (name + address). Then she discovers the share extension while browsing Eater PDX — shares a restaurant URL, sees the confirmation card auto-fill everything, and is immediately converted. Within 30 minutes she has 8 restaurants in her list.

She accepts Damon's friend request, browses his Favorites tab, and recognizes 6 places she's already been to. She starts syncing his list. Her map immediately fills with his Want to Go pins.

**Capabilities revealed:** Onboarding flow, Apple Sign In, empty state prompt, manual add form, share extension discovery, friend invite acceptance, Friends tab browse, sync toggle.

---

### Journey 4: The Friday Night Decision — Core Value Moment
**Persona: Damon + three friends** — standing outside in NW Portland at 7pm, nobody can agree

This is the 30-second moment the entire app exists for. Damon opens PDX Deliciousness Finder. Map view. He taps the filter bar: Want to Go + NW Portland + under $$$. Four pins remain. He turns his phone around. The group picks one. They walk there.

The app didn't suggest a restaurant from an algorithm. It surfaced *his own intention* — a place he'd already decided he wanted to try — at exactly the right moment.

**Capabilities revealed:** Filter stack (status + neighborhood + price), map as decision interface, mobile-first performance (under 2 seconds), real-time filter response.

---

### Journey 5: Data Management — Stale or Wrong Info
**Persona: Damon as app owner** — a restaurant in his list has closed or moved

Damon opens his map and notices Luce has a "Want to Go" pin. He remembers reading it closed. He taps the pin, opens the card, and edits the address field. In a future version, the data freshness engine (Post-MVP) would have already flagged this with a "May have closed" warning. For MVP, manual edit of any field on the restaurant card is sufficient. Deletion is also one tap if the place is gone for good.

**Capabilities revealed:** Restaurant card edit mode, field-level editing, delete flow. (Data freshness engine is post-MVP.)

---

### Journey Requirements Summary

| Capability Area | Driven By |
|---|---|
| Share extension + confirmation card | Journeys 1, 3 |
| Map view with status/type pins | Journeys 1, 2, 4 |
| Filter stack (status, neighborhood, price, cuisine) | Journeys 1, 4 |
| Restaurant card (view, edit, visit log, notes) | Journeys 1, 5 |
| Friend invite, connect, sync toggle | Journeys 2, 3 |
| Friend badge on map pins | Journey 2 |
| Friends tab (browse a friend's list) | Journeys 2, 3 |
| Onboarding + empty state | Journey 3 |
| Apple Sign In | Journey 3 |
| Manual add form | Journey 3 |
| Delete / edit restaurant | Journey 5 |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Two-Tier Social Model: Connection vs. Sync as Independent States**
Most social apps treat "following" someone as implicitly receiving their content. PDX Deliciousness Finder separates these into two distinct states: *connected* (you can browse their list on demand) and *synced* (their additions flow into your master list automatically). Users can maintain relationships without noise, and can opt out of sync without the social awkwardness of unfriending. This is a novel pattern in consumer lifestyle apps.

**URL-as-Entry-Point with Two-Pass Enrichment**
Rather than asking users to search for a restaurant by name (the pattern used by Yelp, Google Maps, and most food apps), PDX Deliciousness Finder treats the restaurant's URL as the primary add gesture. The two-pass enrichment strategy — schema.org scrape (free, no API cost) first, Places API fallback only on failure — is a novel approach to data ingestion that keeps marginal cost near zero for the common case while maintaining data quality.

**Sync Conflict Resolution: Non-Destructive Merge**
When a synced friend's restaurant matches one already in your list (detected by address or Place ID), the sync is non-destructive — your existing metadata is preserved and a friend attribution badge is added. When a synced restaurant is new to your list, it arrives with the friend's metadata as an editable starting point. The underlying rule: sync can only *add* to your list, never *overwrite* it. This eliminates an entire class of data conflict without requiring a merge UI.

### Market Context & Competitive Landscape

Existing competitors (Beli, Google Maps saved lists, personal spreadsheets) all treat social and discovery as the same problem. PDX Deliciousness Finder is positioned in a gap: personal curation tools are unsocial, and social tools (Yelp, Google Maps) are public and impersonal. The two-tier social model is the specific mechanism that fills this gap without the app becoming a social network.

### Validation Approach

- **Two-tier social model:** Validated by Phase 2 usage — if connected users actively toggle sync on/off rather than connecting and forgetting, the distinction is working. If no one uses the "connected but not synced" state, the two states can collapse into one.
- **Two-pass enrichment:** Validated by tracking share extension success rate. Target: 80%+ of shares resolve without a Places API call. Log API fallback rate from day one to measure this.
- **Non-destructive sync:** Validated by absence of user complaints about overwritten data. If users report their metadata being changed unexpectedly, the conflict detection logic needs review.

### Risk Mitigation

- **Schema.org coverage gaps:** Some restaurant websites won't have schema.org markup. Mitigation: the confirmation card's editable fields make partial enrichment a slower success, not a failure.
- **Social sync noise:** If synced friends add too many places, master list gets cluttered. Mitigation: unsync is one tap; the design makes this a trivial fix, not a social problem.
- **Duplicate detection false positives:** Address matching could incorrectly merge two different restaurants at the same address (e.g., a food cart pod). Mitigation: name similarity check alongside address match; if names differ significantly, treat as separate restaurants and flag for user review.

## Mobile App Specific Requirements

### Project-Type Overview

Native iOS application built with SwiftUI and MapKit. iPhone-only at launch — no iPad optimization planned for MVP. Distributed via TestFlight for Phases 1–2; App Store submission is a Phase 3 decision. The share extension is a first-class feature, not a nice-to-have, and shapes the app's architecture from the start.

### Platform Requirements

| Requirement | Decision |
|---|---|
| Platform | iOS only at launch |
| Minimum iOS version | iOS 16+ (full SwiftUI support, share extensions, modern MapKit) |
| Device targets | iPhone; no iPad layout required for MVP |
| Framework | SwiftUI + MapKit |
| Architecture | Share extension as a separate app target; main app + extension share a data layer |
| Distribution | TestFlight (Phase 1–2); App Store (Phase 3, TBD) |

### Device Permissions

| Permission | Required For | When Requested |
|---|---|---|
| Location (When In Use) | Map centering on user's current position; neighborhood detection for filter | First time map view opens |
| Notifications | Friend sync digest, invite notifications | After first friend connection is made |
| No camera permission required | Photo capture is post-MVP | — |

### Offline Mode

The app must remain functional without a network connection for the primary read use cases:
- **Map view:** Renders existing pins from local cache; MapKit tiles cached automatically
- **List view:** Reads from local data store
- **Restaurant card:** All saved data accessible offline
- **Add flow:** Queued locally and synced when connection resumes; share extension shows confirmation card but defers enrichment API call until online
- **Social sync:** Paused; delivers queued updates when back online

### Push Notification Strategy

- **Friend adds new places (synced):** Daily digest, active by default once a synced friend exists; user can opt out in settings
- **Friend invite received:** Immediate
- **Friend accepted your invite:** Immediate
- Notification preferences managed in app settings; iOS system notification settings respected

### App Store Compliance

- **Apple Sign In:** Already the only auth method — satisfies App Store guideline 4.8 with no additional work
- **Privacy manifest:** Required for iOS 17+ apps using certain APIs; must declare data collection practices before App Store submission
- **Share extension entitlements:** Requires App Groups entitlement to share data container between main app and extension — must be configured in Apple Developer portal
- **TestFlight beta limit:** 10,000 external testers maximum; sufficient for Phase 1–2

### Implementation Considerations

- **App Groups:** Main app and share extension must share a data container via App Groups entitlement. This is the primary architectural constraint of the share extension approach.
- **Background sync:** Friend list sync should use background app refresh (BGAppRefreshTask) so the map is up-to-date when the user opens the app, not just after they've been in the app for a while.
- **MapKit vs Google Maps SDK:** MapKit is the correct choice — no API key, no billing, native performance, and tighter iOS integration for location permissions.

## Product Scope & Phased Development

### MVP Strategy & Philosophy

**MVP Approach: Experience MVP**
The goal of Phase 1 is not to validate a market — it's to validate that PDX Deliciousness Finder genuinely replaces Damonbrennen's existing workflow (Google Sheet + Notes + Google Maps lists). If he isn't using it as his primary restaurant tracker after 4 weeks of solo use, it isn't ready for friends. This is the concept doc's own "dogfood it solo" principle baked into the strategy.

**MVP Philosophy:** Ship the smallest thing that changes one person's actual behavior. Then expand.

**Resource Model:** AI-assisted development with Damonbrennen as PM and product owner. Architecture must be kept simple enough for AI-generated SwiftUI code to be reliable and maintainable. This argues for clean separation of concerns (share extension, main app, data layer) and minimal custom abstractions.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:** Journeys 1 (solo curator), 3 (incoming friend), 4 (Friday night decision), 5 (data management)

**Must-Have Capabilities:**
1. Data model — restaurant entity, status, visit log, two-tier notes
2. Share extension → confirmation card (schema.org + Places API fallback)
3. Manual add form + search-to-add fallback
4. Map view — MapKit, color + icon pins, tap to open card
5. List view — filterable by status, venue type, neighborhood, cuisine, price
6. Restaurant card — view, edit, mark visited, add notes, delete
7. Apple Sign In + multi-device database sync
8. Social layer v1 — invite, connect/sync states, Friends tab, friend badge, daily digest notification

**Not in MVP (no matter how tempting):**
- AI chat interface
- "Surprise Me" randomizer
- Data freshness engine
- Event lists
- Import from Google Sheets
- GPS dwell prompts

### Post-MVP Features

**Phase 2 — Growth (after Phase 1 validated with small circle):**
- "Surprise Me" randomizer
- Data freshness engine (flag closures, hour changes)
- Event lists — temporary shared lists for specific occasions
- Import from Google Sheets
- GPS dwell → visit prompt

**Phase 3 — Expansion (after Phase 2 signal on Portland product potential):**
- AI chat interface ("casual dinner, east side, under $$")
- Multi-city expansion
- Public follow model for Portland food influencers
- Instagram share parsing
- Web companion
- App Store submission

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Share extension parsing reliability below 80% | Medium | schema.org scrape covers most cases; confirmation card editable fields make partial parse a slower success, not failure |
| Duplicate detection false positives | Low-Medium | Address + name similarity check; ambiguous cases flagged for user review rather than auto-merged |
| Social sync data conflicts | Low | Non-destructive merge: sync only adds, never overwrites user's own metadata |
| App Groups entitlement setup complexity | Low | Well-documented Apple pattern; one-time configuration |

**Market Risks:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Doesn't actually replace existing workflow | Medium | 4-week solo dogfood before inviting anyone; if behavior doesn't change, fix before expanding |
| Friend circle doesn't adopt | Medium | Low-friction TestFlight invite; value is visible immediately (browse friend's Favorites on day one) |
| Portland scope too limiting for growth | Low | Intentional constraint; architecture supports multi-city from day one |

**Resource Risks:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| AI-generated code quality issues | Medium | Keep architecture simple; test on real device throughout development; quick win sequence validates foundation early |
| Scope creep delaying Phase 1 | High | Hard "not in MVP" list above; ship the data model first, validate it works |

## Functional Requirements

### Restaurant Management

- **FR1:** Users can add a restaurant to their personal list
- **FR2:** Users can view a restaurant card showing all saved details for a restaurant
- **FR3:** Users can edit any field on a restaurant card after saving
- **FR4:** Users can delete a restaurant from their list
- **FR5:** Users can assign a venue type to a restaurant (restaurant, bar, brewery, food cart)
- **FR6:** Users can assign a cuisine type to a restaurant
- **FR7:** Users can assign a price range to a restaurant

### Data Enrichment & Ingestion

- **FR8:** Users can add a restaurant by sharing any URL from any iOS app via the system share sheet
- **FR9:** The system extracts restaurant name, address, website, cuisine, venue type, and price from a shared URL using schema.org structured data
- **FR10:** The system falls back to a Places API lookup when schema.org data is unavailable or incomplete
- **FR11:** Users can review and edit all pre-filled fields before saving (confirmation card)
- **FR12:** Users can add a restaurant manually by entering name and address
- **FR13:** Users can find and add a restaurant by searching for it by name within the app
- **FR14:** Users can save a restaurant with only name and address when other data is unavailable

### Status & Visit Tracking

- **FR15:** Users can set a restaurant's status to "Want to Go" (default) or "Been There"
- **FR16:** Users can mark a Been There restaurant as a Favorite
- **FR17:** Users can log multiple visits to a restaurant, each with a date
- **FR18:** Users can add a general note to a restaurant that persists across all visits
- **FR19:** Users can add a per-visit note to any visit log entry
- **FR20:** Users can view the complete visit history for a restaurant

### Map & List Discovery

- **FR21:** Users can view all their saved restaurants on a Portland map
- **FR22:** The map displays pins color-coded by restaurant status (Want to Go, Been There, Favorite)
- **FR23:** The map displays a venue-type icon on each pin (restaurant, bar, brewery, food cart)
- **FR24:** Users can tap a map pin to open that restaurant's card
- **FR25:** Users can filter the map by status, venue type, neighborhood, cuisine, and price range
- **FR26:** Users can view their restaurants in a list view
- **FR27:** Users can filter the list by status, venue type, neighborhood, cuisine, and price range
- **FR28:** The system detects the Portland neighborhood of a restaurant from its address

### Social & Friends

- **FR29:** Users can invite another person to connect as a friend via phone number or email
- **FR30:** Users can accept or decline a friend invitation
- **FR31:** Users can browse a connected friend's restaurant list in a dedicated Friends tab
- **FR32:** Users can view a connected friend's restaurants on a map view within the Friends tab, regardless of whether sync is enabled
- **FR33:** Users can enable sync for a connected friend so that friend's new additions appear on the user's map
- **FR34:** Users can disable sync for a connected friend without disconnecting from them
- **FR35:** When a synced friend adds a restaurant the user does not have, it appears on the user's map with a friend attribution badge
- **FR36:** When a synced friend adds a restaurant the user already has, a friend attribution badge is added without modifying the user's existing metadata
- **FR37:** The system detects duplicate restaurants using address and name similarity matching
- **FR38:** Users can add a friend's restaurant from the Friends tab into their own personal list
- **FR39:** Users receive a daily digest notification summarizing new restaurants added by synced friends
- **FR40:** Users can opt out of the daily digest notification
- **FR41:** Users receive an immediate notification when a friend invitation is received or accepted

### User Account & Settings

- **FR42:** Users can create an account using Apple Sign In
- **FR43:** Users can access their complete data on any iOS device using the same Apple ID
- **FR44:** The system syncs user data across devices in real time via a cloud database
- **FR45:** Users can manage notification preferences within the app
- **FR46:** Users can view and manage all friend connections, including connected and synced states
- **FR47:** Users can disconnect from a friend

## Non-Functional Requirements

### Performance

- Map view renders all existing pins on a Portland-area map in under 2 seconds on a mid-range iPhone
- Share extension presents a pre-filled confirmation card within 3 seconds of activation for a typical restaurant URL
- List view filter results update in real time (under 500ms) as filters are applied or changed
- App cold start to usable map view in under 3 seconds
- Friend sync delivers new additions to a synced user's map within 60 seconds of the friend saving a restaurant

### Security

- All data transmitted between device and backend is encrypted in transit (TLS 1.2+)
- All user data stored in the backend database is encrypted at rest
- Authentication is handled exclusively via Apple Sign In; no passwords are stored or managed by the app
- User restaurant lists and notes are private by default; accessible only to the account owner and explicitly connected friends
- Friend connections require mutual acceptance before any data is shared; no user can access another's list without permission

### Scalability

- Backend architecture supports scaling to 10,000 active users without requiring architectural changes (Phase 3 Portland product target)
- Data model is designed to support multi-city expansion without schema migrations to existing user records

### Accessibility

- App supports iOS Dynamic Type for all text elements
- Map pin status is conveyed through both color and icon (not color alone) so the app is usable by colorblind users
- All interactive tap targets meet Apple HIG minimum size of 44×44pt

### Design Philosophy

- The app must feel like a personal journal, not a public directory. No public profiles, follower counts, review prompts, or social performance signals anywhere in the product. Every interaction is private by default and audience-of-one by design.

### Integration & Reliability

- schema.org scraping handles failed or malformed responses gracefully — falls back to Places API rather than crashing or returning an error to the user
- Places API fallback handles rate limits and errors gracefully — presents a partially-filled confirmation card rather than a failure state
- Apple Push Notification Service (APNs) delivers immediate notifications (invites, accepted connections) within 30 seconds
- Cloud database sync handles network interruptions without data loss — queues writes locally and retries when connectivity is restored
- Offline read access to the full restaurant list and map is maintained regardless of network state
