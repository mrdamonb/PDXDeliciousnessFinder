# Epic 2 Context: Your Portland Food Journal

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the complete personal restaurant curation loop: add a restaurant manually, view and edit its full detail card, track status (Want to Go / Been There / Favorite), log and edit visits with dates and notes, reach the menu without losing an in-progress visit note, and delete a restaurant along with its visit history. This is the app's quick-win foundation — before the map or search-to-add exist, it has to work standalone as the sole way to build and maintain a restaurant list.

## Stories

- Story 2.1: Add a Restaurant Manually
- Story 2.2: View Your Restaurant List
- Story 2.3: Edit a Restaurant's Details
- Story 2.4: Set Restaurant Status
- Story 2.5: Log Visits & Notes
- Story 2.6: Delete a Restaurant
- Story 2.7: History Tab — Visit Journal
- Story 2.8: Add a Visit from History
- Story 2.9: Menu at the Point of Logging
- Story 2.10: Edit a Visit

## Requirements & Constraints

- Only the restaurant name is required to save; every other field (address, venue type, cuisine, price range, website, menu URL, notes) is optional and the UI must display gracefully with any of them missing.
- New restaurants default to status "Want to Go." Marking a restaurant visited moves it to "Been There" and creates a visit log entry dated today; toggling Favorite from Been There is reversible back to Been There (never all the way back to Want to Go).
- A restaurant can accumulate multiple dated visits, each with an optional per-visit note, plus one general note that persists across all visits — these are distinct fields and must not be conflated.
- Deleting a restaurant must remove it and all of its visit logs from both local storage and the backend, gated by a confirmation step naming the restaurant.
- Every write (add, edit, status change, visit log, delete) must succeed offline and sync automatically with no data loss once connectivity returns.
- All interactive tap targets must meet the 44x44pt minimum, and all text must support iOS Dynamic Type.
- The product must read as a personal journal, not a public directory — no review-prompt or social-performance patterns anywhere in this loop.
- The list view must reflect adds/edits immediately without a manual refresh.
- Story 2.8's restaurant picker reuses the search-matching rules being built in Epic 3 (name/cuisine/neighborhood, case- and diacritic-insensitive substring match) — do not build a second, divergent search implementation for it.

## Technical Decisions

- Local storage is always the source of UI truth; every write applies locally first, then queues for backend sync. On connectivity loss, failed syncs retry with exponential back-off (3 attempts) before surfacing an error to the user.
- All restaurant and visit-log mutations route through the repository + sync-queue layer — never a direct database call from a ViewModel.
- Visit logs were originally write-once: the visit repository exposed only insert and delete, the realtime layer no-op'd on a visit update event, and the remote-pull path skipped rows it already held. Story 2.10 changes this contract by adding a real update path — the realtime no-op and the pull-skip-existing behavior both need to change together, not just the UI.
- Visit edits must preserve the original id and created-at timestamp (an edit is a mutation, never a new row); conflicting edits made on two devices resolve by comparing an edit timestamp, not by sync arrival order.
- `menu_url` is a new nullable text column on restaurants, independent of the visit-log work — "View menu" prefers `menu_url` and falls back to `website`, and is hidden entirely when neither is set.
- The web app's existing visit-logging behavior (auto-transitioning `want_to_go` to `been_there` on first logged visit) is the reference implementation Story 2.8 must match on iOS — parity, not reinvention.

## UX & Interaction Patterns

- Edit mode reuses the same field layout as the add/confirmation flow — one visual pattern for all restaurant data entry, activated inline (no separate edit screen).
- Save success is communicated by a haptic pulse plus sheet dismissal — no toast or banner. Status changes get a light haptic plus an animated visual transition.
- Destructive actions (delete restaurant) require exactly one confirmation step, visually separated from primary/secondary actions, and never fire immediately.
- Swipe-left on a list or history row reveals quick actions (mark visited, edit, delete), using the platform's native destructive-role styling for delete.
- The detail card's collapsed view shows name, venue type, cuisine, price, neighborhood, and the status badge; expanding it reveals notes, the full visit log in reverse-chronological order, and an "Add Visit" action.
- Locally-cached views (list, history) must render instantly with no loading spinner or skeleton, including immediately after an add, edit, or delete.

## Cross-Story Dependencies

- Story 2.8 depends on Story 3.5 (Epic 3, Search Your Restaurants) for its restaurant-picker matching logic — 2.8 cannot ship correctly before that search behavior exists.
- Story 2.10 un-defers two sync-layer decisions originally deferred during the Story 1.5 review (visit-log update propagation and pull-skip-existing behavior); it is a schema, sync, and UI change together, not UI-only.
- Story 2.9 (menu at point of logging) is independent of both 2.8 and 2.10 and can ship on its own.
- Story 2.4 (status) and Story 2.5 (visit logging) are coupled: marking a restaurant visited is itself a visit-log write, so their save paths must stay consistent.
