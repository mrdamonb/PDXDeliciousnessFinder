---
id: SPEC-web-s6-parity
companions:
  - parity-audit.md
  - edge-cases.md
  - build-plan.md
  - ../../project-context.md
sources:
  - ../../implementation-artifacts/spec-wip.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Web App S6 — Parity with the iOS App

## Why

**A pain, and a blocked verification.** The web app is where Damon is when he is not on his phone, and it is now three capabilities behind iOS on the thing the app exists to do: keep a journal of where he has been. There is no journal view at all, no way to search his own list, and no way to correct a visit once logged. Sprint 3 closed all of these on iOS and device-verified them; the web app has not moved since the Google Places rename.

The backdrop that makes it matter now is not only the gap. **Story 2.10's cross-device conflict check is deferred waiting on this work.** Damon's call was to verify last-write-wins using the web app as the second device rather than standing up a second iOS device, so iOS 2.10 cannot be closed until web can write a visit edit. Parity stopped being only a convenience and became a dependency.

## Capabilities

- **CAP-1**
  - **intent:** Damon can narrow his own restaurant list by typing, on both the list and the map, without losing the filters he already has set.
  - **success:** With a filter active, typing a query returns only the restaurants that satisfy both; pins on the map narrow to the same set the list shows; clearing the query restores the filtered set with filters intact. Matching agrees with iOS: name, cuisine and neighborhood, case- and diacritic-insensitive, substring not prefix.

- **CAP-2**
  - **intent:** Damon can see every visit he has logged across all restaurants in one reverse-chronological journal, the way the iOS History tab shows it — and use it to answer "where have I been recently and what did I have?" when deciding where to go tonight.
  - **success:** Every row in `visit_logs` for the signed-in user appears grouped under a month/year header, months descending and entries descending within each; no header renders with nothing beneath it; a row opens that restaurant's panel; with zero visits, a warm empty state appears rather than a blank surface. Recency and what was eaten are legible at a glance without opening a row.

- **CAP-3**
  - **intent:** Damon can log a visit from the journal itself, picking the restaurant there, instead of first finding it in the list.
  - **success:** From the journal, choosing a restaurant and saving a visit makes the entry appear in the journal immediately without a page reload, and a `want_to_go` restaurant becomes `been_there`.

- **CAP-4**
  - **intent:** Damon can correct a visit he already logged — its date and its note — from the journal, so a visit stops being write-once on the web the way it stopped being write-once on iOS.
  - **success:** Editing a visit updates it in place with the same `id` and `created_at`, writes a fresh `updated_at`, leaves the restaurant's status unchanged, and produces no duplicate entry. An edit made on web and an edit made on iOS to the same visit converge on whichever carries the later `updated_at`.

## Constraints

- **A web edit must write `visit_logs.updated_at`.** iOS 2.10 resolves conflicts on `dto.updatedAt > existing.updatedAt`. Web's visit select (`actions.ts:97`) omits the column today, so an edit that does not set it cannot participate in last-write-wins and silently loses or wins at random.
- **An edit preserves `id` and `created_at`, and never touches the restaurant's status.** Mirrors iOS 2.10 exactly; a mutation, never a new row.
- Search and filter run **client-side over the already-fetched set**, as `filterRestaurants` does today. Personal-scale list; no server-side search, no pagination.
- Search **ANDs** with filters — it narrows within the filtered set and never clears or overrides them.
- Extend `filters.ts` by adding `query` to `FilterState` and to the existing pipeline. No parallel filtering path.
- Server components fetch; client components receive props. Restaurants are never fetched in a client component.
- **Do not change web's `logVisit` auto-promotion** of `want_to_go` to `been_there` (`actions.ts:227`). It is the correct behaviour and iOS 2.8 adopted it; web is already right.
- Status badge colors stay `#D97706` / `#16A34A` / `#DC2626`.
- The service role key is never exposed client-side.
- **The journal is a third segment in the existing header Map/List toggle**, not a separate route. Damon's decision, 2026-09-06. It inherits the toggle's behaviour: switching does not re-filter and does not lose the active filters.
- **The header wordmark is replaced by the app logo** to buy back the width the third segment costs, rendered as an inline SVG in `#C2410C` — the app's orange, not the logo file's `#E14729`. Damon's decisions, 2026-09-06.
- **Ask Damon before any further change to the header layout.** It has a documented history of repaint regressions (`c096d6a`, `c036895`), and the journal's navigation shape lands there.

## Non-goals

- **Responsive or layout work.** Damon, 2026-09-06: the Vercel app already works on his phone. This spec adds features to it and changes nothing about how it lays out.
- **Making web's "View menu" fall back to `website` the way iOS does.** A deliberate, documented divergence — see `parity-audit.md`.
- Offline write queue and realtime sync on web. Architectural; web is online-only by design.
- Web Share Target. Adjacent and tempting; already parked on `deferred-work.md`.
- Removing bulk import to "match" iOS. Bulk import is web-only by design and is not a gap.
- Deleting a visit from the journal. iOS 2.10 excludes it deliberately; web matches.
- Edit history, versioning, or an audit trail on visits.
- Changing which restaurant a visit belongs to.

## Success signal

Damon opens the web app on his phone, finds a restaurant by typing part of its name, sees every visit he has ever logged in one journal, adds one and corrects the date on another — and the corrections show up on his iPhone. Concretely: **story 2.10's deferred cross-device conflict check can finally be run**, editing the same visit on web and on iOS and watching both converge on the later `updated_at`.

## Assumptions

- The `visit_logs` UPDATE RLS policy verified for iOS 2.10 (`visit_logs_update_own`, `USING (auth.uid() = user_id)`) governs the web client identically, since both authenticate as the same Supabase user. Not re-verified from the web side.
- `visit_logs.updated_at` exists in the remote database, added by migration `20260906000000_add_visit_logs_updated_at.sql` for iOS 2.10. Web depends on it and does not add it.
- iOS story 2.10 is **done** (Damon's call, 2026-09-06), so CAP-4 builds against settled iOS behaviour. Its cross-device conflict check stays deferred to story 5 of this spec.

## Open Questions

- **"Latest" sort disagrees across surfaces:** iOS sorts by `updatedAt`, web by `created_at`, same label. The 2026-09-01 draft proposed `created_at` on both; that was a proposal, never approved. Close it, or leave the two surfaces answering different questions?
- **How many restaurants actually have `website` populated?** Open and unverified since 2026-09-01. Lower stakes now that menu work is out of scope, but still unanswered.
