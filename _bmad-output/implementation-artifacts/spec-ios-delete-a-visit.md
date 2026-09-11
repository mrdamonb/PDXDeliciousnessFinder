---
title: 'Delete a visit (iOS)'
type: 'feature'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'e27a66da2dc00225a5d930ea66832a8ecf8f21cb'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** iOS has no user-facing way to delete a logged visit. `VisitLogRepository.delete(_:)` exists and works but nothing calls it — while web's spec-web-s6-parity story 5 just shipped delete on both its surfaces, reversing a prior non-goal.

**Approach:** Wire the existing repository method into a confirm-gated swipe-to-delete on both places a visit is shown — the History tab (Journal) and a restaurant's own Visits section — matching this app's existing confirmationDialog-before-destructive-action convention (restaurant delete).

## Boundaries & Constraints

**Always:**
- Delete never touches the restaurant's `status` or any other field.
- Delete requires an explicit confirmation dialog before the visit is actually removed — no one-swipe-and-gone.
- Delete is available from both surfaces a visit is shown: the History tab and `RestaurantDetailView`'s own Visits section.
- Reuse `VisitLogRepository.delete(_:)` exactly as it exists today (local delete + enqueue remote delete via `SyncQueue`) — do not modify that method.

**Ask First:** None anticipated — additive UI only, no schema or sync-layer changes.

**Never:** Add edit to `RestaurantDetailView`'s Visits section — it has none today (story 2.10 scoped edit to the History tab only), and adding it isn't part of this request. Don't touch `SyncQueue` or `VisitLogRepository.delete`'s semantics.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete a visit, History tab | Swipe row → Delete → confirm | Row disappears immediately (`@Query` reactivity); restaurant status unchanged | Delete throws → alert shown, row stays |
| Delete a visit, RestaurantDetailView | Swipe row in Visits section → Delete → confirm | Row disappears immediately; visit count updates; status unchanged | Delete fails → shown in the view's existing error section, row stays |
| Cancel the confirmation dialog | Swipe → Delete → Cancel | Nothing removed | N/A |
| Delete the only visit for a restaurant | Visits section goes to zero | The `Visits (0)` section disappears (existing `if !visits.isEmpty` guard) | N/A |
| Delete while offline | No connectivity | Local delete applies immediately (optimistic); `SyncQueue` enqueues the remote delete for later flush | N/A — existing offline-queue behavior, unchanged |

</frozen-after-approval>

## Code Map

- `Features/History/HistoryView.swift:118-124` -- the existing `.swipeActions { Button("Edit") ... }` block on each row; add a red Delete action alongside it. No ViewModel exists here today — Edit already calls straight into a sheet, matching the direct-repo-call convention to extend for Delete.
- `Features/RestaurantDetail/RestaurantDetailView.swift:132-146` -- the Visits section's `ForEach`, currently a static `VStack` with zero interactivity (no edit, no delete). Add `.swipeActions` here. `:170-186` is the existing restaurant-delete `Button` + `.confirmationDialog` pattern to mirror for the visit-delete confirmation.
- `Features/RestaurantDetail/RestaurantDetailViewModel.swift:55-63` -- `delete(restaurant:repo:)` is the exact shape to mirror for a new `deleteVisit(_:repo:)`: wraps the repository call in `actionState` (`ViewState<Void>`) so failures surface through the view's existing error section, returns `Bool`.
- `Core/Storage/Repositories/VisitLogRepository.swift:59` -- `delete(_:)` already does everything needed (local delete + enqueue remote delete). Call it as-is; do not modify.

## Tasks & Acceptance

**Execution:**
- [x] `Features/RestaurantDetail/RestaurantDetailViewModel.swift` -- add `func deleteVisit(_ visit: VisitLog, repo: any VisitLogRepositoryProtocol) async -> Bool`, mirroring `delete(restaurant:repo:)`'s `actionState` wrapping and `Bool` return.
- [x] `Features/RestaurantDetail/RestaurantDetailView.swift` -- add a destructive swipe action to each visit row, gated by a `.confirmationDialog` (mirroring the restaurant-delete dialog already in this file) that calls `viewModel.deleteVisit(visit, repo: appState.visitLogRepository)`.
- [x] `Features/History/HistoryView.swift` -- add a red "Delete" swipe action next to the existing blue "Edit" one, gated by a `.confirmationDialog`, calling `appState.visitLogRepository.delete(log)` in a `do`/`catch` with a lightweight `.alert` on failure (no ViewModel exists in this view today).

**Acceptance Criteria:**
- Given a visit's swipe-Delete is tapped, when the confirmation dialog appears, then no visit is removed until its own Delete button is tapped.
- Given a visit deleted from either surface, when the delete completes, then it disappears from both surfaces immediately without changing the restaurant's status.
- Given a delete fails, when the error surfaces, then the visit stays visible and an error is shown (RestaurantDetailView's existing error section; History tab's alert).

## Design Notes

`RestaurantDetailView`'s Visits section gets a `ViewModel`-routed delete (matching how this view already handles restaurant delete and status actions with `actionState`), while `HistoryView` gets a direct repository call wrapped locally (matching how this view's existing Edit action and `AddVisitView`'s save/edit already work with no ViewModel). Two different wiring styles, deliberately — each matches the convention already established in its own file rather than introducing a third pattern or unifying two working ones.

## Verification

**Commands:**
- `cd PDXDeliciousnessFinder && xcodebuild -scheme PDXDeliciousnessFinder -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` -- expected: `BUILD SUCCEEDED`

**Manual checks (if no CLI):**
- Run in Simulator: swipe-delete a visit from the History tab, confirm it's removed and the restaurant's status is unchanged; swipe-delete a visit from a restaurant's own Visits section, same check; cancel a confirmation dialog and confirm nothing was removed.

## Suggested Review Order

- Entry point: the shape every visit-delete call mirrors, wrapping the existing repository call in `actionState` for RestaurantDetailView's error section.
  [`RestaurantDetailViewModel.swift:72`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/RestaurantDetailViewModel.swift#L72)

- RestaurantDetailView's own Visits section had zero interactivity before this — the swipe action and its confirmation dialog are the whole change here.
  [`RestaurantDetailView.swift:144`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/RestaurantDetailView.swift#L144)

- The dialog now names the visit's date and forces `titleVisibility: .visible` — both fixed in review after the title was silently invisible.
  [`RestaurantDetailView.swift:208`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/RestaurantDetailView.swift#L208)

- History's Delete swipe action is listed *after* Edit deliberately — first-listed wins the full-swipe gesture, and Edit already owned it.
  [`HistoryView.swift:159`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift#L159)

- Error state now types as `AppError`, matching `AddVisitView.saveError`'s convention in this same feature area rather than a raw string.
  [`HistoryView.swift:35`](../../PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/History/HistoryView.swift#L35)

- `deferred-work.md` records the sync-layer risk this story made reachable for the first time, without touching the method it's about.
  [`deferred-work.md:90`](deferred-work.md#L90)
