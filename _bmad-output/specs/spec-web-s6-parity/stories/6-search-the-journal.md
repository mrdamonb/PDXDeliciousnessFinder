---
title: 'Search the journal'
type: 'bugfix'
created: '2026-09-13'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0e9347bfe8a0c96de983293389fc8e058e9509c4'
context: ['{project-root}/_bmad-output/specs/spec-web-s6-parity/SPEC.md', '{project-root}/_bmad-output/specs/spec-web-s6-parity/parity-audit.md', '{project-root}/_bmad-output/specs/spec-web-s6-parity/edge-cases.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The search field is on screen on the Journal view and does nothing. Story 1 put it in a row below the header that renders on all three views; story 3 made the Journal ignore `filterState` entirely and explicitly scoped out "a search field inside the journal." Typing in it on Journal changes nothing, with no sign that it is inert. It is also a parity gap: story 3 justified ignoring `filterState` as "same as iOS," which is true of the **filters** but not of **search**. iOS History has its own search (story 3.5) over restaurant name and visit note (`HistoryGrouping.swift:44-48`, prompt "Restaurants and notes"). Damon's call, 2026-09-13: search should work on the Journal.

**Approach:** The existing search field drives the Journal too. On Journal it matches visits by **restaurant name or visit note**, mirroring iOS exactly, and is applied after the unrenderable-entry filter and before month grouping. The Journal still ignores the five filter dimensions. No new input, no new state: the Journal reads `filterState.query`, the same value Map and List already use.

## Boundaries & Constraints

**Always:** Match iOS's rule: substring, case- and diacritic-insensitive, over `restaurant.name` and `note` only; reuse `normalizeSearchText` from `filters.ts` (do not add another normalizer). Whitespace-only query is no search (trim first, as iOS does). Order is renderable → query match → group, so a month header never renders with nothing beneath it. Journal continues to ignore `status`/`venueType`/`neighborhood`/`cuisine`/`price`. A search with zero matches shows a no-results state with "Clear search," distinct from the zero-visits empty state. Tapping a matched row still opens that restaurant's panel even if Map/List's own filtering excludes it (already guaranteed by story 3's `MapView` fix; do not regress it).

**Ask First:**
1. ~~**Placeholder per view.**~~ **Decided (Damon, 2026-09-13): conditional placeholder.** "Search your places…" on Map/List, "Search restaurants and notes…" on Journal, so it is discoverable that notes are searched. One conditional string, no layout change.
2. ~~**Query across view switches.**~~ **Decided (Damon, 2026-09-13): the query persists** when switching Map/List/Journal. It is one visible field and the text stays on screen. (iOS clears on tab switch because its field is per-tab and an invisible leftover query hid data. Web's field is shared and always visible, so that trap does not apply.) This is today's behavior; no code needed, only do not add a reset.
3. ~~**Adding a visit while a search is active.**~~ **Decided (Damon, 2026-09-13): clear the query on a successful save from the Journal** so the new entry is visible.

**Never:** No change to how Map/List match (`matchesQuery` stays name/cuisine/neighborhood). No second search input. No cuisine/neighborhood matching on Journal (iOS does not; parity). No header layout change; the 1c header redesign is separate and pending a design iteration. No server-side search.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Match on restaurant name | Query "lardo", visits at Lardo | Only Lardo visits, grouped by month, newest first | N/A |
| Match on note only | Query "tacos", a note says "fish tacos" at a restaurant not named tacos | That visit appears | N/A |
| Diacritics / case | Query "cafe" | Matches "Café Olli" and a note "CAFE au lait" | N/A |
| Whitespace query | "   " | Full journal, as if empty | N/A |
| No matches | Query with zero hits, visits exist | "No visits match “x”" + Clear search button (same pattern as `ListView.tsx:44-57`) | N/A |
| No visits at all | Zero renderable visits, any query | Existing warm empty state, not the no-results state | N/A |
| Month with no matches | Matches only in August | No September header rendered | N/A |
| Edit a note so it stops matching | Query active, edit removes the term | Row drops out of results; its header disappears if emptied | N/A |
| Delete a matched visit | Query active | Row removed; emptied header disappears | N/A |
| Tap a note-matched row | Query "tacos", restaurant name doesn't contain it | Map opens with that restaurant's panel shown | N/A |
| Clear search | Tap × in field or "Clear search" | Full journal returns; query cleared for Map/List too (shared field) | N/A |

</frozen-after-approval>

## Code Map

- `web/src/lib/historyGrouping.ts` -- `groupVisitsByMonth(logs, query = '')`: gains an optional query, mirroring iOS `HistoryGrouping.sections(from:matching:)`. After the existing `renderable` filter and before bucketing, keep only logs where `normalizeSearchText(restaurant.name)` or `normalizeSearchText(note ?? '')` includes the normalized trimmed query. Empty/whitespace query skips the step. Existing callers unaffected by the default.
- `web/src/lib/filters.ts` -- no change; import `normalizeSearchText` from here.
- `web/src/components/HistoryView.tsx` -- `Props` gain `query: string` and `onClearSearch: () => void`. Compute `sections = groupVisitsByMonth(logs, query)`. Distinguish the two empty cases by also checking whether `groupVisitsByMonth(logs)` (no query) is empty: if so, the existing "No visits yet" state; otherwise the new no-results state with a Clear search button calling `onClearSearch`. If Ask First #3 is approved, call `onClearSearch()` inside `handleSaved` when `query.trim()` is non-empty.
- `web/src/components/HomeView.tsx` -- pass `query={filterState.query}` and `onClearSearch={clearSearch}` to `<HistoryView>` (~L378). If Ask First #1 is approved, make the input's `placeholder` (and `aria-label`) conditional on `view === 'journal'`. Nothing else in the header or search row changes.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/lib/historyGrouping.ts` -- add optional `query` param, match name/note, filter before grouping -- the parity rule, pure and testable
- [x] `web/src/components/HistoryView.tsx` -- accept `query`/`onClearSearch`, no-results state -- makes the field do something on Journal
- [x] `web/src/components/HomeView.tsx` -- pass the two props; placeholder only if approved -- wiring

**Acceptance Criteria:**
- Given visits whose notes mention "tacos" at restaurants not named tacos, when "tacos" is typed on Journal, then exactly those visits appear.
- Given matches only in one month, when searching, then no other month header renders.
- Given "café" in a restaurant name, when "cafe" is typed, then it matches.
- Given a query with zero matches and at least one visit, when on Journal, then "No visits match" with Clear search renders, and Clear search restores the full journal.
- Given zero visits, when a query is typed, then the warm "No visits yet" state renders, not the no-results state.
- Given active status filters, when on Journal, then they still do not affect Journal content.

## Design Notes

This supersedes story 3's Never line "No search field inside the journal itself." That line was a scope cut for story 3, not a product decision, and its "same as iOS" justification covered filters only. iOS History has always searched.

Name + note (not cuisine/neighborhood) is deliberate: it is exactly the iOS rule, and the note is where "what did I have" lives, which is the reason the Journal exists (story 3's framing: it answers "where have I been recently and what did I have?" when deciding where to go tonight).

Mirroring iOS's `sections(from:matching:)` by putting the match inside `groupVisitsByMonth` rather than in `HistoryView` keeps the filter-before-group ordering in one pure function, where it cannot be bypassed.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit` -- expected: zero TypeScript errors
- `cd web && npm run build` -- expected: zero errors

**Manual checks:**
- Run `groupVisitsByMonth` against real-shaped inputs (note null, accented name, whitespace query, matches spanning one month) rather than reading it. Executing beat reading twice in this project already.
- On a phone: Journal, type a word from a known note, confirm the row appears; type nonsense, confirm the no-results state and that Clear search works; switch to List and back, confirm behavior matches whatever Ask First #2 settled.

## Suggested Review Order

**Query matching (the parity rule)**

- Entry point: the query-matching step, mirroring iOS `sections(from:matching:)` exactly.
  [`historyGrouping.ts:37`](../../../../web/src/lib/historyGrouping.ts#L37)

- Reuses `filters.ts`'s normalizer rather than adding a second one, per the spec's Always line.
  [`historyGrouping.ts:2`](../../../../web/src/lib/historyGrouping.ts#L2)

- Match is over name-or-note only, applied before month bucketing so a header never renders empty.
  [`historyGrouping.ts:45`](../../../../web/src/lib/historyGrouping.ts#L45)

**Empty-state split (Journal-specific)**

- Distinguishes "zero visits" from "zero matches" by checking the unfiltered set separately.
  [`HistoryView.tsx:173`](../../../../web/src/components/HistoryView.tsx#L173)

- New no-results branch: "No visits match" + Clear search, same pattern as `ListView.tsx`.
  [`HistoryView.tsx:175`](../../../../web/src/components/HistoryView.tsx#L175)

**Ask First #3 — clear query on save**

- Clears the active search after a successful Journal save so the new entry is visible.
  [`HistoryView.tsx:96`](../../../../web/src/components/HistoryView.tsx#L96)

**Wiring and peripherals**

- `HistoryView` now takes `query`/`onClearSearch` as props instead of owning no search state.
  [`HistoryView.tsx:23`](../../../../web/src/components/HistoryView.tsx#L23)

- Passes the shared `filterState.query` through to Journal, same wiring `ListView` already had.
  [`HomeView.tsx:384`](../../../../web/src/components/HomeView.tsx#L384)

- Ask First #1 — placeholder/aria-label conditional on the active view.
  [`HomeView.tsx:240`](../../../../web/src/components/HomeView.tsx#L240)
