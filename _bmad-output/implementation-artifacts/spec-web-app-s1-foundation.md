---
title: 'PDX Deliciousness Finder — Web App S1: Foundation'
type: 'feature'
created: '2026-04-28'
status: 'in-review'
baseline_commit: '076589c'
branch: 'web-app'
context:
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PDX Deliciousness Finder is iOS-only, blocking Android users and requiring Xcode cable installs for any distribution. Portland-based testers (including Android users from Damonbrennen's course) want to use the app now.

**Approach:** Scaffold a Next.js 14 web app in `/web` that connects to the existing live Supabase project, implements email/password + Google OAuth auth, and deploys to Vercel — establishing the authenticated shell that S2–S5 features will build on.

## Boundaries & Constraints

**Always:**
- Connect to the existing live Supabase project (real user data). Never create a parallel or test project without explicit human approval.
- Use `NEXT_PUBLIC_SUPABASE_URL` (full URL, e.g. `https://xxxx.supabase.co`) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — different naming convention from iOS but same project credentials.
- All app routes except `/login` and `/signup` must be auth-gated via Next.js middleware.
- `.env.local` must be gitignored. `.env.local.example` committed with all required var names and no real values.
- Web app lives in `/web` within the existing monorepo. Do not restructure the iOS app directory.

**Ask First:**
- Any schema changes to existing Supabase tables (`restaurants`, `visit_logs`, `profiles`, `friendships`).
- Any changes to existing edge functions (`search-places`, `enrich-restaurant`).
- If Google OAuth Supabase configuration is not yet set up — halt and surface the manual steps before writing auth code that depends on it.

**Never:**
- Build any restaurant features (map, list, add, visit log) — those are S2–S5.
- Add Sign in with Apple on web (iOS concern only).
- Use the Pages Router — App Router only.
- Expose service role key client-side under any circumstances.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New user — email signup | Valid email + password (≥6 chars) | Supabase creates account; user redirected to `/` (app shell) | Show inline error for duplicate email or weak password |
| Returning user — email login | Valid credentials | Session established; redirected to `/` | Show "Invalid credentials" — never distinguish email vs password |
| New user — Google OAuth | Click "Continue with Google" | Google consent → Supabase callback → redirected to `/` | Show generic error if OAuth flow fails |
| Unauthenticated route access | No session, navigates to `/` | Middleware redirects to `/login` | — |
| Session expiry | Expired token, app open | Middleware detects, redirects to `/login` | — |
| Sign out | Authenticated user clicks Sign Out | Session cleared; redirected to `/login` | — |

</frozen-after-approval>

## Code Map

- `web/` -- new Next.js 14 app root; all web files live here
- `web/src/app/layout.tsx` -- root layout; Supabase session provider wrapper
- `web/src/app/page.tsx` -- authenticated home shell (placeholder for S2 map/list)
- `web/src/app/(auth)/login/page.tsx` -- email/password + Google OAuth sign-in UI
- `web/src/app/(auth)/signup/page.tsx` -- email/password registration UI
- `web/src/app/auth/callback/route.ts` -- Supabase OAuth callback handler (required for Google OAuth PKCE flow)
- `web/src/lib/supabase/client.ts` -- browser-side Supabase client (singleton)
- `web/src/lib/supabase/server.ts` -- server-side Supabase client (cookies-based, for middleware + server components)
- `web/src/middleware.ts` -- route protection; redirects unauthenticated requests to /login
- `web/.env.local.example` -- documents NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (placeholder for S2)
- `web/package.json` -- deps: next@14, @supabase/supabase-js, @supabase/ssr, tailwindcss, typescript
- `.gitignore` -- ensure web/.env.local is covered (root gitignore likely already covers *.env.local)

## Tasks & Acceptance

**Execution:**
- [x] `web/package.json` + `web/next.config.mjs` + `web/tailwind.config.ts` + `web/tsconfig.json` -- scaffold Next.js 14 app with TypeScript and Tailwind -- foundation for all subsequent stories
- [x] `web/src/lib/supabase/client.ts` + `web/src/lib/supabase/server.ts` -- create browser and server Supabase clients using `@supabase/ssr` -- SSR-safe session handling required for middleware auth checks
- [x] `web/src/middleware.ts` -- protect all routes except `/login`, `/signup`, `/auth/callback` -- unauthenticated users must never reach app routes
- [x] `web/src/app/auth/callback/route.ts` -- handle Supabase OAuth PKCE callback and exchange code for session -- required for Google OAuth to complete
- [x] `web/src/app/(auth)/login/page.tsx` -- email/password form + "Continue with Google" button; client component -- entry point for all users
- [x] `web/src/app/(auth)/signup/page.tsx` -- email/password registration form; client component -- new user onboarding
- [x] `web/src/app/layout.tsx` + `web/src/app/page.tsx` -- root layout with Tailwind globals; authenticated shell with header (user email + Sign Out button) and placeholder main area -- confirms auth flow end-to-end
- [x] `web/.env.local.example` -- document all required env vars with descriptions and placeholder values -- prevents "why won't it run" for future setup
- [x] `web/vercel.json` -- configure build root to `web/` so Vercel deploys the web app from the monorepo subfolder

**Acceptance Criteria:**
- Given a new visitor, when they navigate to any app route, then they are redirected to `/login`
- Given a user on `/login`, when they submit valid email/password credentials, then they are signed in and redirected to `/`
- Given a user on `/login`, when they click "Continue with Google" and complete OAuth consent, then they are signed in and redirected to `/`
- Given a user on `/signup`, when they submit a valid new email/password, then account is created and they are redirected to `/`
- Given a signed-in user on `/`, when they click Sign Out, then session is cleared and they are redirected to `/login`
- Given the Vercel deployment, when a push to the `web-app` branch occurs, then a preview deploy is created; push to `main` triggers production deploy

## Design Notes

**Google OAuth — manual Supabase + Google Console setup required before coding auth:**
1. Google Cloud Console → Create OAuth 2.0 credentials → add `https://<your-supabase-project>.supabase.co/auth/v1/callback` as authorized redirect URI
2. Supabase Dashboard → Authentication → Providers → Google → enable, paste Client ID + Secret
3. Add `http://localhost:3000/auth/callback` and production Vercel URL to Google Console authorized origins

**Search provider abstraction:** The web app will call the existing `search-places` Supabase edge function directly. The web app has zero knowledge of Yelp. Swapping to Google Places later = rewrite edge function only, no web app changes.

**Branch:** Create `web-app` branch from `main` for all web work. Do not merge into `ui-experiment`.

## Verification

**Commands:**
- `cd web && npm run dev` -- expected: dev server starts on localhost:3000 with no TypeScript errors
- `cd web && npm run build` -- expected: production build completes with no errors
- `cd web && npx tsc --noEmit` -- expected: zero type errors

**Manual checks:**
- Navigate to `http://localhost:3000` → should redirect to `/login`
- Sign up with a test email → should land on `/` with user email visible in header
- Sign out → should redirect to `/login`
- Sign in with Google → should complete OAuth flow and land on `/`
