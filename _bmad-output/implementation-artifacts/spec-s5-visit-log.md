---
title: 'PDX Deliciousness Finder — Web App S5: Visit Log'
type: 'feature'
created: '2026-04-29'
status: 'done'
baseline_commit: 'd5b69b62da114301c6f7cc6010bf1bfef84c8894'
context:
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can browse, add, and filter restaurants but have no way to log visits or see visit history from the web app.

**Approach:** Add a visit log section inside the expanded `RestaurantPanel` (the bottom-sheet that appears when a map pin is tapped). The section shows past visits (date + optional note) and a "+" button that opens an inline log form. Saving a visit writes to `visit_logs` and, if the restaurant's current status is `want_to_go`, auto-upgrades it to `been_there` in the same server action.

## Boundaries & Constraints

**Always:**
- Fetch visit logs lazily via `getVisitLogs` server action — called once when the panel first expands, not upfront in the server page.
- Insert via `logVisit` server action — session validated server-side; RLS enforces ownership.
- Default `visited_at` to today's ISO date (`new Date().toISOString().split('T')[0]`) in the log form.
- If `restaurant.status === 'want_to_go'` when a visit is logged, update `restaurants.status = 'been_there'` in the same server action and return `statusChanged: true`; client calls `router.refresh()` on status change.
- Display visits ordered newest-first (`visited_at DESC`).

**Ask First:**
- Any changes to the `visit_logs` or `restaurants` table schema or RLS policies.
- Editing or deleting existing visit entries.
- Editing `general_note` from the web panel — out of scope.
- Surfacing visit log in the list view row — defer to a later sprint.

**Never:**
- Fetch all users' visit logs upfront in the server page component.
- Auto-upgrade status beyond `been_there` (e.g., to `favorite`) — user does that manually.
- Allow saving a visit without a date.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Panel expands, no prior visits | `expanded → true` (first time) | Fetches visits → "No visits yet." + "+" button | "Could not load visits." muted error |
| Panel expands, has visits | `expanded → true` (first time) | List of visits newest-first; date + note per row | "Could not load visits." muted error |
| User clicks "+" | Panel expanded | Inline form: date input (default today) + note textarea + Save + Cancel | — |
| Save, status = want_to_go | Valid date, any note | Inserts visit; status → been_there; router.refresh(); visit prepended to list | "Could not save. Try again." — form stays open |
| Save, status = been_there or favorite | Valid date, any note | Inserts visit; no status change; visit prepended to list | "Could not save. Try again." — form stays open |
| Save with no note | Date only | Visit row shows date only; save succeeds | — |
| User clicks Cancel | Form open | Form closes; no insert; list unchanged | — |

</frozen-after-approval>

## Code Map

- `web/src/app/actions.ts` — add `VisitLog` type + `getVisitLogs` + `logVisit` server actions
- `web/src/components/RestaurantPanel.tsx` — add visit log section in expanded state; call server actions; handle status upgrade via `router.refresh()`

## Tasks & Acceptance

**Execution order matters — each task builds on the previous.**

- [ ] `web/src/app/actions.ts` — add three exports:
  - `VisitLog` type: `{ id: string; restaurant_id: string; visited_at: string; note: string | null; created_at: string }`
  - `getVisitLogs(restaurantId: string): Promise<VisitLog[]>` — validate session; select from `visit_logs` where `restaurant_id = restaurantId AND user_id = user.id` ordered by `visited_at DESC`; return rows (empty array if none).
  - `logVisit(restaurantId: string, visitedAt: string, note: string | null): Promise<{ visit: VisitLog; statusChanged: boolean }>` — validate session; insert into `visit_logs` (`restaurant_id`, `user_id`, `visited_at`, `note`); fetch `restaurants.status` for this restaurant; if `want_to_go`, update `restaurants.status = 'been_there'`; return inserted visit row and `statusChanged` flag. Throw on any Supabase error.

- [ ] `web/src/components/RestaurantPanel.tsx` — import `useRouter` from `next/navigation`; import `getVisitLogs`, `logVisit`, `VisitLog` from `@/app/actions`. Add state: `visits: VisitLog[] | null` (null = not yet fetched), `visitsLoading: boolean`, `visitsError: string | null`, `showForm: boolean`, `formDate: string`, `formNote: string`, `saving: boolean`, `saveError: string | null`. Add `useEffect` that fires when `expanded` transitions to `true` and `visits === null`: call `getVisitLogs(restaurant.id)`, set `visits` on success, set `visitsError` on failure. Add visit log section inside the expanded scroll area, below the general note card:
  - Section header row: "Visits" label (style matches "Note" — `text-xs font-semibold uppercase tracking-wide #A8A09A`) + 24×24px circle "+" button (`#C2410C` fill, white `+`, font-size 16px) that sets `showForm(true)`.
  - Visit list: if `visitsLoading` show a single muted "Loading…" line; if `visitsError` show error text; if `visits.length === 0 && !showForm` show "No visits yet." in `#A8A09A`; otherwise render each visit as a white card row (date in `#1C1917 text-sm font-medium`, note in `#6B6560 text-sm` below, omit note line if null).
  - Inline log form (shown when `showForm`): `<input type="date">` (value = `formDate`, onChange updates state); `<textarea>` placeholder "Note (optional)" (value = `formNote`, onChange updates state); Save button (disabled when `saving`, `#C2410C` fill, white text "Save"); Cancel button (muted, resets form and `showForm(false)`). On Save: set `saving(true)`, call `logVisit(restaurant.id, formDate, formNote || null)`, on success prepend visit to `visits`, reset form, `showForm(false)`, if `statusChanged` call `router.refresh()`, on error set `saveError`, always set `saving(false)`.
  - Wrap visit section in a `bg-white rounded-2xl` card matching the existing detail card style.

**Acceptance Criteria:**
- Given an authenticated user taps a map pin and expands the panel, visit logs are fetched and rendered newest-first.
- Given no visits exist, "No visits yet." appears with a "+" button.
- Given the user taps "+" and submits the form with a date and note, the visit appears at the top of the list and the form closes.
- Given the restaurant status is "Want to Go" when a visit is logged, the status badge updates to "Been There" after save (via router.refresh()).
- Given a save failure, "Could not save. Try again." appears and the form stays open.
- Given the user clicks Cancel, the form closes with no changes made.

## Design Notes

- Visit card uses the same white `rounded-2xl` / `0 1px 4px rgba(0,0,0,0.06)` shadow as the existing detail card — renders as a separate card below the note card, with `mb-3` spacing between them.
- Date display: `new Date(visited_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` — the noon offset avoids UTC-to-local date shift.
- Form inputs: `border border-[#D1C9C0] rounded-lg text-sm p-2 w-full` — matches the AddRestaurantModal input style.

## Verification

**Commands:**
- `cd web && npm run build` — expected: zero errors
- `cd web && npx tsc --noEmit` — expected: zero TypeScript errors

**Manual checks:**
- Tap a pin → expand panel → "Loading…" briefly → visits list or "No visits yet."
- Click "+" → form opens with today's date pre-filled
- Submit form on a "Want to Go" restaurant → status badge flips to "Been There"
- Submit form with no note → visit row shows date only, no empty line
- Cancel form → list unchanged

## Suggested Review Order

**Server actions — new data layer**

- `VisitLog` type + `getVisitLogs`: RLS-safe fetch ordered newest-first
  [`actions.ts:62`](../../web/src/app/actions.ts#L62)

- `logVisit`: insert → status check (`.maybeSingle()`) → conditional update → return flag
  [`actions.ts:87`](../../web/src/app/actions.ts#L87)

**Client state — visit log in RestaurantPanel**

- `restaurant.id` reset effect — clears stale visits when switching pins
  [`RestaurantPanel.tsx:57`](../../web/src/components/RestaurantPanel.tsx#L57)

- Lazy fetch effect — fires once on first expansion, guarded by `visits === null`
  [`RestaurantPanel.tsx:64`](../../web/src/components/RestaurantPanel.tsx#L64)

- `handleSave`: date guard + logVisit call + sort-correct optimistic update + conditional refresh
  [`RestaurantPanel.tsx:79`](../../web/src/components/RestaurantPanel.tsx#L79)

**UI — visit log section rendering**

- Section header with "+" button; border conditional on content presence
  [`RestaurantPanel.tsx:270`](../../web/src/components/RestaurantPanel.tsx#L270)

- Inline log form: date input, textarea, Save/Cancel, error display
  [`RestaurantPanel.tsx:307`](../../web/src/components/RestaurantPanel.tsx#L307)

- Visit list: loading / error / empty / rows with `.slice(0,10)` date normalization
  [`RestaurantPanel.tsx:347`](../../web/src/components/RestaurantPanel.tsx#L347)
