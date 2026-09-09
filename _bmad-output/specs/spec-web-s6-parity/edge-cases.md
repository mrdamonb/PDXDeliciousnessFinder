# I/O and edge-case matrix

Refreshed 2026-09-06. Menu rows dropped (shipped on web); edit rows added for CAP-4.

| Scenario | Input / State | Expected behavior |
|---|---|---|
| Search with filters active | Filter = "Favorite", query = "tha" | Only favorites whose name, cuisine or neighborhood contains "tha" |
| Search matches nothing | Query = "zzz" | Empty state **naming the query**, with a clear-search action — distinct from the existing "No places match these filters" |
| Clear search | Query emptied | Returns to the filtered set, filters intact |
| Search on map view | Query set while the map is showing | Pins narrow to the same set the list would show |
| Search, then leave the surface and return | Query set, open a restaurant, come back | Query state is whatever was deliberately chosen — never a stale filter silently hiding rows. This is the iOS 3.5 defect in web form |
| Journal, no visits ever | Zero rows in `visit_logs` | Warm empty state, same voice as iOS: "Your food adventures will show up here." |
| Journal, visits present | Rows across several months | Month/year headers descending, entries descending within each |
| Journal, an entry whose restaurant is missing | Visit row with no resolvable restaurant | Entry is filtered out **before** grouping, so no month header renders empty |
| Journal row tapped | Any row | Opens that restaurant's panel, same as a list row |
| Add visit from the journal | `+` → picker → select → form → save | Visit saves; entry appears in the journal immediately without a reload |
| Add visit, restaurant is `want_to_go` | Save | Status becomes `been_there` (already `logVisit`'s behavior) |
| Edit a visit, change the note | Journal → edit → change → save | Entry shows the new note immediately; same `id` and `created_at`; no duplicate; month grouping unchanged unless the date moved |
| Edit a visit, change the date across a month boundary | Visit moves from March to April | Entry regroups under the new month header; the old header disappears if it is now empty |
| Edit a visit | Any save | Restaurant status is unchanged — no promotion path in the edit flow |
| Concurrent edit, web and iOS | Same visit edited on both before either syncs | Both converge on the edit carrying the later `updated_at`. Silent resolution, no conflict prompt — matches restaurant behavior |
| Edit written without `updated_at` | — | Must not be possible. See the constraint in SPEC.md; this is the failure mode the constraint exists to prevent |
