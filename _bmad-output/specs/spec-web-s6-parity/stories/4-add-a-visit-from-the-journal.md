---
title: 'Add a visit from the journal'
type: 'feature'
created: '2026-09-10'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'cee6107fd9963dcc10b0a1ec08536f75ef614e68'
context: ['{project-root}/_bmad-output/specs/spec-web-s6-parity/SPEC.md', '{project-root}/_bmad-output/specs/spec-web-s6-parity/parity-audit.md', '{project-root}/_bmad-output/specs/spec-web-s6-parity/edge-cases.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CAP-3. The journal shows every visit but offers no way to log a new one — Damon has to leave it, find the restaurant in the list, and log it there, breaking the "decision surface" flow iOS 2.8 already gives him.

**Approach:** A "+" affordance on the Journal opens a modal that reuses CAP-1's search/matching to pick a restaurant, then reuses `RestaurantPanel`'s inline log form to save via the existing `logVisit` action — the new entry appears in the journal immediately, no reload.

## Boundaries & Constraints

**Always:** `logVisit`'s `want_to_go`→`been_there` auto-promotion fires unchanged; only its `statusChanged` result is consumed. The new visit is merged straight into `HistoryView`'s local `logs` state (prepend, re-sort by `visited_at` desc) — no refetch. The picker matches by name/cuisine/neighborhood via `filters.ts`'s `matchesQuery`/`normalizeSearchText` — no second matching rule. Modal chrome (overlay, card, header, Escape/click-outside close) matches `EditRestaurantModal`'s established pattern. The "+" lives inside `HistoryView`'s own content, not `HomeView`'s shared header/toggle bar.

**Ask First:** None — CAP-3's shape is fully specified in `SPEC.md`/`build-plan.md`.

**Never:** No new server action — `logVisit`/`getAllVisitLogs` already cover it. No changes to `FilterState` or the main list/map search. No edit-visit UI (story 5, CAP-4). No change to `HomeView`'s header layout.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Open the picker | Tap "+" on Journal | Modal opens: search box + full restaurant list | N/A |
| Search the picker | Type a partial name/cuisine/neighborhood | List narrows using the same rule as CAP-1's search | N/A |
| Picker search, no match | Query matches nothing | "No matches" message; search box stays enabled | N/A |
| Select a restaurant | Tap a row | Modal advances to the log form (date defaults to today, note optional) | N/A |
| Save a visit | Form submitted | Visit saves, modal closes, new entry appears at the top of its month section immediately | Save fails → inline error, modal stays open, date/note preserved |
| Save for a `want_to_go` restaurant | Save | Status becomes `been_there` (existing `logVisit` behavior) | N/A |
| Cancel from either step | Close / Escape / click outside | Modal closes, nothing saved | N/A |

</frozen-after-approval>

## Code Map

- `web/src/components/HistoryView.tsx` -- MODIFY. Add `restaurants: Restaurant[]` to `Props` (currently line 16-18); add `pickerOpen` state; render a floating "+" (fixed, `#C2410C`) that opens `<AddVisitModal>` — same "FAB below the header, not a header change" treatment already established for `FilterButton`. On the modal's `onSaved(visit, restaurant, statusChanged)`, build a `VisitLogWithRestaurant` from `visit` + `{ id: restaurant.id, name: restaurant.name, neighborhood: restaurant.neighborhood, venue_type: restaurant.venue_type, status: statusChanged ? 'been_there' : restaurant.status }`, prepend into `logs` and re-sort by `visited_at` desc — mirrors `RestaurantPanel.tsx`'s `handleSave` (lines 104-124). Call `router.refresh()` (import `useRouter` from `next/navigation`) only when `statusChanged` is true, same conditional as `RestaurantPanel.tsx:120`.
- `web/src/components/AddVisitModal.tsx` -- NEW. Two-step (`step: 'pick' | 'log'`). Overlay/card/header/close chrome and Escape + click-outside handling copied from `EditRestaurantModal.tsx` (keydown effect ~lines 66-72, `handleOverlayClick` ~78-80, overlay/card/header JSX ~124-172, `iconBtnStyle` ~388-397). Pick step: local `query` state, filters `restaurants` via `matchesQuery(r, normalizeSearchText(query.trim()))` from `@/lib/filters` (`filters.ts:40-52` as-is); selecting a row sets `step: 'log'`. Log step: `formDate`/`formNote` state and fields modeled on `RestaurantPanel.tsx:442-493` (date defaults to `new Date().toISOString().split('T')[0]`, optional note); Save calls `logVisit(restaurant.id, formDate, formNote.trim() || null)` from `@/app/actions`, then `onSaved(visit, restaurant, statusChanged)` and closes; on throw, shows an inline error and keeps the form open (mirrors `RestaurantPanel.tsx`'s `saveError`).
- `web/src/components/HomeView.tsx` -- MODIFY. Pass `restaurants={restaurants}` into the existing `<HistoryView onSelectRestaurant={...} />` call (~lines 367-383) — the same full, unfiltered array already passed to `MapView` per story 3.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/components/AddVisitModal.tsx` -- create the two-step pick/log modal -- delivers CAP-3's picker + save UI
- [x] `web/src/components/HistoryView.tsx` -- accept `restaurants` prop, render the "+" FAB, wire the modal, merge the saved visit into local `logs` -- entry point + immediate update, no reload
- [x] `web/src/components/HomeView.tsx` -- pass `restaurants` into `<HistoryView>` -- gives the picker its restaurant list

**Acceptance Criteria:**
- Given the journal is open, when the user taps "+", picks a restaurant, and saves a visit, then the new entry appears at the top of the correct month section immediately, with no page reload.
- Given the picked restaurant's status is `want_to_go`, when the visit saves, then its status becomes `been_there` and Map/List reflect it after `router.refresh()`.
- Given the picker search box, when the user types a query, then only restaurants matching by name, cuisine, or neighborhood (CAP-1's rule) remain listed.
- Given the save fails, when the user retries, then the modal stays open with the entered date/note preserved and an inline error shown.

## Design Notes

`logVisit`'s insert-returning select (`actions.ts:264-303`) has no joined restaurant, so the modal hands `HistoryView` both the raw `visit` and the `restaurant` it was created for; `HistoryView` assembles the `VisitLogWithRestaurant` itself before prepending. This keeps `logVisit` untouched, per `SPEC.md`'s constraint not to alter its auto-promotion.

## Verification

**Commands:**
- `cd web && npm run build` -- expected: zero errors
- `cd web && npx tsc --noEmit` -- expected: zero TypeScript errors

**Manual checks:**
- Open the journal, tap "+", search by partial name/cuisine/neighborhood, select a restaurant, save a visit with a note → entry appears immediately in the correct month section.
- Repeat for a `want_to_go` restaurant → confirm it shows `been_there` after switching to List/Map.
- Trigger a save failure → confirm inline error and preserved form input.
- Escape and click-outside both close the modal without saving.

**Status (2026-09-10):** Code implemented and code-reviewed against this spec's Code Map; `npm run build` and `npx tsc --noEmit` both pass with zero errors. Manual checks above were not run against a local dev server — local sign-in was not working in this session for unrelated reasons — and are deferred to a production check instead. Damon's call.

A 3-layer automated review (blind-hunter, edge-case-hunter, verification-gap) ran against the diff and surfaced one real regression (a race where the "+" FAB was interactable before the initial visit-log fetch resolved, letting a freshly-saved visit get silently overwritten) plus four smaller bugs — all patched: the FAB/modal now gate on the initial load having succeeded; the date field has a `max` of today and a local-calendar (not UTC) default; going back to re-pick a restaurant clears the in-progress note/date; and the modal's close paths no-op mid-save. Four lower-impact findings (modal accessibility gaps shared with `EditRestaurantModal`, triplicated modal-chrome styling, a pre-existing `logVisit` edge case, and a minor status-staleness window on other journal rows) were logged to `deferred-work.md` rather than fixed here — none are caused by or block this story.

## Suggested Review Order

**Entry point and picker → log flow**

- The "+" FAB is the entry point; gated so it can't open before the journal has actually loaded (see the race-condition fix below).
  [`HistoryView.tsx:209`](../../../../web/src/components/HistoryView.tsx#L209)

- Two-step state machine: pick a restaurant, then log a visit for it.
  [`AddVisitModal.tsx:27-28`](../../../../web/src/components/AddVisitModal.tsx#L27)

- Picker reuses CAP-1's exact matching rule rather than a second one.
  [`AddVisitModal.tsx:87-91`](../../../../web/src/components/AddVisitModal.tsx#L87)

- Save goes through the existing `logVisit` action — no new server code.
  [`AddVisitModal.tsx:75-77`](../../../../web/src/components/AddVisitModal.tsx#L75)

**Merging the saved visit without a reload**

- `logVisit`'s insert doesn't return a joined restaurant, so it's assembled client-side from the picked restaurant.
  [`HistoryView.tsx:68-82`](../../../../web/src/components/HistoryView.tsx#L68)

- Prepend + re-sort mirrors `RestaurantPanel.tsx`'s existing save pattern.
  [`HistoryView.tsx:83-86`](../../../../web/src/components/HistoryView.tsx#L83)

- `router.refresh()` fires only when the restaurant's status actually changed.
  [`HistoryView.tsx:87`](../../../../web/src/components/HistoryView.tsx#L87)

**Race-condition fix (found in review)**

- The FAB (and the modal it opens) is only available once the initial fetch has succeeded, closing the window where a save could be silently overwritten.
  [`HistoryView.tsx:194-199`](../../../../web/src/components/HistoryView.tsx#L194)

- The modal's mount carries the same guard.
  [`HistoryView.tsx:237`](../../../../web/src/components/HistoryView.tsx#L237)

**Other review fixes**

- Local-calendar default and a `max` bound close two date bugs (UTC midnight skew, future-dated visits).
  [`AddVisitModal.tsx:18-21`](../../../../web/src/components/AddVisitModal.tsx#L18)
  [`AddVisitModal.tsx:184`](../../../../web/src/components/AddVisitModal.tsx#L184)

- Going back to search resets the form, so a note typed for one restaurant can't attach to a different one.
  [`AddVisitModal.tsx:59-64`](../../../../web/src/components/AddVisitModal.tsx#L59)

- All three close paths (Escape, overlay click, buttons) no-op while saving, so a failure is never silently dropped by an unmount.
  [`AddVisitModal.tsx:48-51`](../../../../web/src/components/AddVisitModal.tsx#L48)

**Wiring**

- `HomeView` passes the full restaurant list down, the same array `MapView` already receives.
  [`HomeView.tsx:377`](../../../../web/src/components/HomeView.tsx#L377)
