# Parity audit and divergence register

Re-verified 2026-09-06 by reading `web/src/` and the iOS sources directly. Supersedes the 2026-09-01 audit in `spec-wip.md`, which was written when 3.5, 2.8 and 2.9 were still pending on iOS and before 2.10 existed.

## Audit

| Capability | iOS | Web | S6 |
|---|---|---|---|
| Map with pins | ✅ | ✅ | — |
| Filters: status, venue, neighborhood, cuisine, price | ✅ | ✅ | — |
| List view | ✅ | ✅ | — |
| Sort A–Z / latest | ✅ | ✅ | see divergence 3 |
| Add restaurant via Places search | ✅ | ✅ | — |
| Edit and delete a restaurant | ✅ | ✅ | — |
| Log a visit, view a restaurant's visits | ✅ | ✅ | — |
| **Menu at the point of logging** | ✅ 2.9 | ✅ **already shipped** | **out — closed since the last audit**, see divergence 2 |
| **Search your own list** | ✅ 3.5, device-verified 2026-09-02 | ❌ | **CAP-1** |
| **Visit journal across all restaurants** | ✅ 2.7 | ❌ | **CAP-2** |
| **Add a visit from the journal** | ✅ 2.8, device-verified 2026-09-05 | ❌ | **CAP-3** |
| **Edit a visit** | ✅ 2.10 | ❌ | **CAP-4 — new, the S6 draft predates this story** |
| Bulk import | ❌ | ✅ | out — web-only by design, not a gap |
| Share extension / Web Share Target | ✅ | ❌ | out — on `deferred-work.md` |
| Offline queue, realtime sync | ✅ | ❌ | out — architectural; web is online-only |

### What changed since 2026-09-01

**One row left scope, one row entered.** The count stayed at four by coincidence, not because nothing moved.

- **Menu at the point of logging is done on web.** `RestaurantPanel.tsx:444` renders the "View menu" link inside the inline log form, `EditRestaurantModal.tsx:260` has the Menu URL field, and `restaurants.ts:16` carries `menu_url`. The old audit marked this a gap.
- **Edit a visit is new.** iOS story 2.10 was written 2026-09-06, five days after the S6 draft, so it appears in no earlier audit. Web `actions.ts` has `getVisitLogs` and `logVisit` and no update path at all.

## Divergence register

**1. Visit logging auto-promotes status on web, not on iOS.** `actions.ts:227` flips `want_to_go` → `been_there` unconditionally. Web is the correct behaviour and iOS 2.8 adopted it. **Closed in iOS's favour moving toward web. Do not change the web side.**

**2. The menu link falls back to `website` on iOS and does not on web.** iOS `AddVisitView.swift:73` uses `WebURL.url(restaurant.menuUrl) ?? WebURL.url(restaurant.website)`. Web renders the link only for a genuine `menu_url` (`RestaurantPanel.tsx:53`), because the panel's existing Website row would otherwise put two identical links on screen at once. **Deliberate, decided in the web code review of 2026-09-02 (decision a), and preserved.** A future session should not read this as an oversight and "fix" it.

**3. "Latest" sorts by different columns.** iOS by `updatedAt`, web by `created_at`, identical labels, different questions. **Open** — the 2026-09-01 draft proposed `created_at` on both, but that was a draft proposal and was never approved.

## Traps carried over from the iOS implementations

These cost real time on iOS and the same shapes exist on web.

- **The journal must filter unrenderable entries before grouping**, or a month header renders with nothing under it. This was an explicit acceptance criterion on iOS 3.5 and the review caught it violated anyway.
- **Search state must be cleared deliberately when leaving the surface.** On iOS, opening a restaurant wiped the query on one tab and not the other because of where `.onDisappear` sat relative to the navigation stack. Same class of bug, different mechanism, on a route-vs-toggle decision.
- **A URL string is not validated by parsing it.** `URL(string:)` accepted `nongs.com/menu` and a string of spaces on iOS; the first fix then mangled `mailto:` and `tel:`. Web's `normalizeWebUrl` already exists — reuse it rather than writing a second rule.
