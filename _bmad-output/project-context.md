# PDX Deliciousness Finder — project context (LLM)

## Auth (v1)

- **FR42 (canonical):** Users can create an account and sign in using email and password (Supabase Auth); Sign in with Apple may be added before App Store submission.
- **FR43:** Same Supabase account (email) on any iOS device — not Apple ID–specific for v1.
- **NFR8:** v1 uses Supabase email/password; credentials are not stored in-app. Sign in with Apple is out of scope for v1 TestFlight; optional before App Store if guideline 4.8 applies.
- **Code:** `OnboardingView.swift` may still use Sign in with Apple until Story 1.1 is implemented with email/password UI.

## Source of truth

Planning details: `_bmad-output/planning-artifacts/prd.md`, `epics.md`, `architecture.md`, `ux-design-specification.md`.
