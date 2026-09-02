# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Layout

```
PDXDeliciousnessFinder/   iOS app (Swift/SwiftUI/SwiftData) + Supabase Edge Functions
web/                      Next.js 14 web app
_bmad-output/             Planning & implementation artifacts (PRD, architecture, epics, specs, sprint plan)
_bmad/                    BMAD methodology tooling — do not edit
```

---

## iOS App

**Build:** Open `PDXDeliciousnessFinder/PDXDeliciousnessFinder.xcodeproj` in Xcode 16+ to build and run on device or simulator.

**There is a CLI build, and you should use it.** From `PDXDeliciousnessFinder/`:

```bash
xcodebuild -scheme PDXDeliciousnessFinder -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

It compiles the app and the ShareExtension and reports real errors. Use it before claiming a change is complete — `swiftc -parse` on individual files is syntax-only and will not catch a type error. This file previously said "No CLI build"; that was wrong, and at least one story was handed over unbuilt because an agent believed it.

Running on a device or simulator is still a separate step, and there is no test target anywhere in this repo — so a green build is the ceiling of what automation proves here.

**Secrets:** `Config/Config.xcconfig` (gitignored). Copy `Config.xcconfig.example` and fill in `SUPABASE_HOST` and `SUPABASE_ANON_KEY`. Do not hardcode values — xcconfig is loaded at build time.

**Targets:** Main app + `ShareExtension`. Both share an App Groups entitlement. The share extension imports `Core/` only — it does not link the Supabase framework, so all Places/enrichment calls in the extension use URLSession directly.

**Source file discovery:** Xcode uses `fileSystemSynchronizedGroups` (Xcode 16+). **Adding** a source file to a tracked folder auto-includes it in both targets — no `pbxproj` edit needed.

**Renames and deletions are different, and this will break your build.** `project.pbxproj` carries a `PBXFileSystemSynchronizedBuildFileExceptionSet` listing many files individually by path, under `membershipExceptions`, to exclude them from the `ShareExtension` target. Renaming or deleting a listed file without updating that entry fails the build with:

```
error: Build input file cannot be found: '.../Features/History/HistoryViewModel.swift'
```

Grep `membershipExceptions` in `project.pbxproj` and update the path in place. Adding a new file needs no entry unless it must be kept out of the extension.

### iOS Architecture Rules (non-negotiable)

| Constraint | Rule |
|---|---|
| **ARCH-8** | All async UI state uses `ViewState<T>` (idle/loading/loaded/error) — no raw `isLoading: Bool` on ViewModels |
| **ARCH-9** | All Supabase mutations route through `SyncQueue` via Repositories — no direct `supabase.from()` calls in ViewModels |
| **ARCH-10** | Use `SupabaseTables` enum for all table references — no raw string literals in feature code |
| **ARCH-11** | All Supabase DTOs have explicit `CodingKeys` for snake_case ↔ camelCase mapping |
| **ARCH-12** | Feature-first directory structure: `Core/` must not import `Features/`. `ShareExtension` imports `Core/` only |
| **ARCH-13** | Data access goes through `RestaurantRepository` / `VisitLogRepository` — not direct model queries in ViewModels |

### iOS Key File Locations

| Area | Path |
|---|---|
| App shell | `PDXDeliciousnessFinder/App/` |
| Supabase client | `Core/Network/SupabaseClient.swift`, `Core/Network/SupabaseTables.swift` |
| DTOs | `Core/Network/DTOs/` — all have explicit `nonisolated` Codable conformances (synthesized Codable is `@MainActor`-isolated, which breaks PostgREST's Sendable constraint) |
| Local store | `Core/Storage/Models/`, `Core/Storage/PersistenceController.swift`, `Core/Storage/Repositories/` |
| Sync | `Core/Sync/SyncQueue.swift`, `NetworkMonitor.swift`, `RealtimeSubscriptions.swift` |
| UI state | `Core/ViewState.swift` |
| Features | `Features/` (Home, RestaurantList, RestaurantDetail, Map, Onboarding) |
| Share extension | `ShareExtension/` |
| Edge Functions | `supabase/functions/enrich-restaurant/`, `supabase/functions/search-places/` |

### iOS Supabase Notes

- Use `supabase.database.from()` — NOT `supabase.from()`.
- `xcconfig` stores `SUPABASE_HOST = <ref>.supabase.co` without `https://` because `//` is a comment in xcconfig. `SupabaseClient.swift` prepends `https://` at runtime.
- Email confirmation is **disabled** in the Supabase dashboard.
- `RealtimeClientV2` and `RealtimeChannelV2` are Swift actors — all their methods need `await`.

### VenueType rawValue Mismatch

The Edge Functions emit `"foodCart"` (camelCase). The Swift enum raw value is `"food_cart"` (snake_case). `PlacesEnrichmentService.venueTypeFromString()` and `PlacesSearchService.venueTypeFromString()` handle this mapping explicitly — do not change the raw values.

---

## Web App

All commands run from `web/`:

```bash
npm run dev       # dev server on localhost:3000
npm run build     # production build (must pass before deploy)
npx tsc --noEmit  # type check only
```

**Secrets:** `web/.env.local` (gitignored). See `web/.env.local.example` for required keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

**Deploy:** Vercel, root directory = `web`. Merge branch into `main` first; Vercel auto-deploys from `main`. Production URL: `https://pdx-deliciousness-finder.vercel.app`.

### Web Architecture

- **Next.js 14 App Router** with TypeScript and Tailwind CSS v3.
- **Auth:** `@supabase/ssr` — session managed in cookies. Middleware at `src/middleware.ts` gates all routes except `/login`, `/signup`, `/auth/callback`. Auth callback at `src/app/auth/callback/route.ts`.
- **Server components fetch data** and pass it as props to client components. Never fetch restaurants in a client component.
- **Client components that use browser APIs** (e.g., Google Maps) must be imported with `dynamic(..., { ssr: false })` to prevent `window is not defined` errors.
- **Google Maps:** Use `@vis.gl/react-google-maps` — never use the `<Script>` tag approach or the Maps JS API directly.
- **Supabase clients:** `src/lib/supabase/server.ts` for server components and route handlers; `src/lib/supabase/client.ts` for client components.

### Web Sprint State

| Sprint | Status |
|---|---|
| S1 — Foundation (auth, scaffold, deploy) | ✅ Complete |
| S2 — Map View (Google Maps + restaurant pins) | ✅ Complete |
| S3 — Restaurant List + Filtering | ✅ Complete |
| S4 — Add Restaurant (search-places Edge Function) | ✅ Complete |
| S5 — Visit Log | ✅ Complete |

---

## Planning Artifacts

Story source of truth for both iOS and web lives in `_bmad-output/`:

| File | Purpose |
|---|---|
| `planning-artifacts/epics.md` | All 5 epics, all stories, full acceptance criteria — authoritative scope |
| `planning-artifacts/prd.md` | Product requirements |
| `planning-artifacts/architecture.md` | Architecture decisions and rationale |
| `implementation-artifacts/sprint-plan.md` | Sprint status and story delivery tracking |
| `implementation-artifacts/spec-wip.md` | Current in-progress web spec (frozen after approval) |
| `implementation-artifacts/deferred-work.md` | Web app stories queued after S2 |

When writing a new web spec, use `_bmad-output/implementation-artifacts/spec-wip.md`. The `<frozen-after-approval>` block is human-owned intent — do not modify it once approved.

---

## Status Badge Colors (shared across iOS and web)

| Status | Hex |
|---|---|
| `want_to_go` | Amber `#D97706` |
| `been_there` | Green `#16A34A` |
| `favorite` | Red `#DC2626` |
