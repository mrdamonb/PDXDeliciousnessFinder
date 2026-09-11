---
title: 'Edit a visit'
type: 'feature'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '7e3abd200250e5676b4db5588ff0e9d6e223cef1'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A logged visit is write-once on the web — no way to fix a wrong date/note, and (Damon, 2026-09-11, reversing the S6 draft's non-goal) no way to remove one added by mistake, from either surface that shows it.

**Approach:** Add `updateVisit`/`deleteVisit` server actions (writing a real `updated_at`, matching iOS 2.10's conflict semantics), then edit/delete affordances on both the Journal and `RestaurantPanel.tsx`'s visit history, reusing each surface's own existing UI pattern rather than inventing a third.

## Boundaries & Constraints

**Always:**
- Every edit/delete goes through `actions.ts`, scoped `eq('user_id', user.id)` — no direct client mutation.
- Edit preserves `id`/`created_at`; only `visited_at`, `note`, `updated_at` change. Edit **must** write `updated_at` (iOS resolves conflicts on `dto.updatedAt > existing.updatedAt`).
- Neither edit nor delete ever touches the restaurant's `status`.
- Delete requires a confirm step before the row disappears (no one-tap delete).
- Delete is available from both the Journal and RestaurantPanel's visit history.

**Ask First:** If `deleteVisit` fails on an RLS/permission error (no verified DELETE policy on `visit_logs` — see Assumptions in SPEC.md), stop and ask Damon rather than widening access to work around it.

**Never:** Edit history/versioning/audit trail; changing which restaurant a visit belongs to (existing non-goals, unchanged).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit a visit's note | Journal or panel → edit → change → save | New note shown immediately; same `id`/`created_at`; fresh `updated_at`; no duplicate | Save fails → inline error, form input preserved |
| Edit a visit's date across a month boundary | Journal, date moved March→April | Entry regroups under new header; now-empty old header disappears | N/A |
| Concurrent edit, web and iOS | Same visit edited on both before sync | Both converge on the later `updated_at`, silently | N/A |
| Delete a visit, Journal | Confirm delete on a row | Row removed immediately; empty month header also disappears | Delete fails → inline error, row stays |
| Delete a visit, RestaurantPanel | Confirm delete on a row in the expanded panel | Row removed immediately from that list | Delete fails → inline error, row stays |
| Delete the last visit for a restaurant | Panel visit list goes to zero | "No visits yet." empty state reappears | N/A |
| Edit or delete, either surface | Any outcome | Restaurant `status` and all other fields unchanged | N/A |

</frozen-after-approval>

## Code Map

- `web/src/app/actions.ts` -- `VisitLog`/`VisitLogWithRestaurant`/`RawVisitLogRow` types (L63-119) and the selects in `getVisitLogs` (L78), `getAllVisitLogs` (L141), `logVisit`'s insert-select (L276) all omit `updated_at` -- add it everywhere for type honesty. `deleteRestaurant` (L250) is the exact pattern for `deleteVisit`.
- `web/src/components/RestaurantPanel.tsx` -- visit rows render L505-522; the inline log form (L457-471) and the restaurant-delete confirm strip (L256-301, triggered by Pencil/Trash2 at L206-228) are the patterns to reuse per-row.
- `web/src/components/HistoryView.tsx` -- `JournalRow` (L248-324) is a full-row `<button>` that navigates on click; an edit affordance needs `stopPropagation`. `handleSaved` (L68-88) is the merge-into-state pattern to mirror for update/delete.
- `web/src/components/AddVisitModal.tsx` -- chrome (overlay/card/header/styles, L236-306) to model `EditVisitModal.tsx` on.
- iOS: `VisitLogRepository.delete(_:)` (`PDXDeliciousnessFinder/Core/Storage/Repositories/VisitLogRepository.swift:59`) exists but no ViewModel/View calls it -- confirmed via repo-wide grep, only `RestaurantDetailViewModel.delete(restaurant:)` is ever invoked. No user-facing delete-a-visit path on iOS today.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/app/actions.ts` -- add `updated_at` to the three visit types and every visit select; add `updateVisit(id, visitedAt, note)` (update + fresh `updated_at`, `.select().single()`) and `deleteVisit(id)` (mirrors `deleteRestaurant`) -- fixes the silent last-write-wins gap and adds both mutations.
- [x] `web/src/components/RestaurantPanel.tsx` -- add Pencil/Trash2 to each visit row; Pencil swaps the row into the existing inline form calling `updateVisit`; Trash2 shows an inline confirm calling `deleteVisit`; splice `visits` state on success, no `router.refresh()`.
- [x] `web/src/components/EditVisitModal.tsx` (new) -- modeled on `AddVisitModal.tsx`, pre-filled date/note, Save + confirm-gated Delete + Cancel.
- [x] `web/src/components/HistoryView.tsx` -- add a Pencil button to `JournalRow` (stopPropagation) opening `EditVisitModal`; splice `logs` state on update/delete, same approach as `handleSaved`.
- [x] `_bmad-output/specs/spec-web-s6-parity/SPEC.md` -- remove the stale "no delete" Non-goal, fold delete into CAP-4, add an Assumptions line recording the reversal.
- [x] `_bmad-output/specs/spec-web-s6-parity/stories.yaml` -- reconcile story 5's own "no delete-from-journal" stub.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- log iOS's unwired `VisitLogRepository.delete` as a follow-on parity gap.

**Acceptance Criteria:**
- Given a visit edited on web, when the update commits, then `visit_logs.updated_at` reflects the edit time.
- Given a visit deleted from either surface, when the delete commits, then it no longer appears in `getAllVisitLogs()`/`getVisitLogs()`, and no restaurant field changed.
- Given an edit or delete fails, when the error surfaces, then the row's prior on-screen state is preserved — no silent loss, no phantom removal.

## Design Notes

Journal edits go through a modal (`EditVisitModal`) because `JournalRow` is a full-row navigation button — inline editing there would fight the row's click target. `RestaurantPanel` edits go inline because that surface already has an inline log-form and an inline delete-confirm strip for the restaurant itself; matching that beats a third UI pattern. Not merged into `AddVisitModal` — that flow's two-step pick/log state machine doesn't fit editing a specific existing row.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit` -- expected: no type errors
- `cd web && npm run build` -- expected: production build succeeds

**Manual checks (if no CLI):**
- Journal: edit a visit's date/note, confirm it updates in place with no duplicate; delete a visit, confirm it disappears (and an emptied month header disappears too).
- RestaurantPanel: same edit/delete checks on a restaurant's own visit list; confirm the restaurant's status badge is unchanged after either action on both surfaces.

## Suggested Review Order

**Server actions — the sync/RLS contract**

- Entry point: writes a fresh `updated_at` on every edit so iOS's `dto.updatedAt > existing.updatedAt` conflict rule can see it — the constraint that bites silently if skipped.
  [`actions.ts:312`](../../../../web/src/app/actions.ts#L312)

- `.select('id')` plus an empty-result throw turns an RLS-blocked delete from a silent no-op into a surfaced error, mirroring `updateVisit`'s `.single()`.
  [`actions.ts:337`](../../../../web/src/app/actions.ts#L337)

**Journal — modal edit/delete**

- Delete stays confirm-gated even on failure now — the catch path no longer collapses the confirm strip that shows the error.
  [`EditVisitModal.tsx:78`](../../../../web/src/components/EditVisitModal.tsx#L78)

- A modal, not inline editing, because `JournalRow` is a full-row navigation target — the design tradeoff this story made.
  [`EditVisitModal.tsx:29`](../../../../web/src/components/EditVisitModal.tsx#L29)

- Keyboard activation of the nested Edit button now stops propagation before it can bubble into the row's own navigation handler.
  [`HistoryView.tsx:373`](../../../../web/src/components/HistoryView.tsx#L373)

- The row wrapper became a `div[role=button]` (from a `<button>`) so a real nested button could exist for Edit at all.
  [`HistoryView.tsx:301`](../../../../web/src/components/HistoryView.tsx#L301)

- Splice-not-refetch state updates — an edit crossing a month boundary regroups for free via `groupVisitsByMonth`.
  [`HistoryView.tsx:99`](../../../../web/src/components/HistoryView.tsx#L99)

- Delete just filters the id out of local state — no server round-trip needed to confirm the removal client-side.
  [`HistoryView.tsx:107`](../../../../web/src/components/HistoryView.tsx#L107)

**RestaurantPanel — inline edit/delete**

- Inline, not modal, because this surface already had an inline log-form and delete-confirm strip to extend.
  [`RestaurantPanel.tsx:152`](../../../../web/src/components/RestaurantPanel.tsx#L152)

- Delete-confirm entry point, now also clearing the add-form state so only one of add/edit/delete-confirm shows at once.
  [`RestaurantPanel.tsx:188`](../../../../web/src/components/RestaurantPanel.tsx#L188)

- Save/delete handlers splice `visits` state directly — no `router.refresh()`, since status is never touched.
  [`RestaurantPanel.tsx:166`](../../../../web/src/components/RestaurantPanel.tsx#L166)

**Docs reconciled for the scope reversal**

- CAP-4's intent/success expanded to cover delete, replacing the stale "no delete" language.
  [`SPEC.md:36`](../SPEC.md#L36)

- The 2026-09-06 non-goal exclusion is explicitly reversed here, dated and attributed, rather than silently dropped.
  [`SPEC.md:74`](../SPEC.md#L74)

- Story 5's own stub in `stories.yaml` no longer contradicts what was actually built.
  [`stories.yaml:64`](../stories.yaml#L64)

- `edge-cases.md`, one of SPEC.md's declared contract companions, gained delete rows alongside its existing edit rows.
  [`edge-cases.md:23`](../edge-cases.md#L23)

- iOS's dead `VisitLogRepository.delete` and two review-surfaced races logged as follow-ons, not silently dropped.
  [`deferred-work.md:77`](../../../implementation-artifacts/deferred-work.md#L77)
