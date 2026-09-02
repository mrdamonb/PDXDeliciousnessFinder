# PDX Deliciousness Finder — Sprint Plan

**Generated:** 2026-04-09  
**Last updated:** 2026-04-14 (device + Supabase verification noted)  
**Module:** BMad Method  
**Phase:** 4 — Implementation (Sprint 1 — **device-validated**; optional hardening before Sprint 2)

---

## Project Status Snapshot

### Planning Artifacts (Complete ✅)

| Artifact | Status |
|---|---|
| PRD | ✅ Complete |
| Architecture | ✅ Complete |
| UX Design Specification | ✅ Complete |
| Epics & Stories | ✅ Complete |

### Sprint 1 — Implementation (Complete ✅)

| Milestone | Status |
|---|---|
| Sprint 1 backlog (Stories 1.1–2.6) | ✅ Implemented in repo |
| Acceptance & regression testing | ✅ **Primary path** verified on **physical device** (2026-04-14): sign-in, add restaurants, rows in Supabase `restaurants`; clean reinstall via Xcode OK. Full `epics.md` sweep + offline (NFR20) still optional before Sprint 2. |

### Primary code map (Sprint 1)

| Area | Key paths |
|---|---|
| App shell | `App/AppState.swift`, `App/PDXDeliciousnessFinder.swift` |
| Auth | `Features/Onboarding/OnboardingView.swift` — email/password sign-up & sign-in (incl. email-confirmation flow) |
| Network | `Core/Network/SupabaseClient.swift`, `SupabaseTables.swift`, `DTOs/` |
| Local store | `Core/Storage/Models/`, `PersistenceController.swift`, `Repositories/` |
| Sync | `Core/Sync/SyncQueue.swift`, `NetworkMonitor.swift`, `RealtimeSubscriptions.swift`, `SyncOperation.swift` |
| UI state | `Core/ViewState.swift` |
| Restaurant loop | `Features/Home/HomeView.swift`, `RestaurantList/`, `RestaurantDetail/` (add, edit, detail, visits, delete), `UI/Components/StatusBadgeView.swift` |

**Assessment:** Sprint 1 delivered the “replace my Google Sheet” loop: auth, SwiftData + repositories, outbound/inbound sync hooks, manual CRUD, status, visits, delete. **Cloud write path** confirmed: same `SUPABASE_HOST` / anon key as dashboard; data appears in `restaurants` after real-device use (no reliance on simulator for that gate). **Remaining optional gates:** full `epics.md` matrix, airplane/offline (NFR20), `handle_new_user` trigger sanity on pdx-dev — do before Sprint 2 if you want a strict sign-off.

---

## Sprint 1: Foundation Complete + Food Journal

**Goal:** Ship the foundational data layer and the complete personal curation loop — a user can sign in, add restaurants manually, view their list, edit details, track status, log visits, and delete restaurants.

**Outcome:** ✅ Goal met in code; validation in progress through testing.

**Sprint Capacity:** Solo developer (Damonbrennen) with AI-assisted development.

---

## Story Sequence

Stories were executed in order using `[DS] Dev Story` in fresh context where possible.

---

### Sprint 1 Backlog

| # | Story | Epic | Priority | Status |
|---|---|---|---|---|
| 1 | **1.1: App Foundation & Email Sign-In** | 1 | P0 — Required | ✅ Complete |
| 2 | **1.2: SwiftData Core Storage Layer** | 1 | P0 — Required | ✅ Complete |
| 3 | **1.3: Offline Write Queue (Outbound Sync)** | 1 | P0 — Required | ✅ Complete |
| 4 | **1.4: Realtime Inbound Sync (Multi-Device)** | 1 | P0 — Required | ✅ Complete |
| 5 | **2.1: Add a Restaurant Manually** | 2 | P0 — Required | ✅ Complete |
| 6 | **2.2: View Your Restaurant List** | 2 | P0 — Required | ✅ Complete |
| 7 | **2.3: Edit a Restaurant's Details** | 2 | P0 — Required | ✅ Complete |
| 8 | **2.4: Set Restaurant Status** | 2 | P0 — Required | ✅ Complete |
| 9 | **2.5: Log Visits & Notes** | 2 | P0 — Required | ✅ Complete |
| 10 | **2.6: Delete a Restaurant** | 2 | P0 — Required | ✅ Complete |

---

## Story Details (Sprint 1 — delivered)

### Story 1 — 1.1: App Foundation & Email Sign-In

**Status:** ✅ Complete  

**Shipped:** `AppState` session lifecycle; `OnboardingView` email/password sign-up & sign-in; `SupabaseClient` + xcconfig wiring; post-auth `HomeView` entry.

**Verify during test pass:** `handle_new_user` (or equivalent) on pdx-dev inserts `public.users` on first auth; Debug/Release schemes load `Config.xcconfig` as expected.

---

### Story 2 — 1.2: SwiftData Core Storage Layer

**Status:** ✅ Complete  

**Shipped:** `Restaurant`, `VisitLog` models; `RestaurantRepository`, `VisitLogRepository`; `PersistenceController`; `SupabaseTables`; DTOs with `CodingKeys` (`RestaurantDTO`, `VisitLogDTO`).

---

### Story 3 — 1.3: Offline Write Queue (Outbound Sync)

**Status:** ✅ Complete  

**Shipped:** `SyncQueue`, `NetworkMonitor`, enqueue pattern on repository mutations, flush/retry path; `ViewState` for async UI.

---

### Story 4 — 1.4: Realtime Inbound Sync (Multi-Device)

**Status:** ✅ Complete  

**Shipped:** `RealtimeSubscriptions` for remote inserts/updates/deletes reconciled into SwiftData (foreground subscription path per architecture).

---

### Story 5 — 2.1: Add a Restaurant Manually

**Status:** ✅ Complete  

**Shipped:** `AddRestaurantView` / `AddRestaurantViewModel`; save via repository → sync queue; validation on required name.

---

### Story 6 — 2.2: View Your Restaurant List

**Status:** ✅ Complete  

**Shipped:** `RestaurantListView`, `RestaurantRowView`; navigation to detail; list driven from SwiftData.

---

### Story 7 — 2.3: Edit a Restaurant's Details

**Status:** ✅ Complete  

**Shipped:** `EditRestaurantView`; save/cancel behavior through repository.

---

### Story 8 — 2.4: Set Restaurant Status

**Status:** ✅ Complete  

**Shipped:** `StatusBadgeView`; “Mark as Visited” → `beenThere` + visit via `AddVisitView(markVisited:)`; favorite toggle between `beenThere` ↔ `favorite` in `RestaurantDetailView` / `RestaurantDetailViewModel`.

---

### Story 9 — 2.5: Log Visits & Notes

**Status:** ✅ Complete  

**Shipped:** `AddVisitView`; visit history on restaurant card; `VisitLog` persistence + sync.

---

### Story 10 — 2.6: Delete a Restaurant

**Status:** ✅ Complete  

**Shipped:** Delete affordance + confirmation on `RestaurantDetailView`; `RestaurantDetailViewModel.delete`; cascade/local delete + queued remote delete in `RestaurantRepository` / `SyncQueue`.

---

## Sprint 1 closure checklist

- [x] All Sprint 1 backlog stories implemented in `PDXDeliciousnessFinder/`
- [x] **Primary** test pass on **physical device** (2026-04-14): auth, add/list restaurants, Supabase `restaurants` populated; Xcode reinstall + sign-in still healthy. **Simulator not required** for this gate — each install has its own local store; phone is the reference environment for sync + RLS + Keychain.
- [ ] Full story-by-story acceptance sweep from `epics.md` — **working checklist:** `implementation-artifacts/sprint-1-acceptance-checklist.md` (tick boxes there; then check this line)
- [ ] Offline / airplane-mode spot checks per NFR20
- [ ] Optional: `[ER] Retrospective` (`bmad-retrospective`) after test sign-off

---

## Sprint 2 — In Progress

| Story | Status |
|---|---|
| 3.1 Portland Map with Pins | ✅ Complete (2026-04-15) |
| 3.2 Filter the Map | ✅ Complete (2026-04-15) |
| 3.3 List View with Filters | ✅ Complete (2026-04-15) |
| 3.4 Neighborhood Detection | ✅ Complete (2026-04-15) |
| 4.1 Share Extension & Schema.org Enrichment | ✅ Complete (2026-04-15) |
| 4.2 Places API Fallback via Edge Function | ✅ Complete (Google Places, commit `ca7df26`) |
| 4.3 Search-to-Add Within the App | ✅ Complete |
| 2.7 History Tab — Visit Journal | ✅ Complete (commit `67f73c6`) |

**Sprint 2 closed 2026-09-01.** Epic 4 is done. Both 4.2/4.3 and 2.7 had shipped and were in daily use, but were never committed — 2.7's source files were untracked entirely. Recorded and committed 2026-09-01.

---

## Sprint 3 — Logging & Findability

**Theme:** make logging where you have been fast enough that it actually happens, and make your own list reachable by typing.

Ordered by dependency, not by the order the ideas arrived.

| # | Story | Surface | Status | Notes |
|---|---|---|---|---|
| 1 | **2.9 Menu at the Point of Logging** | iOS + web | ✅ Done (device-verified 2026-09-02) | Independent of everything else. Gated only on the `menu_url` column. Ship first for a same-day win. |
| 2 | **3.5 Search Your Restaurants** | iOS | ✅ Done (device-verified 2026-09-02) | **The spine.** 2.8 and the whole web parity spec reuse it. |
| 3 | **1.5 Visit history survives a reinstall** | iOS | 🔲 Ready for dev | Found in the 3.5 review. Do before 2.8 — History is not trustworthy until this lands. |
| 4 | **2.8 Add a Visit from History** | iOS | 🔲 Backlog | Blocked on 3.5 (the picker *is* the search) and now on 1.5. |
| 5 | **S6 Web Parity** | web | 🔲 Spec in `spec-wip.md` | History view, search, menu button, add-visit-from-history. Follows the iOS work so the shape is settled once. |

### Schema change — one manual step, gates story 2.9

There is **no local migrations directory**; schema lives in the remote Supabase project. Before 2.9 starts:

```sql
alter table restaurants add column menu_url text;
```

Then the Swift side needs it in **four** places, all located 2026-09-01:
`Core/Storage/Models/Restaurant.swift`, `Core/Network/DTOs/RestaurantDTO.swift` (with explicit `CodingKeys` per ARCH-11), `Core/Storage/Repositories/RestaurantRepository.swift:111`, and `Core/Sync/RealtimeSubscriptions.swift:205`. Missing the last two is the likely bug: the column would save but never come back down on sync.

### Added to Sprint 3 during the 3.5 review

**Story 1.5 — Visit History Survives a Reinstall and Reaches a Second Device.** Two compounding sync defects found 2026-09-01. `VisitLogRepository.pullFromRemote` is never called by anything, so visits are never restored after a reinstall or on a second device; and `VisitLogDTO.toModel()` never hydrates the `restaurant` relationship, so any visit that *does* arrive (the live realtime path) is dropped by History's row builder. Neither fix is visible without the other. **Scheduled ahead of 2.8**, which adds another way to write into a History that cannot currently be trusted. Reopens Epic 1.

### Logged but not scheduled

**Story 4.4 — Stop Generic Place Types Becoming Cuisines.** Defect found reviewing `ca7df26` on 2026-09-01: `extractCuisine` stores a bare generic display name ("Restaurant", "Bar", "Coffee Shop") verbatim as the cuisine, because the strip regex requires leading whitespace. Those values then appear as options in the cuisine filter on both surfaces. Small fix, deliberately **not** pulled into Sprint 3. Reopens Epic 4.

### Known divergence to resolve in Sprint 3

**Logging a visit auto-promotes status on web but not on iOS.** `actions.ts logVisit` flips `want_to_go` → `been_there` unconditionally; iOS `AddVisitView` only does it when `markVisited: true` is passed. Story 2.8 adopts the web behavior. Worth deciding whether existing iOS Add Visit should match — it is a one-line change and the current split is almost certainly unintentional.

### Open question carried into the sprint

**How many restaurants actually have `website` populated?** Story 2.9's payoff scales directly with this, and rows added by hand or before the Places migration may be null. Unverified as of 2026-09-01 — needs a look at the data, not an assumption.

---

## Architecture Constraints Reminder

All implementation agents must follow these non-negotiable patterns from `architecture.md`:

| Constraint | Rule |
|---|---|
| **ARCH-8** | All async UI state uses `ViewState<T>` enum — no raw `isLoading` booleans on ViewModels |
| **ARCH-9** | All Supabase mutations route through `SyncQueue` — no direct `supabase.from()` in ViewModels |
| **ARCH-10** | `SupabaseTables` enum for all table references — no raw string literals |
| **ARCH-11** | `CodingKeys` on all Supabase DTOs for snake_case ↔ camelCase |
| **ARCH-12** | Feature-first directory structure: `Core/` must not import `Features/` |
| **ARCH-13** | Repositories pattern: `RestaurantRepository`, `VisitLogRepository` as data access layer |

---

## Definition of Done (Per Story)

- [ ] All acceptance criteria in `epics.md` pass on device or simulator
- [ ] Code follows architecture constraints (ARCH-8 through ARCH-15)
- [ ] No raw `supabase.from()` calls in ViewModel or Feature code
- [ ] Offline behavior verified (airplane mode test)
- [ ] Story marked complete in this sprint plan
