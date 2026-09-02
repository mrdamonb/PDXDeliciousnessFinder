# Deferred Work

## Web App Stories — Deferred from S1 Foundation (2026-04-28)

These goals were split from the web app V1 initiative. Tackle in order after S1 ships.

---

### S2 — Map View
Google Maps JS API, restaurant pins plotted from `restaurants` table, click pin to view restaurant name/address/status. Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

### S3 — Restaurant List + Filtering
List view of user's restaurants. Filters: venue type (restaurant/bar/brewery/food cart), status (wishlist/been there/favorite), price range. Mirrors iOS filter behavior.

### S4 — Add Restaurant
In-app search via existing `search-places` Supabase edge function (Yelp-backed). Select result, confirm details, save to `restaurants` table. Mirrors iOS AddRestaurantView flow.

### S5 — Visit Log
Mark a restaurant as visited. Add notes. View visit history with timestamps. Writes to `visit_logs` table.

---

## Deferred from S4 — Add Restaurant (2026-04-29)

- **Server-side enum validation in `saveRestaurant`** — `venue_type` and `status` fields are passed from the client with no server-side allowlist check. Postgres constraints are the current backstop. Add explicit validation before the insert if DB-level errors need cleaner user messages.
- **`supabase.auth.getUser()` error field ignored** — `saveRestaurant` checks `!user` but discards the `error` return from `getUser()`. Add logging of the auth error for diagnostics when session is stale.

## Future / Separate Initiatives

- **Social layer** (friends, shared lists) — add to both iOS and web after web V1 is in testers' hands
- **Monetization brainstorming** — flagged for a dedicated BMAD brainstorming session
- **Switch search provider from Yelp to Google Places** — edge function rewrite only, no web app changes needed
- **Web Share Target** (Android PWA share sheet) — single manifest entry, low effort, consider for S4 or post-launch

## Deferred from: code review of spec-3-5-search-your-restaurants (2026-09-01)

- ~~**`VisitLogDTO.toModel()` never hydrates the `restaurant` relationship**~~ — **promoted to story 1.5, 2026-09-01, and the original description here was wrong.** Checking call sites showed a second, larger defect: `VisitLogRepository.pullFromRemote` is **never called from anywhere**, so visits are not merely unhydrated after a reinstall, they are never fetched at all and History is empty rather than showing bare month headers. The two defects compound and neither fix is visible alone. See `1-5-visit-history-survives-reinstall.md`. Scheduled ahead of story 2.8.
- **No test target exists anywhere in the repo.** No `XCTest` or `import Testing` in any `.swift` file, no test `PBXNativeTarget`, no scheme with a TestAction. This surfaced during 3.5 because `grouped(_:matching:)` became pure, deterministic, testable logic, and because `matches(_:_:)` is the search predicate that Story 2.8's restaurant picker and the S6 web parity spec both reuse. As written it is a `private func` on a `View`, so it would be unreachable from a test target even if one existed. Standing up a target and lifting the predicate into a plain type would need to happen together.
- **`RestaurantDetailViewModel.markVisited` and `.addVisit` are dead code** (`Features/RestaurantDetail/RestaurantDetailViewModel.swift:13` and `:69`). `RestaurantDetailView.swift:177` and `:180` both present `AddVisitView` instead. Both dead methods also construct `VisitLog` without setting the relationship, so they are latent instances of the orphan bug above and should be deleted rather than fixed.
- **Accessibility gaps in the list empty states** (`Features/RestaurantList/RestaurantListView.swift`). Fixed `.font(.system(size: 64))` ignores Dynamic Type, decorative icons are not `.accessibilityHidden(true)`, and long text has no `lineLimit`. Applies to `noRestaurantsState` and `noResultsState` as well as the new search state, so it is a repo-wide pass rather than a 3.5 fix.
- **A matched visit note gives no visible reason for the row appearing** (`Features/History/HistoryView.swift:100`). `HistoryRowView` truncates `log.note` to `.lineLimit(1)` and there is no match highlighting, so a visit that matches on a word deep in a note shows up looking arbitrary. Consider raising the line limit while a search is active, or surfacing the matching snippet.
