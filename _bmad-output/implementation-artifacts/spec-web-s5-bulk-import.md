---
title: 'PDX Deliciousness Finder — Web App: Bulk Import + Empty State'
type: 'feature'
created: '2026-04-30'
status: 'approved'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** New users face a blank map with no guidance, and users migrating from Google Maps / Notes / Sheets have to add restaurants one at a time.

**Approach:** Two additions:

1. **Empty state** — when a user has zero restaurants, show a centered card on the map with two CTAs: "Add your first place" (opens the existing AddRestaurantModal) and "Import a list" (opens the new import flow).
2. **Bulk import** — two input modes feeding one shared pipeline:
   - **Paste mode** (primary): textarea, one restaurant name per line. Universal — works for Notes, Sheets, anything.
   - **File upload mode** (secondary, ships second): Google Takeout JSON or Google Maps CSV. For technical users who have a structured export.

**Pipeline (both modes):**
1. Parse input → array of `{ name, address?, latitude?, longitude? }`
2. For each entry: case-insensitive name lookup against the existing `restaurants` table (`lower(name) = lower($1)`). If address/coords available, also check proximity (within ~100m) for higher confidence.
3. **Database hit** → pre-fill `venue_type`, `cuisine`, `price_range`, `website` from the matched row. Zero Yelp API calls.
4. **No match** → call `search-places` edge function (Yelp) for enrichment.
5. Show **three-bucket preview** before any inserts:
   - ✅ *Matched in database* — name + pre-filled details
   - 🔍 *Will search Yelp* — name only, API call queued on confirm
   - ⚠️ *Skipped* — blank/unreadable lines
6. User confirms → bulk insert all non-skipped rows; all default to `status = 'want_to_go'`.

**UI placement:**
- Import entry point: **UserMenu** — "Import restaurants" item above "Sign out".
- New users with zero restaurants also see the **empty state card** on the map with an "Import a list" button.

## Build Order

**Phase 1 (ship first):** Paste mode + empty state + UserMenu entry point.
**Phase 2 (ship second):** File upload mode (Takeout JSON + Google Maps CSV parser). Same pipeline from parse step onward.

## Boundaries & Constraints

**Always:**
- Database lookup before any Yelp call — every import row checks the DB first.
- Matching is exact case-insensitive name only for paste mode (`lower(name) = lower($1)`). No fuzzy matching — false positives are worse than blanks.
- All imported restaurants default to `status = 'want_to_go'`.
- Show the preview screen before any insert or Yelp call — user must confirm.
- Yelp calls for unmatched rows happen after the user confirms, not during preview load.
- Import is per-user — inserts go to the authenticated user's account only, same as single-add.

**Ask First:**
- Fuzzy name matching.
- Allowing user to set status per-row during import (post-MVP).
- Editing imported rows before confirming.
- File upload mode (Phase 2) — get sign-off before starting.

**Never:**
- Call Yelp in bulk before the user confirms — cost and latency.
- Import restaurants without coordinates (skip rows with no coords after DB lookup + Yelp fallback both fail to return a location).
- Touch the header layout.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| Paste empty textarea | Submit with blank input | Disable submit button — no-op |
| All names match DB | 10 names, all in DB | Preview: 10 ✅, 0 🔍, 0 ⚠️. No Yelp calls on confirm. |
| Mixed match | 5 matched, 3 unmatched, 2 blank lines | Preview: 5 ✅, 3 🔍, 2 ⚠️. 3 Yelp calls on confirm. |
| Yelp returns no result for a name | Unmatched name, Yelp 0 results | Row moves to ⚠️ Skipped on confirm; rest still import. |
| Yelp call fails | Network/API error mid-confirm | Show error for that row; import successful rows; report partial failure. |
| Duplicate — user already has that restaurant | Name matches a restaurant the user already owns | Still show as ✅ matched; insert proceeds (Supabase RLS/unique constraints will handle true dupes — don't over-engineer). |
| User has zero restaurants | Loads map view | Empty state card shown; disappears once they have ≥1 restaurant. |
| New user clicks "Import a list" in empty state | — | Opens import modal (same as UserMenu path). |

## Key Files

- `web/src/components/HomeView.tsx` — add empty state; wire UserMenu import entry point
- `web/src/components/UserMenu.tsx` — add "Import restaurants" menu item
- `web/src/components/ImportModal.tsx` — new component: paste textarea, file upload (Phase 2), preview screen
- `web/src/app/actions.ts` — add `bulkLookupRestaurants(names: string[])` server action for DB enrichment lookup; add `bulkSaveRestaurants(rows: ImportRow[])` server action
- `web/src/lib/importPipeline.ts` — shared parse + enrich logic (client-side orchestration)

## Verification

- `cd web && npm run build` — zero errors
- `cd web && npx tsc --noEmit` — zero TypeScript errors
- Manual: new account → empty state visible → "Import a list" opens modal
- Manual: paste 5 names (mix of known + unknown) → preview shows correct buckets → confirm → restaurants appear on map
- Manual: existing user → UserMenu → "Import restaurants" → same modal

</frozen-after-approval>

---

*Archived 2026-09-01. Shipped. The frozen block above is preserved exactly as approved on 2026-04-30 and deliberately not corrected: it names Yelp as the enrichment provider, which was true then. The provider became Google Places in commit `ca7df26`, and the pipeline shape it describes is otherwise unchanged.*
