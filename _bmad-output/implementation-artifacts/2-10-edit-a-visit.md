# Story 2.10: Edit a Visit

**Epic:** 2 — Your Portland Food Journal
**Status:** 🔲 Ready for Dev
**Effort:** Medium — schema, sync layer, and UI
**Requested:** 2026-09-02 by Damon, from the real workflow: log the visit now, look up the dish name later, come back and write it down.

---

## User Story

As a Portland food enthusiast,
I want to go back and edit a visit I already logged,
So that I can add what I ate once I remember it, or fix a date I got wrong.

---

## Why this is not a UI story

A visit is currently **write-once**, and three places depend on that:

| Where | What it does today |
|---|---|
| `VisitLogRepository` | `save` (insert) and `delete` only — **no `update`** |
| `RealtimeSubscriptions.handleVisitLogChange` | `case .update: break` — *"Visit logs are immutable after creation; updates are no-ops"* |
| `VisitLogRepository.pullFromRemote` | Insert-only; skips any row it already holds |

And `visit_logs` has **no `updated_at` column**, so nothing can decide which of two edits is newer.

**Damon's call, 2026-09-02: edits must sync.** So this story un-defers two items from the story 1.5 review — the missing update path and the insert-only pull — and adds the column that makes last-write-wins possible.

---

## Acceptance Criteria

**Given** I am on the History tab
**When** I swipe a visit row
**Then** I get an Edit action

---

**Given** I tap Edit
**When** the sheet opens
**Then** it is pre-filled with that visit's existing date and note, and shows the same "View menu" action the logging sheet has

---

**Given** I change the note and save
**When** the sheet dismisses
**Then** the History row shows the new note immediately

---

**Given** I edit a visit on one device
**When** my other device foregrounds, or is open and subscribed
**Then** it shows the edited note, not the original

---

**Given** the same visit was edited on two devices
**When** both edits sync
**Then** the more recent edit wins, decided by a timestamp rather than by arrival order

---

**Given** I edit a visit while offline
**When** connectivity returns
**Then** the edit syncs, and no duplicate visit is created

---

**Given** I save an edit
**When** it persists
**Then** the visit keeps its original `id` and `created_at` — an edit must never become a second visit

---

## Technical Notes

### Step 0 — schema, and one consequence to know about

```sql
alter table visit_logs add column updated_at timestamptz not null default now();
```

Check it in as `supabase/migrations/<timestamp>_add_visit_logs_updated_at.sql`. The migrations directory exists as of story 2.9 — **do not apply this by hand only.**

**The backfill has a side effect.** Existing rows get `updated_at = now()`, which is newer than every local copy. The first pull after the migration will therefore consider every remote visit newer and apply it. Harmless in practice — `note` is the only mutable field and the values are identical — but know it is happening rather than being surprised by a wave of updates.

**Verify RLS allows update on `visit_logs`.** The table has only ever been inserted into and deleted from by this app. If there is no `for update` policy, the write will fail silently through `SyncQueue`, which retries three times and then **deletes the operation** (`SyncQueue.swift:109-115`) — the edit vanishes with no error. Check the policy before writing code.

### Outbound — mirror the restaurant pattern exactly

`RestaurantRepository.update` is the shape to copy:

```swift
func update(_ restaurant: Restaurant) throws {
    restaurant.updatedAt = .now
    try modelContext.save()
    try syncQueue.enqueueUpsert(table: SupabaseTables.restaurants, recordId: restaurant.id)
}
```

`enqueueUpsert` already covers insert and update — the sync layer needs no new action type. Add `update(_ visitLog: VisitLog)` to `VisitLogRepository` and its protocol, plus `updatedAt` on the `VisitLog` model, on `VisitLogDTO` with an explicit `CodingKeys` entry (ARCH-11), and in both directions of the DTO conversion.

### Inbound — three places, and one of them currently asserts the opposite

1. **`RealtimeSubscriptions.handleVisitLogChange`** — replace `case .update: break` with a real handler. Mirror `handleRestaurantUpdate`, including its `hasPendingOperation` guard so an inbound event cannot clobber a local edit that has not flushed yet. **Delete the "visit logs are immutable" comment; it becomes actively misleading.**
2. **`VisitLogRepository.pullFromRemote`** — currently `if (try fetch(id: dto.id)) == nil { insert }`. Add the else branch, applying the DTO only when `dto.updatedAt > existing.updatedAt`, exactly as `RestaurantRepository.pullFromRemote` does.
3. **Preserve `id` and `created_at`** on every inbound apply. The last AC exists because an update that rewrites those is indistinguishable from a duplicate.

### The edit UI

Reuse `AddVisitView` rather than building a second form — it already has the date picker, the note field, and the "View menu" action, and **"View menu" is the whole point of this story**: Damon's stated workflow is to come back and look up what the dish was called.

Add an editing mode, e.g. `init(editing visitLog: VisitLog)`, which pre-fills `visitedAt` and `note` and makes `save()` update rather than insert. Keep `markVisited` out of the edit path — editing a visit must not change the restaurant's status.

**Present it from `HistoryView`, not from a row's navigation destination.** A `.swipeActions` Edit button on the row, presenting `AddVisitView` as a sheet from `HistoryView` itself. That keeps the depth at one sheet, so "View menu" is the second — the topology that works.

⚠️ **Read the Device Defect section of story 2.8 before wiring this up.** Presenting a sheet from inside another sheet put Safari three deep and collapsed the whole chain on dismissal. Check presentation *depth*, not just how many `.sheet` modifiers are on a view.

### Architecture constraints

| Constraint | Requirement |
|---|---|
| ARCH-9 | The edit saves through `VisitLogRepository` → `SyncQueue`. No direct `supabase.from()` |
| ARCH-11 | Explicit `CodingKeys` for `updatedAt` ↔ `updated_at` |
| ARCH-13 | Data access through the repository or `@Query` |

---

## Files to Modify

| File | Change |
|---|---|
| `supabase/migrations/<ts>_add_visit_logs_updated_at.sql` | **New** — the column |
| `Core/Storage/Models/VisitLog.swift` | `updatedAt` property + init |
| `Core/Network/DTOs/VisitLogDTO.swift` | property, `CodingKeys`, encode, decode, both conversions |
| `Core/Storage/Repositories/VisitLogRepository.swift` | `update(_:)`; update branch in `pullFromRemote` |
| `Core/Storage/Repositories/RepositoryProtocols.swift` | Declare `update(_:)` |
| `Core/Sync/RealtimeSubscriptions.swift` | Real `.update` handler; remove the immutability comment |
| `Features/RestaurantDetail/AddVisitView.swift` | Editing mode |
| `Features/History/HistoryView.swift` | Swipe action + edit sheet |

---

## Out of Scope

- Editing a visit from `RestaurantDetailView`'s visit list — History is where Damon asked for it. Revisit if it feels missing
- Deleting a visit from History (`delete` exists on the repository; no UI asked for)
- Web parity for editing — belongs to the S6 spec. **Note the web app does not write `note` after creation, so it cannot clobber an edit; it will simply show stale text until S6 catches up**
- Edit history, versioning, or an audit trail
- Changing which restaurant a visit belongs to — that is a move, not an edit

---

## Verification

Build first (`xcodebuild`, see `CLAUDE.md`). No test target exists, so a green build plus a device pass is the whole story.

- Swipe a History row → Edit → the sheet is pre-filled with the existing date and note
- Change the note, save, and the History row updates **immediately** (History is `@Query`-backed)
- Tap "View menu" from inside the edit sheet, close Safari, and **the sheet is still there with your text** — this is the 2.8 defect, and the reason this story presents from `HistoryView`
- The edited visit keeps its position in the month grouping and does not appear twice
- Edit on device A, foreground device B → B shows the new note
- Edit on device A while B is open and subscribed → B updates without foregrounding
- Airplane mode: edit, re-enable, confirm the edit syncs and no duplicate appears
- Confirm the restaurant's status is unchanged by editing a visit
