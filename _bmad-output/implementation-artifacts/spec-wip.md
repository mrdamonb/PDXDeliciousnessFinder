---
title: 'PDX Deliciousness Finder — Web App S6: Parity with the iOS App'
type: 'feature'
created: '2026-09-01'
status: 'draft'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app is where Damon actually is when he is not on his phone, but it is missing the parts of the iOS app that make logging where he has been feel effortless. There is no journal of visits at all, no way to search his own list, and no menu within reach at the moment he is trying to remember what a dish was called.

**Approach:** Bring the web app level with iOS on the four things Sprint 3 adds there, reusing the shape settled on iOS first so the two surfaces do not diverge again.

## Parity audit — 2026-09-01

Verified by reading both codebases, not assumed.

| Capability | iOS | Web | S6 |
|---|---|---|---|
| Map with pins | ✅ | ✅ | — |
| Filters: status, venue, neighborhood, cuisine, price | ✅ | ✅ | — |
| List view | ✅ | ✅ | — |
| Sort A–Z / latest | ✅ | ✅ | see divergence 3 |
| Add restaurant via Places search | ✅ | ✅ | — |
| Edit and delete | ✅ | ✅ | — |
| Log a visit, view a restaurant's visits | ✅ | ✅ | — |
| **Visit journal across all restaurants** | ✅ 2.7 | ❌ | **in scope** |
| **Search your own list** | ⏳ 3.5 | ❌ | **in scope** |
| **Add a visit from the journal** | ⏳ 2.8 | ❌ | **in scope** |
| **Menu at the point of logging** | ⏳ 2.9 | ❌ | **in scope** |
| Bulk import | ❌ | ✅ | out — web-only by design, not a gap |
| Share extension / Web Share Target | ✅ | ❌ | out — already on `deferred-work.md` |
| Offline queue, realtime sync | ✅ | ❌ | out — architectural; web is online-only |

**Parity means the four rows marked in scope. It does not mean making the web app offline-capable, and it does not mean removing bulk import from web.**

## Divergences to close, not preserve

1. **Visit logging auto-promotes status on web, not on iOS.** `actions.ts logVisit` flips `want_to_go` → `been_there` unconditionally. iOS `AddVisitView` only does so when `markVisited: true`. The web behavior is the correct one; iOS story 2.8 adopts it. **Do not change the web side to match iOS.**
2. **`menu_url` must land on both surfaces in the same sprint.** A column that only one client writes is how the two apps start disagreeing about a restaurant.
3. **"Latest" sorts by different columns.** iOS sorts by `updatedAt`, web by `created_at`. Minor, but they answer different questions and the labels are identical. Pick `created_at` on both — "latest" reads as "recently added", not "recently touched".

## Build Order

**Phase 1:** Search (`/` list view + the panel) — mirrors iOS 3.5. Everything else reuses it.
**Phase 2:** History view — mirrors iOS 2.7. New route or view toggle alongside map/list.
**Phase 3:** Menu button in the log-visit UI + Menu URL field in Edit — mirrors iOS 2.9.
**Phase 4:** Add-a-visit from History, using the Phase 1 search as the picker — mirrors iOS 2.8.

## Boundaries & Constraints

**Always:**
- Server components fetch; client components receive props. Never fetch restaurants in a client component.
- Search and filter are **client-side over the already-fetched set**, exactly as `filterRestaurants` works today. This is a personal-scale list; do not add server-side search.
- Search **ANDs** with filters. It narrows within the filtered set; it never clears or overrides filters.
- Reuse `filters.ts` shape — add a `query: string` to the filter pipeline rather than building a parallel path.
- Match the iOS matching rules exactly: name + cuisine + neighborhood, case- and diacritic-insensitive, substring not prefix.
- Status badge colors stay `#D97706` / `#16A34A` / `#DC2626`.

**Ask First:**
- Any change to the header layout — it has a documented history of iOS repaint regressions (`c096d6a`, `c036895`).
- Making History a separate route (`/history`) versus a third toggle beside map/list. This is a navigation change and is Damon's call.
- Web Share Target — adjacent and tempting, explicitly out of scope here.

**Never:**
- Change the `<frozen-after-approval>` intent of a shipped spec.
- Add server-side search or pagination for a list this size.
- Remove bulk import to "match" iOS.
- Expose the service role key client-side.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior |
|---|---|---|
| Search with filters active | Filter = "Favorite", query = "tha" | Only favorites whose name/cuisine/neighborhood contain "tha" |
| Search matches nothing | Query = "zzz" | Empty state naming the query, with a clear-search action — distinct from the existing "No places match these filters" |
| Clear search | Query emptied | Returns to filtered set, filters intact |
| Search on map view | Query set while map is showing | Pins narrow to the same set the list would show |
| History, no visits ever | Zero rows in `visit_logs` | Warm empty state, same voice as iOS: "Your food adventures will show up here." |
| History, visits present | Rows across several months | Month/year headers descending, entries descending within each |
| History row tapped | Any row | Opens that restaurant's panel, same as a list row |
| Add visit from History | `+` → picker → select → form | Visit saves; entry appears in History immediately without a reload |
| Add visit, restaurant is `want_to_go` | Save | Status becomes `been_there` (already the behavior of `logVisit`) |
| Menu button, `menu_url` set | Click | Opens `menu_url` in a new tab |
| Menu button, only `website` set | Click | Opens `website` |
| Menu button, neither set | Render | Button absent entirely — not disabled |
| Menu URL edited | Paste + save | Persists; visible on iOS after sync |

## Key Files

- `web/src/lib/filters.ts` — add `query` to `FilterState`; extend `filterRestaurants`
- `web/src/components/HomeView.tsx` — search input, wire query into the existing filter pipeline; History toggle
- `web/src/components/ListView.tsx` — search-specific empty state
- `web/src/components/HistoryView.tsx` — **new**, mirrors iOS `HistoryView` + `HistoryViewModel`
- `web/src/app/actions.ts` — add `getAllVisitLogs()`; extend `Restaurant` writes for `menu_url`
- `web/src/lib/supabase/restaurants.ts` — add `menu_url` to the `Restaurant` type and the select
- `web/src/components/RestaurantPanel.tsx` — "View menu" action in the log-visit UI
- `web/src/components/EditRestaurantModal.tsx` — Menu URL field

## Verification

- `cd web && npm run build` — zero errors
- `cd web && npx tsc --noEmit` — zero TypeScript errors
- Manual: type in search → list and pins both narrow → filters still applied → clear → everything returns
- Manual: History shows every visit, grouped by month, newest first
- Manual: log a visit from History → appears immediately → `want_to_go` restaurant flipped to `been_there`
- Manual: paste a menu URL in Edit → open Add Visit → "View menu" goes to the menu, not the homepage
- Manual: a restaurant with no website shows no menu button at all

</frozen-after-approval>

---

## Open before approval

- **Phase 2 navigation shape.** Route (`/history`) or a third toggle beside map/list? Damon's call; it changes the header, which is the one area with a regression history.
- **`website` coverage in the data.** Unverified as of 2026-09-01. Story 2.9's payoff on both surfaces scales directly with how many rows actually have it populated. Rows added by hand, or before the Places migration, may be null.
