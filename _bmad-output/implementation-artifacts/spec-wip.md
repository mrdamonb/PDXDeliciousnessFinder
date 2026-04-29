---
title: 'PDX Deliciousness Finder — Web App S2: Map View'
type: 'feature'
created: '2026-04-28'
status: 'draft'
branch: 'web/s2-map-view'
context:
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/implementation-artifacts/spec-web-app-s1-foundation.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The authenticated home page shows a placeholder — users have no way to see or interact with their saved restaurants on the web.

**Approach:** Replace the home page placeholder with an interactive Google Maps view that loads the user's restaurants from Supabase and plots them as pins. Clicking a pin surfaces a popup with the restaurant's name, address, and status.

## Boundaries & Constraints

**Always:**
- Map must only show restaurants belonging to the authenticated user (`user_id` = current session user).
- Use `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` from env — never hardcode.
- Map renders client-side; restaurant data is fetched server-side in the page server component and passed as props.
- Preserve the existing header (app name, user email, Sign Out) from S1 — do not remove or restructure it.
- Portland, OR as the default map center if no restaurants exist yet.

**Ask First:**
- Any changes to the `restaurants` table schema or RLS policies.

**Never:**
- Add filtering, search, or list view — those are S3.
- Add the ability to add or edit restaurants — that is S4.
- Show other users' restaurants.
- Use the Google Maps JS API directly (no `<Script>` tag gymnastics) — use the `@vis.gl/react-google-maps` package.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| User has restaurants with coordinates | Authenticated session, restaurants rows with lat/lon | Map centered on Portland, pins rendered at each restaurant location | — |
| User has no restaurants | Authenticated session, empty restaurants table for user | Map renders centered on Portland with no pins; no error state | — |
| Restaurant has null lat/lon | Row with null latitude or longitude | Skip that restaurant — do not attempt to render a pin | — |
| Map API key missing or invalid | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` not set | Map area shows Google's default error state; rest of UI unaffected | — |
| Pin clicked | User taps a map pin | InfoWindow opens showing name, address, status badge; only one InfoWindow open at a time | — |

</frozen-after-approval>

## Code Map

- `web/src/app/page.tsx` -- server component; fetches restaurants for current user; passes to MapView
- `web/src/components/MapView.tsx` -- new; 'use client'; renders Google Map with restaurant pins and InfoWindow
- `web/src/lib/supabase/restaurants.ts` -- new; typed fetch helper for restaurants table
- `web/package.json` -- add `@vis.gl/react-google-maps` dependency
- `web/.env.local` -- already has `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (gitignored)
- `web/.env.local.example` -- already documents `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## Tasks & Acceptance

**Execution:**
- [ ] `web/package.json` -- add `@vis.gl/react-google-maps` -- Google Maps React library; handles script loading, SSR safety, and marker lifecycle
- [ ] `web/src/lib/supabase/restaurants.ts` -- create typed `getRestaurants(supabase)` function that selects `id, name, address, latitude, longitude, status, venue_type` from `restaurants` where `user_id` matches the session user, filters out rows with null lat/lon -- clean data boundary; server component stays thin
- [ ] `web/src/components/MapView.tsx` -- create client component: `APIProvider` wrapping a `Map` centered on Portland (45.5231, -122.6765, zoom 12); render an `AdvancedMarker` for each restaurant; clicking a marker opens an `InfoWindow` with name, address, and a status badge; only one InfoWindow open at a time -- core S2 deliverable
- [ ] `web/src/app/page.tsx` -- replace placeholder `<main>` with `<MapView restaurants={restaurants} />`; fetch restaurants server-side using `getRestaurants` -- wires data to UI

**Acceptance Criteria:**
- Given an authenticated user with saved restaurants, when they load `/`, then a Google Map renders with a pin for each restaurant that has coordinates
- Given an authenticated user with no restaurants, when they load `/`, then the map renders centered on Portland with no pins and no error
- Given a map with pins, when the user clicks a pin, then an InfoWindow opens showing the restaurant name, address, and status; clicking another pin closes the first and opens the new one
- Given a restaurant row with null lat/lon, when the map loads, then that restaurant is silently skipped — no crash, no broken pin
- Given the page loads, when inspected, then no restaurant data from other users is present

## Design Notes

**Status badge colors** — exact match to iOS design tokens (raw DB values → hex):
- `want_to_go` → Amber `#D97706`
- `been_there` → Green `#16A34A`
- `favorite` → Red `#DC2626`

**SSR safety:** `MapView` must be imported with `dynamic(() => import(...), { ssr: false })` in `page.tsx` to prevent `window is not defined` errors during server render.

## Verification

**Commands:**
- `cd web && npm install` -- expected: `@vis.gl/react-google-maps` added to node_modules with no peer dep conflicts
- `cd web && npm run build` -- expected: production build completes with zero errors
- `cd web && npx tsc --noEmit` -- expected: zero TypeScript errors

**Manual checks:**
- Load `http://localhost:3000` — map should render centered on Portland
- Confirm pins appear for restaurants in the logged-in user's account
- Click a pin — InfoWindow should open with name, address, status badge
- Click a different pin — previous InfoWindow closes, new one opens
