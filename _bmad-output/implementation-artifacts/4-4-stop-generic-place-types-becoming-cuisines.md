# Story 4.4: Stop Generic Place Types Becoming Cuisines

**Epic:** 4 — Add Restaurants Instantly
**Status:** 🔲 Backlog — **not scheduled into Sprint 3**
**Effort:** Small (one function, currently duplicated in two files)
**Found:** 2026-09-01, reviewing the Google Places migration (`ca7df26`)

---

## User Story

As a Portland food enthusiast,
I want the cuisine filter to contain actual cuisines,
So that filtering by cuisine narrows my list instead of offering me "Restaurant" as a choice.

---

## The Defect

`extractCuisine` strips a trailing venue word from `primaryTypeDisplayName`, but the regex requires **leading whitespace**:

```js
display.replace(/\s+(Restaurant|Bar|Cafe|Café|Brewery)$/i, "").trim() || null
```

So a two-word name is handled and a **bare** generic is not — it falls through and is stored verbatim as the cuisine.

Verified 2026-09-01 by running the actual expression:

| Input | Output | |
|---|---|---|
| `Thai Restaurant` | `Thai` | correct |
| `Mexican Restaurant` | `Mexican` | correct |
| `Pizza Restaurant` | `Pizza` | correct |
| `Restaurant` | `Restaurant` | **wrong** |
| `Bar` | `Bar` | **wrong** |
| `Brewery` | `Brewery` | **wrong** |
| `Cafe` | `Cafe` | **wrong** |
| `Coffee Shop` | `Coffee Shop` | **wrong** — a venue kind, not a cuisine |
| `Wine Bar` | `Wine` | **wrong** — `venueType` already carries "bar" |

**This is a bug, not a judgement call, and the file says so itself.** The fallback path already filters candidate types through a `genericTypes` set so that generics never become cuisines. The primary path simply never applies that same intent.

### Why it matters

`cuisine` feeds the cuisine filter facet on both surfaces — `getFilterOptions` on web builds the dropdown from distinct stored values, and iOS `FilterBarView` does the equivalent. So every plain restaurant added since the migration contributes a "Restaurant" entry to the list of cuisines you can filter by, which is both noise and a filter that cannot usefully narrow anything.

---

## Acceptance Criteria

**Given** Google returns a display name that is only a venue category
**When** the place is enriched
**Then** `cuisine` is `null` — not the category string

---

**Given** Google returns a cuisine-qualified display name such as "Thai Restaurant"
**When** the place is enriched
**Then** `cuisine` is "Thai", exactly as today — **this story must not regress the working case**

---

**Given** a display name like "Wine Bar" or "Coffee Shop", which names a venue kind rather than a cuisine
**When** the place is enriched
**Then** `cuisine` is `null`, and the venue character is carried by `venueType` as it already is

---

**Given** the cuisine filter on either surface
**When** I open it
**Then** "Restaurant", "Bar", "Brewery", "Cafe" and "Coffee Shop" are not offered as cuisines

---

**Given** the two Edge Functions
**When** the fix lands
**Then** the rule exists in **one** place — today `extractCuisine` and `genericTypes` are copy-pasted into both files and will otherwise drift

---

## Technical Notes

### The fix

Apply the existing generic check to the primary path as well as the fallback. After stripping, test the result against the same generic vocabulary (case-insensitively) and return `null` on a hit, rather than trusting that a trailing-word strip was enough.

The `genericTypes` set is currently in Google's `snake_case` type vocabulary (`food_court`, `meal_takeaway`), while `primaryTypeDisplayName` is human text ("Coffee Shop"). These are two different vocabularies — the fix needs a display-text generic list, not a reuse of the type list, or a normalization step between them. **Do not simply pass the display string into the existing set and assume it works.**

### Deduplicate

`extractCuisine`, `genericTypes`, `mapGoogleTypesToVenueType`, `mapPriceLevel` and the `GooglePlace` interface are all duplicated verbatim across `search-places/index.ts` and `enrich-restaurant/index.ts`. Supabase Edge Functions support a shared `_shared/` directory. Lifting these into one module is the substance of the last AC — otherwise the next fix has to be made twice, which is how this class of bug survives.

### Existing data

New enrichments are fixed by the code change; **rows already saved keep their bad cuisine value.** Decide explicitly whether to leave them (they are visible and hand-editable in Edit Restaurant) or to clear them with a one-off update:

```sql
update restaurants set cuisine = null
where cuisine in ('Restaurant','Bar','Brewery','Cafe','Café','Coffee Shop');
```

Damon's call. Leaving them is defensible — this is a personal list and the values are editable in the UI.

---

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/search-places/index.ts` | Fix `extractCuisine`; move shared helpers out |
| `supabase/functions/enrich-restaurant/index.ts` | Same fix; import the shared helpers |
| `supabase/functions/_shared/places.ts` | **New** — `GooglePlace`, `extractCuisine`, `mapGoogleTypesToVenueType`, `mapPriceLevel`, generic vocabularies |

No client changes. No schema changes.

---

## Out of Scope

- Any change to `venueType` or `priceRange` mapping — both are correct
- Building a curated cuisine taxonomy. Returning `null` for a generic is the whole fix; inventing a cuisine where Google gives none is a different, larger idea
- Backfilling existing rows, unless Damon asks — see above

---

## Verification

- Unit-check the expression against the table above; the four correct rows must stay correct
- Add a place whose Google primary type is plain `restaurant` → `cuisine` is null, not "Restaurant"
- Add a place with a real cuisine → cuisine still populates
- Open the cuisine filter on both surfaces → no venue categories listed among cuisines
