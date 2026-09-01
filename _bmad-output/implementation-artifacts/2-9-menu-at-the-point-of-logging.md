# Story 2.9: Menu at the Point of Logging

**Epic:** 2 — Your Portland Food Journal
**Status:** 🔲 Ready for Dev — **gated on the schema step below**
**Effort:** Small (one new column, one new button, one new field, one small wrapper)
**Depends on:** nothing. Independent of 3.5 and 2.8; ship it first.

---

## User Story

As a Portland food enthusiast,
I want the restaurant's menu reachable from inside the Add Visit sheet,
So that I can check what a dish was called without abandoning the note I am part-way through typing.

---

## Context

This story fixes a **placement** problem, not a missing-data problem.

The website is already stored (`restaurants.website`), already pulled from Google Places (`websiteUri` is in the FieldMask on both Edge Functions), already on the SwiftData model, the DTO, and the web type — and already displayed as a link on `RestaurantDetailView:112` and `RestaurantPanel:349`.

But while logging a visit you are inside the **Add Visit sheet**, and that link is on the screen *underneath* it. So the real sequence today is: dismiss the sheet, tap the link, leave for Safari, hunt for the menu, copy, come back, reopen Add Visit, re-set the date, paste. Damon described exactly this, and it is why "what I ate" gets typed from memory instead.

**A schema change was considered and rejected.** Structured dish logging — a `dishes` array or a `visit_dishes` table with per-dish ratings — solves a problem Damon does not have. The free-text `note` stays as it is.

---

## Acceptance Criteria

**Given** I am in the Add Visit sheet for a restaurant that has a menu URL or a website
**When** I look at the sheet
**Then** I see a **single** "View menu" action — never two competing links

---

**Given** I tap "View menu"
**When** the browser opens
**Then** it opens **in-app, layered over the sheet**, and when I dismiss it my part-typed note and my chosen date are exactly as I left them

---

**Given** a restaurant has a `menu_url` saved
**When** I tap "View menu"
**Then** it opens the menu URL

---

**Given** a restaurant has a website but no menu URL
**When** I tap "View menu"
**Then** it falls back to the website

---

**Given** a restaurant has neither a menu URL nor a website
**When** the sheet renders
**Then** the action is hidden entirely — no disabled control, no dead tap

---

**Given** I am editing a restaurant
**When** I look at the form
**Then** there is a Menu URL field beside Website that I can paste into once and never revisit

---

**Given** I save a menu URL on one device
**When** sync completes
**Then** it appears on my other devices and in the web app

---

## Technical Notes

### Step 0 — the schema gate. Do this before writing code.

There is **no local migrations directory**; schema lives in the remote Supabase project. Run against remote:

```sql
alter table restaurants add column menu_url text;
```

### The column must land in four Swift places, not two

All four located 2026-09-01. Missing the last two is the likely bug: the value would save and then silently never come back down.

| File | Change |
|---|---|
| `Core/Storage/Models/Restaurant.swift` | `var menuUrl: String?` + init parameter |
| `Core/Network/DTOs/RestaurantDTO.swift` | property, **explicit `CodingKeys` entry** `case menuUrl = "menu_url"` (ARCH-11), encode, decode, and the model→DTO init |
| `Core/Storage/Repositories/RestaurantRepository.swift:111` | `model.menuUrl = dto.menuUrl` in the DTO→model mapping |
| `Core/Sync/RealtimeSubscriptions.swift:205` | same mapping — this is the inbound realtime path |

### In-app browser: there is no wrapper yet

Grepped 2026-09-01: no `SFSafariViewController`, no `SafariServices`, no `WKWebView` anywhere in the app. A small `UIViewControllerRepresentable` wrapper is needed.

Put it in `UI/Components/` alongside `StatusBadgeView` and friends, as `SafariView.swift`. Present it with `.sheet` **from within `AddVisitView`**, so it layers over the form and the form's `@State` survives — that is the entire point of the story. A plain `Link` or `openURL` would leave the app and is not acceptable here.

Guard the URL: `menuUrl ?? website` may be a non-empty string that is not a valid URL. `URL(string:)` returning nil must hide the button, not crash or open `example.com` — note that `RestaurantDetailView:114` currently falls back to `URL(string: "https://example.com")!`, which is a latent oddity; do not copy that pattern.

### One button, resolved once

```swift
private var menuURL: URL? {
    let raw = restaurant.menuUrl ?? restaurant.website
    guard let raw, !raw.isEmpty else { return nil }
    return URL(string: raw)
}
```

Render the action only when `menuURL != nil`. The user never chooses between menu and website — the fallback is invisible to them.

### Web side, same sprint

Doing only iOS leaves a column one client writes and the other ignores, which is how the two apps start disagreeing about a restaurant. Web needs `menu_url` in the `Restaurant` type and select (`lib/supabase/restaurants.ts`), a field in `EditRestaurantModal.tsx`, and the button in the log-visit UI in `RestaurantPanel.tsx`. On web it opens in a new tab; there is no state to lose.

### Architecture constraints (non-negotiable)

| Constraint | Requirement |
|---|---|
| ARCH-9 | The menu URL saves through `RestaurantRepository` → `SyncQueue`. No direct `supabase.from()` |
| ARCH-11 | Explicit `CodingKeys` for `menuUrl` ↔ `menu_url`. Synthesized Codable is `@MainActor`-isolated and breaks PostgREST's Sendable constraint |
| ARCH-12 | `SafariView.swift` goes in `UI/Components/`, not in `Features/` |

---

## Files to Create

| File | Purpose |
|---|---|
| `UI/Components/SafariView.swift` | `UIViewControllerRepresentable` wrapper around `SFSafariViewController` |

## Files to Modify

| File | Change |
|---|---|
| `Core/Storage/Models/Restaurant.swift` | `menuUrl` property + init |
| `Core/Network/DTOs/RestaurantDTO.swift` | property, `CodingKeys`, encode, decode, model init |
| `Core/Storage/Repositories/RestaurantRepository.swift` | DTO→model mapping (line ~111) |
| `Core/Sync/RealtimeSubscriptions.swift` | DTO→model mapping (line ~205) |
| `Features/RestaurantDetail/AddVisitView.swift` | "View menu" action + `SafariView` sheet |
| `Features/RestaurantDetail/EditRestaurantView.swift` | Menu URL field |
| `web/src/lib/supabase/restaurants.ts` | `menu_url` on the type and the select |
| `web/src/components/EditRestaurantModal.tsx` | Menu URL field |
| `web/src/components/RestaurantPanel.tsx` | "View menu" action in the log-visit UI |

---

## Out of Scope

- Any structured dish logging — `dishes` arrays, a `visit_dishes` table, per-dish ratings. Considered and rejected
- Auto-discovering the menu URL. Google Places returns the homepage; there is no reliable menu field, and scraping restaurant sites for a `/menu` path is fragile
- Changing the existing website link on the detail view or the panel. It stays exactly as it is
- Photo or voice capture of dishes

---

## Verification

- Run the `alter table` first; confirm the column exists before building
- Add a menu URL via Edit → force-quit → reopen → value persisted
- Open Add Visit, type half a note, tap "View menu", dismiss → **note and date still there**
- A restaurant with only a website → button appears, opens the homepage
- A restaurant with neither → no button at all
- Save a menu URL on iOS → confirm it appears in the web app
- `cd web && npm run build` and `npx tsc --noEmit` — zero errors

---

## Open Question

**How many restaurants actually have `website` populated?** Unverified as of 2026-09-01. The payoff of this story scales directly with that number, and rows added by hand or before the Google Places migration may be null. Worth a look at the data before assuming the fallback path is rare.
