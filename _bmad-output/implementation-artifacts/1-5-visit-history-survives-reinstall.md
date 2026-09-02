---
baseline_commit: f885314ade334a83f19b4e64191a1f8b4127e2d7
---

# Story 1.5: Visit History Survives a Reinstall and Reaches a Second Device

**Epic:** 1 — Signed In & Ready
**Status:** 🟡 Review — implemented 2026-09-02, pending device verification (see Dev Agent Record)
**Effort:** Medium — sync layer only, no UI work
**Found:** 2026-09-01, reviewing story 3.5
**Priority:** **Before story 2.8.** That story adds another way to put visits into History; History has to be trustworthy first.

---

## User Story

As a Portland food enthusiast,
I want the visits I have logged to be there when I reinstall the app or sign in on another device,
So that my food journal is a record I can trust rather than whatever happens to be on this phone.

---

## The Two Defects

They compound, and **fixing either alone produces no visible improvement.**

### 1. Visits are never pulled from the server

`VisitLogRepository.pullFromRemote(restaurantId:)` is implemented (`Core/Storage/Repositories/VisitLogRepository.swift:67`) and declared on `VisitLogRepositoryProtocol` — and **nothing calls it.** Verified by grep across every `.swift` file: the only hits are the definition, the protocol declaration, and `AppState.swift:124`, which calls the *restaurant* repository's version.

`AppState.reconcileOnForeground()` pulls restaurants and stops there. So after a delete-and-reinstall, restaurants come back and **the visit journal is empty** — the rows are sitting in Supabase untouched.

The existing signature is also the wrong shape for this job. It takes a `restaurantId`, so a full restore would mean N calls for N restaurants. A `pullFromRemote(userId:)` matching `RestaurantRepository`'s shape is the right addition; keep or drop the per-restaurant variant depending on whether anything ends up needing it.

### 2. The `restaurant` relationship is never hydrated on inbound sync

`VisitLogDTO.toModel()` (`Core/Network/DTOs/VisitLogDTO.swift:66`) sets every scalar and leaves `restaurant` nil. `Restaurant.swift:75` declares `@Relationship(deleteRule: .cascade, inverse: \VisitLog.restaurant)`, so the link only exists when something assigns it — and the only place that does is `AddVisitView.swift:66`.

`HistoryView` renders a row only `if let restaurant = log.restaurant`, so an unhydrated visit is silently dropped. This is live today on the realtime path: `RealtimeSubscriptions.handleVisitLogInsert` (`:176`) inserts `dto.toModel()` directly, so a visit logged on another device arrives and is invisible.

Story 3.5 patched `HistoryViewModel.grouped` to filter unrenderable logs before sectioning, which stops the bare month header. **That was a symptom fix and it is not this.** It makes the rows disappear cleanly instead of leaving an empty heading.

---

## Acceptance Criteria

**Given** I have logged visits and I delete and reinstall the app
**When** I sign in and open History
**Then** every visit is there, grouped under the correct months

---

**Given** I log a visit on one device
**When** I open History on a second signed-in device
**Then** that visit appears with its restaurant name, neighborhood and note

---

**Given** a visit arrives through the realtime subscription while the app is open
**When** History is showing
**Then** the row renders fully rather than being silently dropped

---

**Given** a visit whose restaurant has not yet synced to this device
**When** the visit is inserted locally
**Then** nothing crashes, and the visit becomes visible once its restaurant arrives

---

**Given** the foreground pull runs repeatedly
**When** it completes
**Then** no visit is duplicated — the existing `if (try fetch(id:)) == nil` guard is preserved

---

## Technical Notes

### Ordering matters

Restaurants must be in the local store before visits are hydrated, or every lookup returns nil and you are back where you started. `reconcileOnForeground` should pull restaurants, then visits — `await` in sequence, not concurrently.

### Where to hydrate

`toModel()` is a pure DTO transform with no `modelContext`, so it cannot look a restaurant up. Two workable shapes; pick one and apply it in **both** inbound paths:

1. **Hydrate at the insertion site.** After `modelContext.insert(dto.toModel())`, fetch the `Restaurant` by `dto.restaurantId` and assign it. Needs the same handful of lines in `VisitLogRepository.pullFromRemote` and `RealtimeSubscriptions.handleVisitLogInsert`.
2. **Give `toModel` the context.** `func toModel(in context: ModelContext) -> VisitLog`, resolving the relationship internally. One implementation, but it changes a signature that `RestaurantDTO` may mirror — check for consistency before diverging.

Shape 1 is the smaller change; shape 2 is harder to forget at a third call site later. Either is fine, but **both inbound paths must be covered** — fixing only the pull leaves the realtime path broken, and that is the path that already works today.

### The dangling case is real

A visit can arrive before its restaurant does — realtime insert ordering is not guaranteed, and the two subscriptions are independent channels (`RealtimeSubscriptions.swift:49`). Assigning nil is acceptable as long as the next foreground pull repairs it. Consider a re-hydration pass over unlinked visits after the restaurant pull completes, rather than assuming the orders line up.

### Do not undo the 3.5 patch

`HistoryViewModel.grouped` filters `logs.filter { $0.restaurant != nil }` before sectioning. Once this story lands that filter should rarely exclude anything, but it stays as the guard against a bare month header if a dangling visit ever exists.

### Architecture constraints

| Constraint | Requirement |
|---|---|
| ARCH-9 | Mutations route through the repository and `SyncQueue`; this is an inbound read path, so no queue involvement, but do not open a direct `supabase.from()` outside the repository |
| ARCH-10 | `SupabaseTables.visitLogs`, no string literals |
| ARCH-13 | The pull belongs on `VisitLogRepository`, not in `AppState` or a ViewModel |

---

## Files to Modify

| File | Change |
|---|---|
| `Core/Storage/Repositories/VisitLogRepository.swift` | Add `pullFromRemote(userId:)`; hydrate the relationship on insert |
| `Core/Storage/Repositories/RepositoryProtocols.swift` | Declare the new method |
| `App/AppState.swift` | Call it from `reconcileOnForeground()`, after the restaurant pull |
| `Core/Sync/RealtimeSubscriptions.swift` | Hydrate the relationship in `handleVisitLogInsert` |
| `Core/Network/DTOs/VisitLogDTO.swift` | Only if shape 2 is chosen |

---

## Out of Scope

- Any UI change. History renders correctly once the data is right
- Reworking the sync architecture more broadly
- Backfilling or repairing rows already in Supabase — they are intact; only the local store is short
- The dead `RestaurantDetailViewModel.markVisited` / `.addVisit` methods (separate cleanup in `deferred-work.md`)

---

## Verification

Both of these need two real environments, and neither can be settled by reading code:

- **Reinstall:** log a visit, delete the app, reinstall, sign in, open History — the visit is there
- **Second device:** log a visit on device A, open History on device B — it appears with its restaurant details
- Foreground the app repeatedly and confirm visits are not duplicated
- Confirm the History empty state still appears for an account that genuinely has no visits

---

## Correction, 2026-09-02 — a third defect, and one claim above is wrong

Found during the story 2.9 code review, and it **changes the shape of this story**.

### The claim that is wrong

Defect 2 above says the missing relationship "is live today on the realtime path: `RealtimeSubscriptions.handleVisitLogInsert` inserts `dto.toModel()` directly, so a visit logged on another device arrives and is invisible."

**Visits do not arrive on the realtime path at all.** Nothing arrives on it.

### Defect 3 — the realtime decoder cannot decode either DTO

`RealtimeSubscriptions.realtimeDecoder` (`Core/Sync/RealtimeSubscriptions.swift:224`) sets `keyDecodingStrategy = .convertFromSnakeCase`. Both `RestaurantDTO` and `VisitLogDTO` declare **explicit** snake_case `CodingKeys`. The strategy rewrites the incoming JSON key `user_id` to `userId`, which then matches no `CodingKey` whose `stringValue` is `"user_id"`, so decoding throws on the first required key.

**Reproduced directly**, not inferred: a `JSONDecoder` with `.convertFromSnakeCase` against a struct with explicit snake_case keys and a hand-written `init(from:)` fails with `DecodingError.keyNotFound: Key 'user_id' not found`. The identical payload decodes cleanly with no key strategy.

Every realtime event throws into an empty `catch { // Non-fatal }` — `:102` for restaurants, `:165` for visit logs. **Epic 1 story 1.4, "Realtime Inbound Sync (Multi-Device)", is marked `done` and does not work for either table.** Restaurants appear to sync only because `pullFromRemote` passes no custom decoder and picks them up on the next foreground pull, which is what has hidden this.

### What it means for this story

The three defects stack, and **the acceptance criteria above are unchanged** — the user-visible outcome is the same. But the work is larger than described:

1. Visits are never pulled — no call site for `pullFromRemote`
2. The `restaurant` relationship is never hydrated on inbound sync
3. **Realtime cannot decode, so the live path delivers nothing for either table**

Fixing 1 and 2 alone gives a working journal that updates on foreground only. That may be an acceptable first cut — decide deliberately rather than by accident.

### Fixing defect 3

Two candidate fixes, and **it must be one or the other, never both**:

- Drop `.convertFromSnakeCase` from `realtimeDecoder`. The explicit `CodingKeys` already do that job, and this leaves every DTO untouched.
- Delete the explicit snake_case cases from both DTOs and let the strategy convert. Larger, and it would break `pullFromRemote`, which relies on those explicit keys with the default decoder.

**The first is almost certainly right.** Whichever is chosen, make the empty `catch` log the error — a silent catch is what hid a dead sync path behind a story marked done.

### Verification this adds

- With the app open on device B, edit a restaurant on device A and confirm the change appears **without** foregrounding device B
- Same for a visit
- Confirm a decode failure now surfaces in the log rather than vanishing

---

## Tasks / Subtasks

- [x] Add `pullFromRemote(userId:)` to `VisitLogRepositoryProtocol`, dropping the unused `pullFromRemote(restaurantId:)` (AC 1, 2, 5)
- [x] Implement `VisitLogRepository.pullFromRemote(userId:)`: fetch by `user_id`, insert new rows with the existing dedupe guard, hydrate `restaurant` on insert (AC 1, 2, 5)
- [x] Add a re-hydration pass over dangling visits (`restaurant == nil`) at the end of the pull, to repair visits left unlinked by an earlier realtime insert (AC 4)
- [x] Call `visitLogRepository.pullFromRemote(userId:)` from `AppState.reconcileOnForeground()`, sequentially after the restaurant pull (AC 1, 2)
- [x] Hydrate `restaurant` in `RealtimeSubscriptions.handleVisitLogInsert` (AC 3, 4)
- [x] Fix the realtime decoder: drop `.convertFromSnakeCase` from `realtimeDecoder` so it stops fighting the DTOs' explicit `CodingKeys` (AC 3; defect 3)
- [x] Replace both empty `catch { // Non-fatal }` blocks in `RealtimeSubscriptions` with `OSLog` logging (defect 3)
- [x] Update the `HistoryViewModel.grouped` comment describing the orphan filter so it no longer says every inbound visit arrives unhydrated (now stale)
- [x] Update `deferred-work.md` entries for the two defects this story resolves

---

## Dev Agent Record

### Implementation Plan

Shape 1 (hydrate at the insertion site) was chosen over giving `toModel()` a `ModelContext` parameter — it's the smaller change and doesn't touch `RestaurantDTO`'s mirrored signature, per the story's own guidance.

The three defects were fixed together since they compound and none is independently verifiable:

1. `VisitLogRepository.pullFromRemote(userId:)` replaces the dead, wrong-shaped `pullFromRemote(restaurantId:)` (confirmed zero call sites before removal). It mirrors `RestaurantRepository.pullFromRemote(userId:)`'s shape, preserves the `fetch(id:) == nil` dedupe guard, and hydrates `restaurant` via a private `hydrateRestaurant(for:)` lookup after insert.
2. A private `rehydrateDanglingVisits()` runs at the end of every pull: it fetches every local `VisitLog` with `restaurant == nil` and retries the lookup. This is what repairs a visit that arrived (via realtime, or a pull that raced the restaurant's own pull) before its restaurant existed locally — the technical notes call this out explicitly as not safe to assume away.
3. `AppState.reconcileOnForeground()` now awaits the restaurant pull, then the visit pull, in sequence (not concurrently) — ordering matters because the hydration lookup needs the restaurant row to already be local.
4. `RealtimeSubscriptions.handleVisitLogInsert` hydrates the same way as the pull path, so both inbound paths are covered as the story requires.
5. `realtimeDecoder` no longer sets `.convertFromSnakeCase`. Both DTOs declare explicit snake_case `CodingKeys`, and the strategy was rewriting incoming keys (`user_id` → `userId`) before they could match those `CodingKeys`, so every realtime event decoded — and threw — silently. This is why story 1.4 shipped `done` while realtime decoded nothing for either table.
6. Both previously-empty `catch` blocks in `RealtimeSubscriptions` now log via the same `OSLog`/`Logger` pattern already used in `SyncQueue.swift` and `PlacesEnrichmentService.swift` (`subsystem: "com.damonbrennen.PDXDeliciousnessFinder"`), so a future decode regression surfaces instead of hiding behind a done story again.

### Debug Log

No CLI build exists for this Xcode project (per `CLAUDE.md` — Xcode 16+ `fileSystemSynchronizedGroups`, no CLI build path) and there is no test target anywhere in the repo (confirmed via `find` for `*Test*` and grep for `PBXNativeTarget`/`productType`, and previously logged in `deferred-work.md`). Correctness was verified by:

- Reading every call site of `pullFromRemote` and `VisitLogRepositoryProtocol` before changing the signature, to confirm nothing else implements or calls the old `pullFromRemote(restaurantId:)`
- Tracing the `hasPendingOperation` guard and the `fetch(id:) == nil` dedupe guard to confirm both are unchanged in the pull path (AC 5)
- Manually re-deriving the `.convertFromSnakeCase` failure the story describes (a decoder with that strategy against a struct with explicit snake_case `CodingKeys` and a hand-written `init(from:)` cannot match `user_id`) and confirming the fix removes the only source of that mismatch
- Editor-time SourceKit diagnostics ("Cannot find type 'Restaurant'", "No such module 'Supabase'") on every touched file are pre-existing single-file-indexing artifacts of not having a full Xcode build context in this environment — the same types/imports are used unchanged in adjacent untouched code in the same files

Device verification (reinstall, second-device live sync, dangling-visit repair, duplicate-safety, decode-failure logging) is **not yet done** — it requires two real devices/simulators per the story's own Verification section and cannot be performed from this environment. Flagging explicitly rather than claiming it.

### Completion Notes

- All three stacked defects (visits never pulled, relationship never hydrated, realtime decoder dead for both tables) are fixed in one pass, matching the story's own framing that fixing any one alone is invisible.
- Dropped the unused `pullFromRemote(restaurantId:)` rather than keeping it — the story explicitly permitted either choice, and nothing referenced it.
- `deferred-work.md`'s two entries for these defects (from the 3.5 and 2.9 reviews) are updated to point at this story with a "pending device verification" caveat rather than being deleted outright, since the fix is code-complete but unverified on-device.
- No test target exists in this repo (iOS side), so the workflow's TDD steps (write failing test → make it pass) were not literally executable; this matches every prior iOS story in this codebase, all of which shipped device-verified rather than unit-tested. Flagged here rather than silently skipped.

---

## File List

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/RepositoryProtocols.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/VisitLogRepository.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/App/AppState.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Sync/RealtimeSubscriptions.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryViewModel.swift`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Change Log

- 2026-09-02 — Implemented all three defects: added `VisitLogRepository.pullFromRemote(userId:)` with relationship hydration and dangling-visit repair, wired it into `AppState.reconcileOnForeground()`, hydrated the relationship on the realtime insert path, and fixed the realtime decoder's key-strategy conflict with both DTOs' explicit `CodingKeys`. Both previously-silent realtime `catch` blocks now log. Status → review.

---

## Review Findings

Code review 2026-09-02. Four layers; all returned. Severities set after reading the code and **running** the disputed claims. Build verified here: `xcodebuild` **BUILD SUCCEEDED** (the Dev Agent Record says no CLI build exists — that came from `CLAUDE.md` and is stale; `xcodebuild` works and was used on story 2.9).

**The three defects are fixed correctly, each the recommended way.** `.convertFromSnakeCase` dropped with both DTOs' explicit `CodingKeys` intact, so `pullFromRemote`'s default-decoder path is untouched. Restaurants awaited before visits, sequentially. Both empty `catch` blocks now log. The dead `pullFromRemote(restaurantId:)` was correctly dropped (zero call sites, one conformer), and `rehydrateDanglingVisits()` is what the Technical Notes asked for. AC 5's dedupe guard is preserved verbatim.

- [x] [Review][Decision] **RESOLVED 2026-09-02 — option (a): back History with `@Query`, matching Map and List.** Damon's call. Becomes a patch. **This supersedes the story's Out of Scope line** ("Any UI change. History renders correctly once the data is right"), which is demonstrably false and should be treated as revised rather than violated. It also supersedes **story 3.5's review decision 1** ("recompute sections into `state` so `ViewState` is the single render source"): that decision was made when History fetched through the repository, and `@Query` is synchronous, so there is no async state left for `ViewState` to represent — the same reason `RestaurantListView` and `MapView` carry none. History becomes structurally identical to the other two tabs. Original finding: **AC 3 cannot pass without a UI change, and Out of Scope forbids one** — AC 3 says a visit arriving by realtime *while History is showing* renders. `HistoryView` loads once from `.onAppear` into a snapshot; there is no `@Query` and no context observation, unlike `MapView.swift:19` and `RestaurantListView.swift:13` which both update live. So the row becomes *renderable* but not *visible* until the tab is left and re-entered. Out of Scope says "Any UI change. History renders correctly once the data is right" — which is now demonstrably false. **Genuine conflict; needs your call.** Options: (a) back History with `@Query` like the other two tabs, (b) reload on scene-phase active and after a pull completes, (c) narrow AC 3 to "renders on next appear" and record the limitation. Sources: blind-hunter+verification-gap+acceptance-auditor.

- [ ] [Review][Patch] **Nothing pulls visits on sign-in, so AC 1's own scenario fails** [App/AppState.swift:126] — the new pull lives only in `reconcileOnForeground()`, whose sole caller is `.onChange(of: scenePhase)` in `PDXDeliciousnessFinder.swift:46`. Signing in does not change `scenePhase`, and the cold-launch `.active` transition hits `guard let user = currentUser` while auth has not yet resolved. The `.signedIn` branch (`AppState.swift:42-49`) starts realtime and pulls nothing; realtime carries only new changes, never a backfill. **After delete-and-reinstall the journal stays empty until the user backgrounds and re-foregrounds the app** — the story's headline AC, failing. Verified by grep: `reconcileOnForeground` has exactly one call site. **high**
- [ ] [Review][Patch] **A repair failure discards the entire pull, silently** [Core/Storage/Repositories/VisitLogRepository.swift:87] — `try rehydrateDanglingVisits()` runs *before* `try modelContext.save()`. If it throws, every insert from the loop above is discarded unsaved, and `try?` at `AppState.swift:126` erases the error. The visible symptom is "History empty after reinstall" — the original bug, restored, with no diagnostic. Compounded by the next finding. **high**
- [ ] [Review][Patch] **`#Predicate { $0.restaurant == nil }` is the riskiest line here and is unexecuted** [Core/Storage/Repositories/VisitLogRepository.swift:103] — nil comparison against a to-one SwiftData relationship compiles cleanly (BUILD SUCCEEDED proves only that) and is a known-fragile corner that can trap or mis-evaluate at fetch time. It is also unscoped by user, while the pull filters on `user_id`. A `fetchAllVisits()` plus an in-memory `filter { $0.restaurant == nil }` is boring, provably correct, and no slower at this data scale. **high**
- [ ] [Review][Patch] **Both new pull calls swallow their errors** [App/AppState.swift:125-126] — `try?` with no logging. A permanently failing visit pull is indistinguishable from having no visits. This is the exact anti-pattern the story exists to remove, added to the path it is restoring. **medium**
- [ ] [Review][Patch] **The two delete paths still swallow decode failures** [Core/Sync/RealtimeSubscriptions.swift:98, :162] — `try? action.decodeOldRecord(...)` converts a failure to nil, so the `if let` simply does not run and the newly-added logging `catch` never fires. The story's correction said the silent catch is what hid a dead sync path; two of them remain, two lines above each new log line. **medium**
- [ ] [Review][Patch] **The new logging will not actually surface the failure it exists for** [Core/Sync/RealtimeSubscriptions.swift:107, :171] — `error.localizedDescription` on a `DecodingError` yields a generic "The data couldn't be read", discarding the `codingPath`/`debugDescription` that names the offending key. And neither interpolation carries `privacy: .public`, so OSLog renders the value as `<private>` in Console. `SyncQueue.swift:105` already uses `String(describing: error)` with `privacy: .public` for exactly these reasons. A `<private>` catch hides a dead sync path about as well as an empty one. **medium**
- [ ] [Review][Patch] **A restaurant arriving by realtime does not repair its dangling visits** [Core/Sync/RealtimeSubscriptions.swift:111] — AC 4 says the visit "becomes visible once its restaurant arrives", but the only repair pass lives in `pullFromRemote`. The story sanctioned that deferral, but the correction *revived* realtime, which turns this from theoretical into the routine ordering case — and it compounds with the sign-in gap above, since the pull may never run. A few lines in `handleRestaurantInsert` closes the AC properly. **medium**
- [ ] [Review][Patch] **Hydration is O(n) fetches, re-run on every foreground** [Core/Storage/Repositories/VisitLogRepository.swift:82-104] — one `Restaurant` fetch per inserted visit, then a full dangling sweep with another fetch each. On a reinstall restore that is roughly 3N round trips through SwiftData on the main actor, and the sweep re-runs on every foregrounding even with nothing to repair. One `FetchDescriptor<Restaurant>` into a `[UUID: Restaurant]` collapses it. **low**
- [ ] [Review][Patch] **`sprint-status.yaml` still carries the now-false warning on story 1.4** — the comment says realtime is "PROVEN NOT WORKING", while this story fixes it. **low**

- [x] [Review][Defer] **Hydration arms the cascade delete rule for the first time** — deferred, new behaviour worth its own look. `Restaurant` declares `@Relationship(deleteRule: .cascade, inverse: \VisitLog.restaurant)`. Until now synced visits had a nil relationship, so the cascade never touched them. With hydration working, deleting a restaurant removes its local visits — and `RestaurantRepository.delete` does not enqueue matching remote visit deletes, so the rows survive server-side and return on the next pull.
- [x] [Review][Defer] **The pull is insert-only: no updates, no delete reconciliation** — deferred, scope. A note edited server-side never reaches the device (`handleVisitLogChange` treats `.update` as a no-op, and the pull skips existing rows). A visit deleted elsewhere is removed only if a realtime delete lands, which by this story's own account has never happened — so devices are likely holding visits that no longer exist server-side. `RestaurantRepository.pullFromRemote` at least compares `updatedAt`; `visit_logs` has no such column.
- [x] [Review][Defer] **The pull skips the `hasPendingOperation` guard the realtime handlers use** — deferred, pre-existing asymmetry. If a queued local delete has not flushed, the pull can re-insert the row the user just deleted.
- [x] [Review][Defer] **No pagination on the visit select** — deferred. `.select()` with no `.range` is subject to PostgREST's `max-rows`, which truncates silently rather than erroring. Restaurants are bounded by hand-entry; a visit journal is not.
- [x] [Review][Defer] **`hydrateRestaurant` is duplicated verbatim in two files, and the Logger subsystem is now hardcoded in a third** — deferred, maintainability. The story weighed shape 1 vs shape 2 and chose shape 1 for size, which is right; nothing was done about the known downside. A shared constant next to `SupabaseTables` would match ARCH-10's convention.

**Dismissed as noise (2):**
1. *"The `.iso8601` date strategy is still broken and realtime remains dead."* Raised by two layers with confident detail. **Tested and false:** `.iso8601` accepts `...T10:00:00+00:00`, `...T10:00:00.123456+00:00` and `...T10:00:00Z`. It fails only on a timestamp with no timezone and on Postgres' space separator — and the PostgREST custom decoder, which the working pull path uses, **fails on those identically**. The realtime decoder is not narrower than the path that works in any way that matters.
2. *"Removing `.convertFromSnakeCase` will break a future DTO that relies on automatic conversion."* Speculative, self-rated low confidence; both DTOs decoded through this decoder declare explicit `CodingKeys`.

---

## Review Patches Applied, 2026-09-02

All 10 applied. **`xcodebuild` BUILD SUCCEEDED** afterwards.

| Fix | Where |
|---|---|
| Pull on sign-in, not only on scene-phase change | `AppState` `.signedIn` branch |
| Reentrancy guard, since sign-in and scene-phase can now both fire | `AppState.isReconciling` |
| Skip the visit pull when the restaurant pull failed, and log both | `AppState.reconcileOnForeground` |
| Save the pull **before** attempting repairs | `VisitLogRepository.pullFromRemote` |
| In-memory nil-relationship filter, user-scoped, replacing `#Predicate { $0.restaurant == nil }` | `rehydrateDanglingVisits` |
| One restaurant lookup instead of one per visit | `restaurantLookup()` |
| Delete-path decode failures reach the logging `catch` | `RealtimeSubscriptions` `.delete` branches |
| Logs carry `String(describing:)` and `privacy: .public` | both `catch` blocks |
| A restaurant arriving live repairs its waiting visits | `handleRestaurantInsert` |
| History backed by `@Query` | `HistoryView`, `HistoryGrouping` |
| Stale "PROVEN NOT WORKING" note on 1.4 | `sprint-status.yaml` |

### The History refactor, and what it supersedes

`HistoryView` now takes a `userId` and drives off `@Query`, filtered by user and sorted by `visitedAt` descending, exactly like `RestaurantListView` and `MapView`. Sections are computed at the top level of `body` (Story 3.3 precedent).

`HistoryViewModel` is gone. With `@Query` there is no asynchronous load, so `ViewState` had no loading or error case left to represent — which is why the other two tabs never had one. What remained was a pure function, so the file is now `HistoryGrouping.swift` holding `MonthSection` and one `static func sections(from:matching:)`.

**This supersedes story 3.5's review decision 1** (`ViewState` as the single render source). That call was correct for a repository-fetched History and is simply moot now. Recorded rather than silently reversed.

`VisitLogRepository.fetchAllVisits()` and its protocol declaration were removed — the `@Query` change orphaned them, and dead sync methods are exactly what this story exists to clean up.

### One thing the findings did not predict

Renaming `HistoryViewModel.swift` **broke the build**: `project.pbxproj` lists it in the ShareExtension's `membershipExceptions`. `CLAUDE.md` states source files are not individually listed in `pbxproj` — true for *added* files under `fileSystemSynchronizedGroups`, but not for renames or deletions, which must be reflected in the exception list. Worth correcting in `CLAUDE.md`.

### Still outstanding — device pass

Unchanged, and now broader because the History UI changed:

- reinstall → sign in → **go straight to History without backgrounding the app** (this is the case the sign-in patch fixes; the old flow passed only by accident)
- second device: log a visit on A, watch it appear on B **without foregrounding B**
- a visit whose restaurant has not yet synced becomes visible once it arrives
- repeated foregrounding does not duplicate visits
- search and the empty states still behave after the `@Query` refactor
