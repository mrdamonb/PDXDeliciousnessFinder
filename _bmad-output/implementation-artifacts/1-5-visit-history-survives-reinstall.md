# Story 1.5: Visit History Survives a Reinstall and Reaches a Second Device

**Epic:** 1 — Signed In & Ready
**Status:** 🔲 Ready for Dev — **scope grew 2026-09-02, see the correction below**
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
