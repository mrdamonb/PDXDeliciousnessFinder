# Build plan — sequencing, key files, verification

## Sequencing

Order is by dependency, not by importance.

1. **CAP-1, search.** The spine. CAP-3's restaurant picker *is* this search, so building it first means building the matching rules once.
2. **CAP-2, the journal.** Independent of CAP-1, but CAP-3 and CAP-4 both need a surface to hang off.
3. **CAP-3, add a visit from the journal.** Blocked on both of the above.
4. **CAP-4, edit a visit.** Last, and the one that unblocks story 2.10's deferred conflict verification.

CAP-1 and CAP-2 can run in parallel. CAP-3 and CAP-4 cannot start before both land.

## Key files

- `web/src/lib/filters.ts` — add `query` to `FilterState` and `EMPTY_FILTER`; extend `filterRestaurants` and `activeFilterCount`
- `web/src/components/HomeView.tsx` — search input, wire the query through the existing filter pipeline; journal navigation
- `web/src/components/ListView.tsx` — search-specific empty state naming the query
- `web/src/components/HistoryView.tsx` — **new**, mirrors iOS `HistoryView` plus the `HistoryGrouping` pure function
- `web/src/app/actions.ts` — add `getAllVisitLogs()` and `updateVisit()`; **add `updated_at` to the visit select list at L97**, which omits it today
- `web/src/components/RestaurantPanel.tsx` — the existing inline log form is the model for the journal's add and edit forms; reuse `normalizeWebUrl` rather than writing a second URL rule

## Verification

**Commands:**
- `cd web && npm run build` — zero errors
- `cd web && npx tsc --noEmit` — zero TypeScript errors

**Manual:**
- Type in search → list and pins both narrow → filters still applied → clear → everything returns
- Journal shows every visit, grouped by month, newest first, no empty headers
- Log a visit from the journal → appears immediately → a `want_to_go` restaurant flips to `been_there`
- Edit a visit's note → updates in place, no duplicate, restaurant status unchanged
- Move a visit's date across a month boundary → it regroups and the old header clears
- **Cross-device, the one this whole spec unblocks:** edit the same visit on web and on iOS before either syncs, confirm both converge on the later `updated_at` — a genuine conflict, not just forward propagation
