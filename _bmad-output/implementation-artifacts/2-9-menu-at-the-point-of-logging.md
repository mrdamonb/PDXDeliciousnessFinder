---
baseline_commit: 99bed0eea37e558a47db9de9ed5e4ef35abd3e12
---

# Story 2.9: Menu at the Point of Logging

**Epic:** 2 — Your Portland Food Journal
**Status:** ✅ Done — implemented, reviewed, 11 patches applied, both builds green, **verified on device by Damon 2026-09-02**.
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

---

## Dev Notes

**Implemented 2026-09-02** via `bmad-dev-story`.

### Step 0 — schema gate

`alter table restaurants add column if not exists menu_url text;` run against the linked `pdx-deliciousness-dev` project via `npx supabase db query --linked` (CLI authenticated interactively by Damon mid-session). Confirmed present via `information_schema.columns`.

### iOS — the four-place column landing, plus the shared form

All four locations named in Technical Notes were updated: `Restaurant.swift` (property + init param), `RestaurantDTO.swift` (property, `CodingKeys`, encode, decode, both `init(from:)` and `toModel()`), `RestaurantRepository.applyDTO`, and `RealtimeSubscriptions.applyDTO`.

`SafariView.swift` added to `UI/Components/` as a thin `UIViewControllerRepresentable` around `SFSafariViewController`. `AddVisitView` resolves `menuURL` once (`restaurant.menuUrl ?? restaurant.website`, guarded through `URL(string:)`) and renders a "View Menu" button in the Visit Details section only when it resolves to a non-nil `URL`; tapping it presents `SafariView` as a `.sheet` from within the form, so the form's `@State` (date, note) survives the round trip.

The Menu URL field beside Website is **not only** in `EditRestaurantView.swift` as the Technical Notes table implied — that view renders the shared `RestaurantFormView` (defined in `AddRestaurantView.swift`) backed by `AddRestaurantViewModel`, so the field and its plumbing went into all three: viewmodel field, form `TextField`, and `EditRestaurantView`'s init (seeds from `restaurant.menuUrl`) and save (`restaurant.menuUrl = viewModel.menuUrl.isEmpty ? nil : viewModel.menuUrl`). This also means Add Restaurant gets the field for free, which is consistent with the rest of that form (Website, cuisine, etc. are all shared).

Validated with `xcodebuild -scheme PDXDeliciousnessFinder -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` — **BUILD SUCCEEDED**, zero errors. This is a real compile, not `swiftc -parse`.

### Web

`Restaurant` type + `getRestaurants` select in `restaurants.ts`, `UpdateRestaurantData` in `actions.ts`, a "Menu URL (optional)" field in `EditRestaurantModal.tsx` beside Website, and a "View menu" link in `RestaurantPanel.tsx`'s inline log-visit form (same `menu_url ?? website` fallback, opens in a new tab — no state to preserve on web). `npx tsc --noEmit` and `npm run build` both clean.

### Not verified this session

No physical device or simulator run was performed — the four on-device checks in Verification (add a menu URL and confirm persistence across reinstall, open Add Visit and confirm note/date survive the Safari round trip, website-only fallback, no-URL restaurant hides the button, cross-device sync) still need a hands-on pass. The Open Question about `website` population rate is also still unanswered.

## File List

- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Models/Restaurant.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Network/DTOs/RestaurantDTO.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Storage/Repositories/RestaurantRepository.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Sync/RealtimeSubscriptions.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/UI/Components/SafariView.swift` (new)
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/AddVisitView.swift`
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/AddRestaurantView.swift` (shared `RestaurantFormView`, not in original file table)
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/AddRestaurantViewModel.swift` (not in original file table)
- `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Features/RestaurantDetail/EditRestaurantView.swift`
- `web/src/lib/supabase/restaurants.ts`
- `web/src/app/actions.ts` (not in original file table — `UpdateRestaurantData` lives here, not in `restaurants.ts`)
- `web/src/components/EditRestaurantModal.tsx`
- `web/src/components/RestaurantPanel.tsx`

## Change Log

| Date | Change |
|---|---|
| 2026-09-01 | Story written, ready for dev — gated on schema step |
| 2026-09-02 | Schema gate cleared: `menu_url` column added to `pdx-deliciousness-dev` |
| 2026-09-02 | Implemented via `bmad-dev-story` — iOS (model/DTO/repo/realtime/SafariView/AddVisitView/shared form) + web (type/select/modal/panel); iOS build and web build/typecheck verified; on-device checks still outstanding |

---

## Review Findings

Code review 2026-09-02. Four layers: Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor. All four returned; none failed. Severities set by the parent after reading the code and **running** the decoder and URL claims, not from the diff hunks.

**The story's own hard parts were done right.** All four Swift landing sites present including the two flagged as likely misses (`RestaurantRepository:112`, `RealtimeSubscriptions:206`), ARCH-11 `CodingKeys` explicit, `SafariView` in `UI/Components/` per ARCH-12, save routed through the repository per ARCH-9, and the `URL(string: "https://example.com")!` anti-pattern in `RestaurantDetailView` correctly not copied. The deviation to the shared `RestaurantFormView` was **correct** — `EditRestaurantView` renders that shared form, so the original file table was wrong, not the implementation.

- [x] [Review][Decision] **RESOLVED 2026-09-02 — option (a): on web, render "View menu" only when `menu_url` is actually set.** Damon's call. Becomes a patch. **This deliberately narrows the web fallback**: when only `website` exists, the panel's existing Website row is the fallback, so the user still has exactly one link to that URL and never two. The iOS fallback is unchanged, because there the Add Visit sheet covers the detail view and its website link is unreachable. Original finding: **On web, two links to the same URL are visible at once** — `RestaurantPanel.tsx:49` resolves `menu_url || website`, and when `menu_url` is null the new "View menu" link in the log form and the existing Website row (`:350-369`) render in the same expanded panel with identical `href`s and the same Globe icon. The AC says "a **single** 'View menu' action — never two competing links", but that AC is scoped to the iOS Add Visit sheet, and Out of Scope forbids changing the panel's existing website link. **Genuine spec conflict, needs your call.** Options: (a) hide the new link when it would duplicate the website, (b) hide the Website row while the log form is open, (c) accept both — the labels differ and the duplication only occurs in the fallback case. Sources: blind-hunter+acceptance-auditor.

- [ ] [Review][Patch] **A URL without a scheme reaches `SFSafariViewController`, which requires http/https** [Features/RestaurantDetail/AddVisitView.swift:21] — the guard rejects only `nil`. **Verified by running it:** `URL(string: "nongs.com/menu")` returns non-nil with `scheme == nil`, and `URL(string: "  ")` **also returns non-nil**. Typing a bare domain is the single most likely input for a field whose whole premise is "paste once and never revisit". The story's Technical Notes explicitly required "must hide the button, not crash". Fix: normalize on write and validate the scheme on read. **high**
- [ ] [Review][Patch] **iOS never trims the menu URL; web does** [Features/RestaurantDetail/AddRestaurantViewModel.swift:105, Features/RestaurantDetail/EditRestaurantView.swift:67] — both store `menuUrl.isEmpty ? nil : menuUrl` with no trim, while web saves `form.menu_url.trim() || null`. A whitespace-only paste persists `"  "`, which is non-nil so the `??` never falls through to `website` — **the button disappears for a restaurant that has a perfectly good website**, violating the fallback AC. Contrast `cuisine` at `AddRestaurantViewModel.swift:107`, which is trimmed. **medium**
- [ ] [Review][Patch] **iOS and web resolve the fallback by different rules** [Features/RestaurantDetail/AddVisitView.swift:23] — Swift's `??` coalesces only `nil`; JS's `||` also coalesces `''`. An empty-string `menu_url` written by any other path hides the action on iOS and falls back correctly on web. Write both to the same rule. **medium**
- [ ] [Review][Patch] **The web `href` is unvalidated, so a schemeless value navigates inside the app** [web/src/components/RestaurantPanel.tsx:442] — `href="nongs.com/menu"` resolves relative to the app origin and lands on a 404 **inside the app, losing the half-typed visit note** — the exact failure this story exists to prevent. A `javascript:` or `data:` value stored in the column would also be rendered unguarded. **medium**
- [ ] [Review][Patch] **The `menu_url` column exists only as an ad-hoc remote `ALTER`** — there is **no `migrations/` directory and no `.sql` file anywhere in the repo**, verified by `find`. `supabase/functions/` is tracked but schema is not. Blast radius on any project lacking the column is total, not cosmetic: `getRestaurants` names `menu_url` in its select (`restaurants.ts:24`) so PostgREST rejects the whole query and **the map and list render nothing**; on iOS the upsert 400s, `SyncQueue` retries three times and then **deletes the operation** (`SyncQueue.swift:109-115`), silently discarding the write. All three builds stay green throughout. Fix: check in `supabase/migrations/<ts>_add_restaurants_menu_url.sql`. **medium** **high** blast radius
- [ ] [Review][Patch] **`SafariView` has no delegate, so Safari's own Done button can strand the binding** [UI/Components/SafariView.swift:5] — `SFSafariViewController` dismisses itself outside SwiftUI's binding lifecycle; with no `SFSafariViewControllerDelegate` clearing `isShowingMenu`, the second tap on "View Menu" can do nothing. The story's manual check ("tap View menu, dismiss, note survives") passes on the first tap and never catches this. **medium**
- [ ] [Review][Patch] **The `.sheet` is anchored to a conditionally-rendered row inside a `Form` Section** [Features/RestaurantDetail/AddVisitView.swift:37] — the least robust place to hang a presentation. `Restaurant` is an observed `@Model`, so an inbound update clearing both URLs removes the presenting view while Safari is open. Move it to the `Form`/`NavigationStack` and prefer `.sheet(item:)` over a separate `Bool`. **low**
- [ ] [Review][Patch] **The button label deviates from the AC and from web** [Features/RestaurantDetail/AddVisitView.swift:34] — iOS renders "View Menu", web renders "View menu", the AC quotes "View menu" in all five occurrences. **low**
- [ ] [Review][Patch] **The web input lacks the affordances the iOS field got** [web/src/components/EditRestaurantModal.tsx:252] — no `type="url"`, `inputMode="url"`, `autoComplete="url"`, `spellCheck={false}` or `autoCapitalize="none"`, so mobile Safari will capitalise a typed URL. Conversely iOS gave the new field `.textContentType(.URL)` while the adjacent Website field still lacks it — the two now differ for no stated reason. **low**
- [ ] [Review][Patch] **The web link has no new-tab affordance for assistive tech** [web/src/components/RestaurantPanel.tsx:440] — opens in a new tab with no `aria-label` or visually-hidden text saying so, and the `Globe` icon is not `aria-hidden`. **low**
- [ ] [Review][Patch] **The doc comment on `menuURL` is wrong** [Features/RestaurantDetail/AddVisitView.swift:20] — says "Resolved once", but it is a computed property re-evaluated on every `body` pass. **low**

- [x] [Review][Defer] **Inbound realtime sync cannot decode anything, for either table** [Core/Sync/RealtimeSubscriptions.swift:224] — deferred, **pre-existing and larger than this story**. `realtimeDecoder` sets `keyDecodingStrategy = .convertFromSnakeCase`, while `RestaurantDTO` and `VisitLogDTO` both declare **explicit** snake_case `CodingKeys`. The strategy rewrites the incoming key `user_id` to `userId`, which then matches no `CodingKey` whose `stringValue` is `"user_id"`. **Reproduced directly:** `DecodingError.keyNotFound: Key 'user_id' not found`; the same payload decodes fine with no key strategy. Every realtime event throws into the empty `catch { // Non-fatal }` at `:102` and `:165`. **This makes the new `model.menuUrl = dto.menuUrl` at `:206` unreachable** — one of the four landing sites this story insisted on. `pullFromRemote` is unaffected (it passes no custom decoder), which is exactly why cross-device checks still appear to pass: the value arrives on the next pull, masking a dead realtime path. Epic 1 story 1.4 "Realtime Inbound Sync (Multi-Device)" is marked `done` and does not work. **Fold into story 1.5.**
- [x] [Review][Defer] **Clearing a menu URL on iOS never reaches the server** [Core/Network/DTOs/RestaurantDTO.swift:68] — deferred, pre-existing pattern. `encodeIfPresent` omits the key when the value is nil, and `SyncQueue` pushes that DTO as `upsert(dto, onConflict: "id")`, so `ON CONFLICT DO UPDATE` never touches the column and the old value survives — then comes back down on the next pull. Web sends an explicit `null` and does not have this asymmetry. Affects `website`, `cuisine`, `general_note` and every other optional column equally; this story is simply the first to ship a field designed to be edited and re-edited.
- [x] [Review][Defer] **The menu URL is invisible on both detail surfaces** [Features/RestaurantDetail/RestaurantDetailView.swift:112] — deferred, out of scope by the story's own boundary ("no change to the existing website link on the detail view or the panel"). A restaurant with a menu URL and no website shows no link anywhere except inside Add Visit, so there is no way to confirm what was saved short of reopening Edit.
- [x] [Review][Defer] **Web create and import paths omit `menu_url`** [web/src/app/actions.ts:135] — deferred, consistent with existing behaviour. `saveRestaurant`, `AddRestaurantModal` and `ImportModal` already omit `website` too, so this is the pre-existing create-path gap widening by one field rather than a non-adoption of this change. iOS Add Restaurant now sets a menu URL; web cannot.
- [x] [Review][Defer] **SwiftData lightweight migration never exercised against an existing store** — deferred. `PersistenceController` builds a plain `Schema` with no `VersionedSchema`/`SchemaMigrationPlan` and `fatalError`s on container failure. A new optional attribute is the canonical lightweight-migration case and should be fine, but the failure mode is a hard crash at launch for every device with a pre-existing store. **Fold into the device pass: launch over an existing install, not a clean one.**

**Dismissed as noise (2):** story status "Review" outrunning the unchecked device items — self-disclosed in the Dev Notes and a device pass is imminent; and `SafariView` shipping without `entersReaderIfAvailable`/tint/preview — a preference, not a defect.

---

## Review Patches Applied, 2026-09-02

All 11 patch findings applied. Both builds re-verified afterwards: iOS `xcodebuild` **BUILD SUCCEEDED**, web `npx tsc --noEmit` clean and `npm run build` compiled.

### New shared pieces

**`Core/WebURL.swift`** and **`web/src/lib/url.ts`** — one normalization rule per platform, written to behave identically. Trim, add `https://` when no scheme is present, reject anything that is not an http(s) address with a dotted host. Used on **write** so stored values are already complete, and on **read** so values saved before this existed still resolve.

**A bug in the first version of this patch, caught by testing it rather than reading it:** the initial scheme check was `contains("://")`, which `mailto:a@b.com` does not contain — so it became `https://mailto:a@b.com`, which parses as host `b.com` and would have silently opened the wrong site. A later round caught `tel:5035551234` resolving to host `tel`. The final rule checks for an actual scheme, treats a colon as a port separator only when digits follow, and requires a dot in the host.

Verified behaviour, both platforms agreeing:

| Input | Result |
|---|---|
| `https://nongs.com/menu` | unchanged |
| `nongs.com/menu` | `https://nongs.com/menu` |
| `www.nongs.com` | `https://www.nongs.com` |
| `" https://x.com/menu "` | trimmed |
| `nongs.com:8080/menu` | port preserved |
| `"  "` / `""` / null | hidden |
| `mailto:` / `javascript:` / `tel:` / `ftp://` | hidden |

**`SafariView`** gained an `SFSafariViewControllerDelegate` coordinator and an `onFinish` callback, so Safari's own Done button clears the presentation state. Presentation moved from `.sheet(isPresented:)` on a conditional row inside a `Form` section to `.sheet(item:)` anchored on the `Form`.

### Fixes by finding

| Finding | Fix |
|---|---|
| Schemeless URL reaching `SFSafariViewController` | `WebURL.url` on read; normalization on write |
| iOS never trimmed | `WebURL.normalized` in both save paths |
| iOS and web fallback rules differed | Both resolve each candidate independently, so a bad menu URL now falls through to the website instead of suppressing the action |
| Web `href` unvalidated | `normalizeWebUrl` before render |
| Two links on web | Decision (a): `menu_url` only; the Website row is the fallback |
| No checked-in migration | `supabase/migrations/20260902000000_add_restaurants_menu_url.sql` |
| Safari Done stranding the binding | Delegate coordinator |
| Fragile sheet anchor | `.sheet(item:)` on the `Form` |
| Label mismatch | iOS now reads "View menu" |
| Web input affordances | `type`, `inputMode`, `autoComplete`, `autoCapitalize`, `spellCheck`; `aria-label` and `aria-hidden` on the link; `.textContentType(.URL)` added to the iOS Website field so it matches Menu URL |
| Wrong doc comment | Rewritten |

### Still outstanding — your hands

The five on-device checks from Verification. **Add one to the list because of the deferred SwiftData finding: launch over an existing install rather than a clean one**, since this is the first new column since the schema was created. And the Open Question — how many restaurants actually have `website` populated — is still unanswered.

---

## Device Verification, 2026-09-02

Damon ran the app on his phone: *"It looks good and seems to work as intended."* Story accepted and closed.

**Recorded honestly:** that was a general pass, not a line-by-line walk of the Verification list. The happy path — save a menu URL, open Add Visit, tap through to the menu, come back with the note intact — is confirmed. The conditional branches were not specifically exercised, and are the kind ordinary use does not reach:

- a restaurant with a website but **no** menu URL, confirming the fallback still shows the button
- a restaurant with **neither**, confirming the button is absent rather than dead
- tapping View menu, closing with Safari's own **Done** button, and reopening — the delegate fix

None of these block the story. Noted here so a future reader knows which claims rest on a targeted check and which rest on general use.

**The SwiftData migration is implicitly confirmed.** `PersistenceController` calls `fatalError` when the container fails to open, so an install over the existing app that launches at all has migrated the new `menu_url` column successfully. This only holds if the app was not deleted first.
