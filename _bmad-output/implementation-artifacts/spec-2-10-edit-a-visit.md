---
title: 'Edit a Visit'
type: 'feature'
created: '2026-09-06'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'af7ae557ca88a08d07c7d5587b14d84533461d2a'
story_key: '2-10-edit-a-visit'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Visits are currently write-once: `VisitLogRepository` has no `update`, the realtime handler explicitly no-ops on a visit `.update` event ("visit logs are immutable"), and the remote pull skips any row it already holds. A user cannot fix a typo or come back later and add what they ate.

**Approach:** Add `updated_at` to `visit_logs`, then wire a real update path end-to-end (repository, realtime, pull) by mirroring `RestaurantRepository`'s already-working update/last-write-wins pattern exactly. Reuse `AddVisitView` in an editing mode, presented via a swipe action on History rows.

## Boundaries & Constraints

**Always:**
- An edit preserves the visit's original `id` and `created_at` — it is a mutation, never a new row.
- Editing a visit never changes the restaurant's status — no `markVisited` path in the edit flow.
- Conflict resolution compares `updated_at` exactly as `RestaurantRepository.pullFromRemote` and `handleRestaurantUpdate` already do (`dto.updatedAt > existing.updatedAt`) — same comparison, same guard shape (`hasPendingOperation`), no new pattern invented.
- The edit sheet is presented as a single sheet directly from `HistoryView`, added as a new case to the existing `HistorySheet` enum — never nested inside another sheet. This topology is why the story 2.8 "View menu" defect was fixed; do not regress it.
- New migration file follows `20260902000000_add_restaurants_menu_url.sql`'s style: leading comment explaining the story/rationale, lower-case SQL, `if not exists` guard.

**Ask First:** None identified — the one real unknown (whether an UPDATE RLS policy exists on `visit_logs`) was verified present on the linked project before this spec was written (`visit_logs_update_own`, `USING (auth.uid() = user_id)`).

**Never:**
- Edit from `RestaurantDetailView`'s visit list (History-only, per the original request).
- Delete a visit from History UI.
- Edit history, versioning, or an audit trail.
- Changing which restaurant a visit belongs to.
- Any web-app change — web parity is a separate future spec, and the web app doesn't write `note` after creation so it cannot clobber an iOS edit today.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit note, save | Swipe → Edit → change note → Save | History row shows new note immediately; same `id`/`created_at` | N/A |
| Live cross-device edit | Device A edits while B is open + subscribed | B updates without foregrounding | Realtime decode failure logs via existing `OSLog` pattern, never crashes |
| Foreground cross-device edit | Device A edits while B is backgrounded, then B foregrounds | B shows the new note after the foreground pull | N/A |
| Concurrent edit, two devices | Same visit edited on A and B before either syncs | The edit with the later `updated_at` wins once both push | Silent resolution, no user-facing conflict prompt (matches restaurant behavior) |
| Offline edit | Edit with no connectivity, then reconnect | Edit syncs via `SyncQueue`; no duplicate visit created | N/A |
| View menu inside edit sheet | Tap "View menu", dismiss Safari (Done or swipe) | Edit sheet still present with unsaved changes intact | N/A — reuses the already-fixed `SafariView` dismiss path |

</frozen-after-approval>

## Code Map

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Models/VisitLog.swift` (32 lines, no `updatedAt` today) -- add `var updatedAt: Date` + init param, mirroring `Restaurant.updatedAt`.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Network/DTOs/VisitLogDTO.swift` -- add `updatedAt`, `CodingKeys` entry `updated_at` (L17-24 today), both encode/decode, and both conversion directions (`init(from model:)` L56-63, `toModel()` L65-74).
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/VisitLogRepository.swift` -- add `update(_:)` mirroring `RestaurantRepository.update` (`RestaurantRepository.swift` L58-66) exactly: bump `updatedAt`, save, `syncQueue.enqueueUpsert(table: SupabaseTables.visitLogs, recordId:)`. Modify `pullFromRemote` (L63-91, currently insert-only via `if (try fetch(id:)) == nil`) to add an else-branch applying the DTO when `dto.updatedAt > existing.updatedAt`, mirroring `RestaurantRepository.pullFromRemote` L82-100 exactly.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/RepositoryProtocols.swift` (L24-31) -- add `func update(_ visitLog: VisitLog) throws` to `VisitLogRepositoryProtocol` (compare `RestaurantRepositoryProtocol` L11).
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Sync/RealtimeSubscriptions.swift` -- replace the `.update` case in `handleVisitLogChange` (L168-191; today `case .update: break` at L175-177 with an "immutable" comment to delete) with a handler mirroring `handleRestaurantUpdate` (L139-154) exactly: `hasPendingOperation` guard, "doesn't exist locally → treat as insert" fallback, `updatedAt` comparison.
- `PDXDeliciousnessFinder/supabase/migrations/` -- new file `<timestamp>_add_visit_logs_updated_at.sql`: `alter table visit_logs add column if not exists updated_at timestamptz not null default now();`. Only existing migration is `20260902000000_add_restaurants_menu_url.sql` -- match its comment-block style.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/AddVisitView.swift` -- already supports a `title:` override and an `onSave` hook (from story 2.8/2.9). Add an editing initializer, e.g. `init(editing visitLog: VisitLog)`, pre-filling `visitedAt`/`note`; `save()` calls `visitLogRepository.update` instead of `.save` when editing, preserving `id`/`createdAt`. `markVisited` stays unused in this path.
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift` -- current state: one `.sheet(item: $activeSheet)` driven by a private `HistorySheet` enum (`.pick`, `.addVisit(Restaurant)`). Add a third case `.editVisit(VisitLog)`, and a `.swipeActions` modifier (first use of this modifier in the codebase — confirmed zero existing usages) on each history row with an "Edit" button setting `activeSheet = .editVisit(log)`. Stay inside the existing single-sheet topology — do not add a second sheet modifier.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/<ts>_add_visit_logs_updated_at.sql` -- add `updated_at` column -- makes last-write-wins possible; existing rows backfill to `now()`, so the first pull after deploy will treat every remote visit as newer (harmless: `note` is the only mutable field and values are identical pre-edit).
- [x] `Core/Storage/Models/VisitLog.swift` -- add `updatedAt` property + init -- required by DTO/repository conflict resolution.
- [x] `Core/Network/DTOs/VisitLogDTO.swift` -- add `updatedAt` field/CodingKeys/both conversions -- carries the timestamp over the wire (ARCH-11).
- [x] `Core/Storage/Repositories/RepositoryProtocols.swift` -- declare `update(_:)` on `VisitLogRepositoryProtocol` -- matches `RestaurantRepositoryProtocol` shape.
- [x] `Core/Storage/Repositories/VisitLogRepository.swift` -- implement `update(_:)`; add merge branch to `pullFromRemote` -- outbound edit path + inbound conflict resolution.
- [x] `Core/Sync/RealtimeSubscriptions.swift` -- real `.update` handler for visit logs; delete the immutability comment -- closes the last inbound gap (live cross-device edits).
- [x] `Features/RestaurantDetail/AddVisitView.swift` -- add editing mode -- reuses the existing form (date, note, View menu) rather than a second UI.
- [x] `Features/History/HistoryView.swift` -- swipe-to-edit action + `.editVisit` sheet case -- entry point, kept inside the proven single-sheet topology.

**Acceptance Criteria:**
- Given a visit exists in History, when I swipe the row, then I get an Edit action that opens `AddVisitView` pre-filled with the existing date and note, including "View menu".
- Given I change the note and save, when the sheet dismisses, then the History row shows the new note immediately with no duplicate entry and unchanged month grouping.
- Given the same visit is edited on two devices before either syncs, when both pushes complete, then the edit with the later `updated_at` is what both devices converge on.
- Given I edit a visit while offline, when connectivity returns, then the edit syncs and no duplicate visit is created.
- Given I edit a visit, when it saves, then the restaurant's status is unchanged.

## Verification

**Commands:**
- `xcodebuild -scheme PDXDeliciousnessFinder -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` -- expected: `** BUILD SUCCEEDED **`, zero errors.

**Manual checks (no test target exists in this repo):**
- Swipe → Edit → pre-filled correctly; change note, save, row updates immediately.
- Tap "View menu" from the edit sheet, dismiss via both Safari's Done button and swipe-down — edit sheet still present with unsaved text intact either way.
- Edit on device A, confirm device B updates live (open+subscribed) and after a foreground pull (backgrounded).
- **Genuine conflict, not just forward propagation:** edit the same visit on device B, then before B's edit finishes pushing, edit it differently on device A and let A's push land first. Confirm both devices converge on whichever edit actually has the later `updated_at` — not just on "whatever arrived last." (Every other check here only exercises A→B forward propagation, which would still pass even if the `updated_at` comparison were silently broken or removed.)
- Airplane mode: edit, reconnect, confirm sync and no duplicate.
- Confirm restaurant status is unchanged after editing one of its visits.
- **Launch over an existing install with real visits already logged** (not a clean reinstall) — confirms the new non-optional `VisitLog.updatedAt` property migrates the local SwiftData store safely rather than crashing at launch.

## Suggested Review Order

**Schema & sync-layer plumbing**

- Entry point: the new stored property that makes an edit's "when" trackable at all.
  [`VisitLog.swift:14`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Models/VisitLog.swift#L14)

- Inline default (`Date.now`, not `.now`) is required for SwiftData to safely migrate existing local stores.
  [`VisitLog.swift:14`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Models/VisitLog.swift#L14)

- DTO carries `updatedAt` over the wire with an explicit `updated_at` CodingKey (ARCH-11).
  [`VisitLogDTO.swift:25`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Network/DTOs/VisitLogDTO.swift#L25)

- New migration adds the column live rows needed before any of this could work end-to-end.
  [`20260906000000_add_visit_logs_updated_at.sql`](../../PDXDeliciousnessFinder/supabase/migrations/20260906000000_add_visit_logs_updated_at.sql#L14)

**Outbound edit path**

- `update(_:)` mirrors `RestaurantRepository.update` exactly — same bump-save-enqueue shape, no new pattern.
  [`VisitLogRepository.swift:50`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/VisitLogRepository.swift#L50)

- Protocol declaration keeping `VisitLogRepositoryProtocol` in sync with `RestaurantRepositoryProtocol`'s shape.
  [`RepositoryProtocols.swift:27`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/RepositoryProtocols.swift#L27)

**Inbound conflict resolution**

- `pullFromRemote` gains its first update branch — last-write-wins via `updatedAt` comparison.
  [`VisitLogRepository.swift:74`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/VisitLogRepository.swift#L74)

- Realtime `.update` stops being a hard no-op — the "immutable" comment this replaces was actively wrong as of this story.
  [`RealtimeSubscriptions.swift:175`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Sync/RealtimeSubscriptions.swift#L175)

- New handler mirrors `handleRestaurantUpdate`: `hasPendingOperation` guard, insert-if-missing fallback, timestamp comparison.
  [`RealtimeSubscriptions.swift:216`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Sync/RealtimeSubscriptions.swift#L216)

- Field allowlist (`visitedAt`/`note`/`updatedAt` only) — deliberately never touches `restaurantId`, `userId`, or `createdAt`.
  [`RealtimeSubscriptions.swift:275`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Sync/RealtimeSubscriptions.swift#L275)

**UI entry point and form**

- Swipe action is how a user reaches editing at all — kept inside the single-sheet topology from the 2.8 fix.
  [`HistoryView.swift:116`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift#L116)

- `.editVisit` case added to the existing `HistorySheet` enum rather than a second sheet modifier.
  [`HistoryView.swift:18`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift#L18)

- Editing initializer pre-fills from the existing visit; `restaurant` passed explicitly since the relationship is optional.
  [`AddVisitView.swift:49`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/AddVisitView.swift#L49)

- `save()` branches on `editingVisitLog` — the `userId` guard now lives only in the create branch (review patch).
  [`AddVisitView.swift:124`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/AddVisitView.swift#L124)
