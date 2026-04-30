---
title: 'PDX Deliciousness Finder — Web App S4: Add Restaurant'
type: 'feature'
created: '2026-04-29'
status: 'done'
branch: 'web/s4-add-restaurant'
baseline_commit: '92b8f9a3336efdc62a23438fd65a118ece62ae25'
context:
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app has a complete browse experience (map, list, filters) but no way to add restaurants. Users must switch to the iOS app to add new places.

**Approach:** Add a "+" button to the header. Clicking opens a full-screen modal with a search input. Typing a query calls the existing `search-places` Supabase Edge Function (Yelp-backed). The user selects a result, reviews/edits a confirmation card (name, venue type, cuisine, price, status), and saves. The modal closes and the list refreshes via `router.refresh()`.

## Boundaries & Constraints

**Always:**
- Save only to the authenticated user's `restaurants` row (`user_id` = session user); RLS enforces this server-side.
- All restaurants saved with `city = 'Portland'` — all Yelp results are Portland-area.
- `status` defaults to `want_to_go` when the user does not change it.
- `venueType` from the edge function is camelCase (`foodCart`) — map to snake_case (`food_cart`) before inserting.
- `latitude` and `longitude` are required for save — all Yelp results include them.
- Call the edge function from the client component via `createClient().functions.invoke` (browser Supabase client) — avoids Server Action roundtrip latency for real-time search.
- Save via a Server Action (`saveRestaurant`) — session is validated server-side.
- After a successful save, call `router.refresh()` to re-run the server component and reload the restaurant list without a hard navigate.

**Ask First:**
- Any changes to the `restaurants` table schema or RLS policies.
- Adding neighborhood auto-detection — that is a separate story.
- Supporting manual add (free-form name/address without search) — deferred.

**Never:**
- Save a restaurant without lat/lng coordinates (no geocoding in S4).
- Expose other users' restaurants in search results.
- Debounce shorter than 400ms — prevents hammering the edge function on every keystroke.
- Add duplicate detection in S4 — defer to a later sprint.
- Allow editing address or lat/lng on the confirmation card — Yelp data is authoritative.
- Add a general note field — users can edit that in a future detail view.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Search with results | 3+ chars typed, 400ms debounce fires | Spinner → up to 5 result rows (name, address, venue type, price) | Network/edge error: "Search failed. Try again." below input |
| Search no results | Valid query, Yelp returns 0 | "No places found." message below input | — |
| Query under 3 chars | 1–2 chars typed | No search fired; prior results cleared | — |
| Select result | Click a result row | Slides to confirmation card: name (editable), address (read-only), venue type pills, cuisine input, price pills, status pills — all pre-filled from Yelp | — |
| Back from confirm | Click "← Back" | Returns to search panel; original results preserved | — |
| Save success | Click Save, name non-empty | Inserts row; modal closes; router.refresh() reloads list | — |
| Save error | Server Action throws | Inline error below Save: "Could not save. Please try again." | — |
| Name cleared by user | User deletes name field content | Save button disabled | — |
| Dismiss modal | Click × button or overlay backdrop | Modal unmounts; no restaurant added | — |

</frozen-after-approval>

## Code Map

- `web/src/app/actions.ts` — add `saveRestaurant` server action; existing `signOut` stays
- `web/src/components/AddRestaurantModal.tsx` — NEW; full search → confirm → save flow
- `web/src/components/HomeView.tsx` — add `useRouter`, "+" button, modal state, `onSaveSuccess` handler
- `web/src/lib/supabase/client.ts` — browser client used in modal to call `functions.invoke`

## Tasks & Acceptance

**Execution order matters — each task builds on the previous.**

- [x] `web/src/app/actions.ts` — add `SaveRestaurantData` type and `saveRestaurant(data: SaveRestaurantData)` server action. Type: `{ name: string; address: string | null; latitude: number; longitude: number; venue_type: string | null; cuisine: string | null; price_range: string | null; status: 'want_to_go' | 'been_there' | 'favorite'; city: string }`. Get session user via `createClient().auth.getUser()`; throw if no session. Insert into `restaurants` with `user_id = user.id`; throw on Supabase error.

- [x] `web/src/components/AddRestaurantModal.tsx` — `'use client'`; two-panel state machine (`'search' | 'confirm'`):
  - **Wrapper**: fixed overlay (`rgba(0,0,0,0.4)`, z-index 60); centered white card (max-width 480px, full-height on mobile, `rounded-2xl`, warm shadow `0 8px 32px rgba(0,0,0,0.18)`); × close button top-right (calls `onClose`); `Escape` key closes.
  - **Search panel**: text input autofocused on mount; debounce 400ms; fires only when `query.trim().length >= 3`; calls `createClient().functions.invoke('search-places', { body: { query, limit: 5 } })`; renders: loading spinner, up to 5 result rows (name + address primary, venue type label + price secondary), "No places found." empty state, error message on failure; clicking a row sets `selected` and switches panel to `'confirm'`.
  - **Confirm panel**: header row with "← Back" button (returns to `'search'`) and "Add Restaurant" title; form fields: name text input (required, pre-filled), address text (read-only, shown as muted text), venue type pill selector (restaurant / bar / brewery / food cart), cuisine text input (optional, pre-filled), price range pill selector ($, $$, $$$, $$$$), status pill selector (Want to Go / Been There / Favorite, default want_to_go); Save button (disabled when name empty); on Save: calls `saveRestaurant(...)` with `venueType` mapped (`foodCart` → `food_cart`), then calls `onSaveSuccess()`; shows inline error on throw.
  - Props: `onClose: () => void`, `onSaveSuccess: () => void`.

- [x] `web/src/components/HomeView.tsx` — import `useRouter` from `next/navigation`; add `modalOpen: boolean` state; add "+" button at far right of header (after `UserMenu`, 8px gap): 32×32px circle, `backgroundColor: '#C2410C'`, white `+` glyph, border-radius 999; clicking sets `modalOpen(true)`; render `<AddRestaurantModal onClose={() => setModalOpen(false)} onSaveSuccess={() => { router.refresh(); setModalOpen(false) }} />` when `modalOpen`.

**Acceptance Criteria:**
- Given an authenticated user, when they click "+", the Add Restaurant modal opens with a focused, empty search input.
- Given the user types 3+ characters and waits 400ms, a spinner appears then up to 5 place results are shown.
- Given results are shown, clicking a result transitions to the confirmation card pre-filled with Yelp data.
- Given the confirmation card, the user can change venue type, cuisine, price, and status before saving.
- Given the user clicks Save, the restaurant is inserted and appears on the map/list after the modal closes.
- Given a save error, an inline error message is shown and the modal stays open.
- Given the user clicks × or the backdrop, the modal closes with no side effects.
- Given fewer than 3 characters typed, no edge function call is made.

## Design Notes

**Pill active states:**
- Status pills: Want to Go → `#D97706` fill; Been There → `#16A34A` fill; Favorite → `#DC2626` fill (match S2/S3 tokens)
- All other pills active: `#C2410C` (accent) fill, white label
- Inactive pills: `#EDE8E3` background, `#6B6560` label

**"+" button**: rightmost header item, 32×32px circle, `#C2410C`, white `+` (font-size 20px, line-height 1). No label — icon-only keeps the header compact.

**venueType mapping table** (edge function → DB column):
- `foodCart` → `food_cart`
- `restaurant` → `restaurant`
- `bar` → `bar`
- `brewery` → `brewery`

## Verification

**Commands:**
- `cd web && npm run build` — expected: zero errors
- `cd web && npx tsc --noEmit` — expected: zero TypeScript errors

**Manual checks:**
- Click "+": modal opens, input autofocuses
- Type "screen door" (3+ chars): spinner then results appear after 400ms
- Select a result: confirmation card pre-filled; venue type, price match Yelp data
- Edit status to "Been There", click Save: row appears on map with green pin
- Click overlay backdrop: modal closes, no restaurant added

## Suggested Review Order

**Entry point — save action (server boundary)**

- Server Action: auth guard + DB insert; the trust boundary for all saves
  [`actions.ts:21`](../../web/src/app/actions.ts#L21)

**Modal state machine**

- Top-level modal: panel state machine, overlay, Escape handler, sequence-guarded search
  [`AddRestaurantModal.tsx:62`](../../web/src/components/AddRestaurantModal.tsx#L62)

- `runSearch`: debounce, sequence guard against stale responses, error logging
  [`AddRestaurantModal.tsx:90`](../../web/src/components/AddRestaurantModal.tsx#L90)

- `selectResult`: lat/lng guard, venueType camelCase→snake_case mapping, state init
  [`AddRestaurantModal.tsx:120`](../../web/src/components/AddRestaurantModal.tsx#L120)

- `handleSave`: calls Server Action, error logging, save error state
  [`AddRestaurantModal.tsx:133`](../../web/src/components/AddRestaurantModal.tsx#L133)

**Search panel UI**

- `SearchPanel`: spinner (Tailwind animate-spin), empty state, result rows
  [`AddRestaurantModal.tsx:170`](../../web/src/components/AddRestaurantModal.tsx#L170)

- `SearchResultRow`: disabled + greyed when no coordinates, composite key
  [`AddRestaurantModal.tsx:224`](../../web/src/components/AddRestaurantModal.tsx#L224)

**Confirm panel UI**

- `ConfirmPanel`: Back button with text, "Add Restaurant" title, pill selectors
  [`AddRestaurantModal.tsx:259`](../../web/src/components/AddRestaurantModal.tsx#L259)

**HomeView wiring**

- "+" button and modal mount; close-first then refresh ordering
  [`HomeView.tsx:155`](../../web/src/components/HomeView.tsx#L155)

**Types**

- `venueTypeToDB`: exhaustive mapping with safe fallback to null
  [`AddRestaurantModal.tsx:34`](../../web/src/components/AddRestaurantModal.tsx#L34)

- `SaveRestaurantData` type — shape contract between modal and Server Action
  [`actions.ts:10`](../../web/src/app/actions.ts#L10)
