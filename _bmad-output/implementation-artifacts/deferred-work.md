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
