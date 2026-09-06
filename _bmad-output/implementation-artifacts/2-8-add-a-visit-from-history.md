# Story 2.8: Add a Visit from History

**Epic:** 2 — Your Portland Food Journal
**Status:** ✅ Done — device-verified 2026-09-05
**Effort:** Small–Medium (one new picker screen, one lifted predicate, no schema, no backend)
**Story file written:** 2026-09-02, from `epics.md:611`

---

## User Story

As a Portland food enthusiast,
I want to log a visit directly from the History tab,
So that recording where I ate does not require finding the restaurant on another screen first.

---

## Dependencies, as of 2026-09-02

| Story | State | Bearing on this one |
|---|---|---|
| 3.5 Search | ✅ Done, device-verified | The picker reuses its matching rules. **The predicate is private and must be lifted — see Technical Notes.** |
| 1.5 Visit sync | 🟡 `review` — committed, build green, **not device-verified** | This story adds another way to write visits into History. If 1.5 turns out to misbehave on device, symptoms will surface here and look like this story's fault. **Verify 1.5 on device before starting, or accept that risk knowingly.** |
| 2.9 Menu at logging | ✅ Done | `AddVisitView` gained a "View menu" action; the picker path inherits it for free. |

---

## Acceptance Criteria

**Given** I am on the History tab
**When** I tap the `+` button
**Then** I get a searchable picker of my own restaurants — **not** the Add Restaurant form, which is what it opens today

---

**Given** the restaurant picker is open
**When** I type into its search field
**Then** the list narrows using the same matching rules as Story 3.5 — name, cuisine and neighborhood, case- and diacritic-insensitive, substring not prefix

---

**Given** I select a restaurant from the picker
**When** the selection registers
**Then** `AddVisitView` opens for that restaurant with today's date pre-filled

---

**Given** I save the visit
**When** the sheet dismisses
**Then** the new entry is visible in the History list immediately, without backgrounding and reopening the app

---

**Given** the restaurant I picked has status `want_to_go`
**When** the visit saves
**Then** its status becomes `been_there`, matching what the web app already does in `logVisit`

---

**Given** the restaurant I picked is a `favorite`
**When** the visit saves
**Then** it stays a `favorite` — logging a visit must never downgrade a status

---

**Given** I have no restaurants at all
**When** I tap `+`
**Then** the picker shows an empty state offering to add a restaurant, not a dead blank list

---

## Technical Notes

### The search predicate is private and must be lifted first

`RestaurantListView.matches(_:_:)` carries a comment saying *"Story 2.8's restaurant picker reuses this predicate"* — but it is a `private func` on the View, so **it is not reachable**. Lift it before writing the picker, or the two search behaviours will drift the first time either changes.

Follow the `HistoryGrouping` precedent from story 1.5: a pure function in its own file, no state, no view.

```
Features/RestaurantList/RestaurantSearch.swift

enum RestaurantSearch {
    static func matches(_ restaurant: Restaurant, _ query: String) -> Bool
}
```

Keep the empty-query guard exactly as it is — `"abc".localizedStandardContains("")` is `false`, so without it an empty query matches nothing rather than everything. `RestaurantListView` then calls the lifted version and loses its private copy.

### Status promotion: do not pass `markVisited: true` unchanged

`AddVisitView` already takes `markVisited: Bool`, and its `save()` does:

```swift
if markVisited {
    restaurant.status = .beenThere
}
```

That is **unconditional**. Passing `markVisited: true` from the picker would downgrade a `favorite` restaurant to `been_there` — which the sixth AC forbids, and which the web app does not do. `actions.ts logVisit` promotes only when the status is `want_to_go`.

Make the promotion conditional (`guard restaurant.status == .wantToGo`) rather than adding a second flag. **This is a behaviour change to shared code — call it out in the Dev Notes rather than slipping it in.**

> **Corrected 2026-09-02 during review.** This section originally claimed the change "also corrects the existing 'Mark as Visited' path from `RestaurantDetailView`, which has the same latent downgrade today." **That was wrong.** `RestaurantDetailView.swift:48` gates that button behind `if restaurant.status == .wantToGo`, so the only pre-existing caller could never reach a `favorite` — the downgrade was unreachable, not latent. The code change is still correct and necessary, but only for the new picker path. The error originated here, went into the dev-agent prompt, and was restated in the Dev Notes as verified behaviour.

### The "visible immediately" AC is already satisfied — do not build a reload path

The epic text for this story predates story 1.5's review. **History is now `@Query`-backed** (`HistoryView.init(userId:)`), filtered by user and sorted by `visitedAt` descending, so a saved visit appears with no refresh plumbing at all. `AddVisitView.save()` also sets `visitLog.restaurant = restaurant`, so the row is renderable the moment it lands.

Do not add an `onSave` reload, a notification, or a manual re-fetch. If the row does not appear, the bug is in 1.5's `@Query` wiring, not here.

### Where the picker lives

`Features/RestaurantList/PickRestaurantView.swift` — it is list-shaped and belongs beside the list it mirrors, not in `Features/History`.

It needs the user's restaurants, so take `userId` and use `@Query` with the same filter `RestaurantListView` uses. Present it as a `.sheet` from `HistoryView`, replacing the current `AddRestaurantView` sheet. On selection, present `AddVisitView` — either pushed inside the picker's own `NavigationStack` or by swapping the sheet content.

**Do not remove the ability to add a restaurant from History.** The `+` currently opens `AddRestaurantView`; the empty state (last AC) still needs to reach it, and a user with no restaurants must not be stranded.

### Architecture constraints

| Constraint | Requirement |
|---|---|
| ARCH-9 | The visit saves through `visitLogRepository`, as `AddVisitView` already does. No direct `supabase.from()` |
| ARCH-12 | `RestaurantSearch.swift` and `PickRestaurantView.swift` both live under `Features/`; `Core/` must not import them, **and the ShareExtension imports `Core/` only** — so every new `Features/` file needs an entry in the ShareExtension `membershipExceptions` in `project.pbxproj`, or it silently becomes an extension member. A green build does not test this; enumerate the list |
| ARCH-13 | Data access through the repository or `@Query`, not ad hoc model queries in a ViewModel |

### Renaming or deleting a Swift file

If lifting `matches` means deleting or renaming a file listed in `project.pbxproj`'s ShareExtension `membershipExceptions`, update that entry or the build fails with *"Build input file cannot be found"*. Adding a new file needs no entry. See `CLAUDE.md`.

---

## Files to Create

| File | Purpose |
|---|---|
| `Features/RestaurantList/RestaurantSearch.swift` | The lifted `matches(_:_:)` predicate, shared by the list and the picker |
| `Features/RestaurantList/PickRestaurantView.swift` | Searchable picker over the user's restaurants, with an empty state |

## Files to Modify

| File | Change |
|---|---|
| `Features/History/HistoryView.swift` | `+` opens the picker instead of `AddRestaurantView` |
| `Features/RestaurantList/RestaurantListView.swift` | Call the lifted predicate; drop the private copy |
| `Features/RestaurantDetail/AddVisitView.swift` | Promote status only from `.wantToGo` |

No schema change. No web change. No Edge Function change.

---

## Out of Scope

- Adding a restaurant from inside the picker beyond reaching the existing `AddRestaurantView`
- Multi-select or logging several visits at once
- Any change to how History renders, groups, or searches
- Web parity for this flow — that belongs to the S6 spec
- The deferred cascade-delete question from the 1.5 review

---

## Verification

Build first: `xcodebuild -scheme PDXDeliciousnessFinder -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`. There is no test target in this repo, so a green build plus a device pass is the whole story.

On device:

- History `+` opens the picker, not the Add Restaurant form
- Typing narrows by name, by cuisine, and by neighborhood
- Selecting a restaurant opens Add Visit with today's date
- Saving returns to History and **the new entry is already there**
- A `want_to_go` restaurant becomes `been_there`
- **A `favorite` restaurant is still a `favorite`** — the regression this story is most likely to introduce
- A fresh account with no restaurants gets an empty state that leads somewhere
- The List tab's search still behaves exactly as before, after the predicate was lifted
- **Open `RestaurantDetailView` and use its own "Mark as Visited" and "Add Visit" actions.** `AddVisitView.save()` is shared code that this story changed; no other item on this list opens that screen
- **Confirm no `Features/` file leaked into the ShareExtension.** Compare `find Features -name '*.swift'` against the `membershipExceptions` list in `project.pbxproj` — they should differ by nothing. The build stays green either way, which is why this needs checking by hand

---

## Dev Notes

**Status:** implemented, build green, **not device-verified**.

- Lifted `matches(_:_:)` out of `RestaurantListView` into `RestaurantSearch.swift` verbatim, including the empty-query guard. `RestaurantListView` now calls `RestaurantSearch.matches` and its private copy is gone.
- `PickRestaurantView.swift` is a `@Query`-backed picker over the user's restaurants (same filter/predicate shape as `RestaurantListView`), reusing `RestaurantRowView` for rows. Empty state offers "Add Restaurant", opening the existing `AddRestaurantView` sheet — the `+` on History still reaches restaurant creation, just one level deeper (History → picker → Add Restaurant), satisfying the "do not remove the ability to add a restaurant from History" note.
- Selecting a restaurant presents `AddVisitView(restaurant:markVisited: true)` as a `.sheet(item:)`. Its `onSave` closure calls `dismiss()` on the picker, so saving collapses both sheets back to History in one action — no extra reload/notification plumbing was added, per the technical notes.
- `HistoryView` now stores `userId` as a property (previously used only inline in `init` to build the `@Query` filter) so it can be threaded through to `PickRestaurantView(userId:)`. The `+` button now sets `showPickRestaurant` and presents `PickRestaurantView` instead of `AddRestaurantView` directly.
- **Behavior change to shared code, called out per the technical notes:** `AddVisitView.save()`'s status promotion was unconditional (`if markVisited { restaurant.status = .beenThere }`), which would downgrade a `favorite` to `been_there` whenever `markVisited: true` was passed — whenever `markVisited: true` was passed. Changed the guard to `if markVisited && restaurant.status == .wantToGo`, matching the web app's `logVisit`.

  ⚠️ **Corrected during review, 2026-09-02.** This note originally claimed the fix also corrected the pre-existing "Mark as Visited" action on `RestaurantDetailView`, and that the downgrade was a latent bug there. **It was not reachable:** `RestaurantDetailView.swift:48` renders that button only `if restaurant.status == .wantToGo`. The guard is still correct and still required — but only for this story's new picker path, which is the first caller that can pass `markVisited: true` for a restaurant of any status. The claim came from the story file's Technical Notes and was repeated here in good faith.
- **Build-system note:** `PickRestaurantView.swift` is a new file under `Features/RestaurantList/`, which Xcode's synchronized groups auto-add to *both* app targets — including `ShareExtension`, which does not carry `AddRestaurantView`/`AddVisitView`/`RestaurantRowView` (they're excluded via `membershipExceptions` since the extension doesn't link Supabase). First build failed in the `ShareExtension` target with "cannot find X in scope" for those three types. Fixed by adding `Features/RestaurantList/PickRestaurantView.swift` to the existing ShareExtension `membershipExceptions` list in `project.pbxproj`, alongside its siblings (`AddRestaurantView.swift`, `AddVisitView.swift`, `RestaurantListView.swift`, `RestaurantRowView.swift`). `RestaurantSearch.swift` needed no such entry — it only depends on `Restaurant` (Core), which the extension already sees.

### Acceptance criteria verified

Verified by build only — **all require a device pass, not yet done**:

| AC | Status |
|---|---|
| `+` opens picker, not Add Restaurant form | Implemented, not device-verified |
| Search narrows by name/cuisine/neighborhood, same rules as 3.5 | Implemented (shared predicate), not device-verified |
| Selecting a restaurant opens `AddVisitView` with today prefilled | Implemented (`visitedAt` defaults to `.now`, unchanged), not device-verified |
| Saved visit appears in History immediately | Relies on 1.5's `@Query` wiring, unchanged by this story; not device-verified, and 1.5 itself is not device-verified |
| `want_to_go` → `been_there` on save | Implemented, not device-verified |
| `favorite` stays `favorite` on save | Implemented (this is the fix above), not device-verified |
| Empty state (zero restaurants) offers a way to add one | Implemented, not device-verified |

A green `xcodebuild` is the only verification actually performed. Per this story's own risk note and CLAUDE.md, story 1.5 (visit sync / `@Query`-backed History) is also not device-verified — if visits don't appear or sync correctly on device, check 1.5's wiring before assuming this story's code is at fault.

---

## File List

- `PDXDeliciousnessFinder/Features/RestaurantList/RestaurantSearch.swift` (new) — lifted, pure `matches(_:_:)` predicate
- `PDXDeliciousnessFinder/Features/RestaurantList/PickRestaurantView.swift` (new) — searchable restaurant picker
- `PDXDeliciousnessFinder/Features/RestaurantList/RestaurantListView.swift` (modified) — calls `RestaurantSearch.matches`, drops the private predicate
- `PDXDeliciousnessFinder/Features/History/HistoryView.swift` (modified) — `+` presents `PickRestaurantView` instead of `AddRestaurantView`; stores `userId`
- `PDXDeliciousnessFinder/Features/RestaurantDetail/AddVisitView.swift` (modified) — status promotion only from `.wantToGo`
- `PDXDeliciousnessFinder.xcodeproj/project.pbxproj` (modified) — added `PickRestaurantView.swift` to ShareExtension `membershipExceptions`

## Change Log

| Date | Change |
|---|---|
| 2026-09-02 | Implemented story 2.8: lifted `RestaurantSearch`, added `PickRestaurantView`, wired History's `+` to it, fixed the `favorite`-downgrade bug in `AddVisitView.save()` (affects both this story's path and the existing "Mark as Visited" path), fixed a `PickRestaurantView` ShareExtension membership gap. Build green. Moved to `review` — no device verification performed. |

---

## Review Findings

Code review 2026-09-02. **Two layers run as subagents** (Edge Case Hunter, Acceptance Auditor); **Blind Hunter and Verification Gap were run inline by the reviewer** at Damon's direction, to conserve context on a 200-line diff. Recorded so the method is on the record rather than implied. Build verified here: `xcodebuild` **BUILD SUCCEEDED**.

**All four traps the story named were hit.** The predicate was lifted verbatim to `RestaurantSearch` with the empty-query guard intact and the private copy removed; status promotion is conditional on `.wantToGo`, so `.favorite` and `.beenThere` both no-op; no reload path was built and `HistoryView`'s `@Query` is untouched; and the empty-state route to `AddRestaurantView` survives. Out of Scope was respected in full.

- [ ] [Review][Patch] **`RestaurantSearch.swift` is compiled into the ShareExtension, violating ARCH-12** [PDXDeliciousnessFinder.xcodeproj/project.pbxproj] — `PickRestaurantView.swift` was added to the ShareExtension `membershipExceptions`; `RestaurantSearch.swift` was not. Verified by enumeration: **16 `.swift` files under `Features/`, 15 in the exception list — `RestaurantSearch.swift` is the only `Features/` file that is a member of the extension target.** `HistoryGrouping.swift`, the precedent the story told the dev to follow, *is* excluded. The build is green because the file only depends on `Restaurant` (Core), which is the wrong test: ARCH-12 says the extension imports `Core/` only. The file's location is correct — both call sites live in `Features/RestaurantList/`, and moving it to `Core/` would be the real inversion. **Fix is the missing exception entry, not a move.** **high**
- [ ] [Review][Patch] **Adding a restaurant from History is now impossible for anyone who already has one** [Features/RestaurantList/PickRestaurantView.swift:48] — the story's Technical Notes say "Do not remove the ability to add a restaurant from History." The only route to `AddRestaurantView` is the button inside `noRestaurantsState`, which renders only `if restaurants.isEmpty`. The picker's toolbar carries `Cancel` alone. **The miss lands on the most likely real path:** the user who just ate somewhere new taps `+`, types the name, gets `ContentUnavailableView.search` — a dead end. This is in scope: Out of Scope excludes only adding *beyond* reaching the existing `AddRestaurantView`, which permits a toolbar `+` wired to the sheet already declared on the same view. **high**
- [ ] [Review][Patch] **The log-a-visit sheet is titled "Mark as Visited"** [Features/RestaurantDetail/AddVisitView.swift:66] — the picker passes `markVisited: true`, which is the correct value for the status ACs, but the flag also drives `.navigationTitle(markVisited ? "Mark as Visited" : "Add Visit")`. A user who tapped `+` on History to log a visit gets a sheet headed "Mark as Visited". Decouple the title from the promotion flag. **medium**
- [ ] [Review][Patch] **The story file's "latent downgrade" claim is false, and the Dev Notes repeat it** — the Technical Notes assert that making promotion conditional "also corrects the same latent downgrade in the existing Mark as Visited path". It does not: `RestaurantDetailView.swift:48` gates that button behind `if restaurant.status == .wantToGo`, so the only pre-existing caller could never reach a `favorite`. **The downgrade was unreachable, not latent.** The code change remains correct and necessary for the new picker path. This error originated in the story file (written by the reviewer on 2026-09-02), propagated into the dev-agent prompt, and was restated in the Dev Notes as verified behaviour. Correct all three. **medium**
- [ ] [Review][Patch] **The story's ARCH-12 row restates only half the constraint** — it says "`Core/` must not import them", dropping the "ShareExtension imports `Core/` only" clause that `epics.md:106` and `CLAUDE.md` both carry. That omission is the direct cause of the first finding above. **low**
- [ ] [Review][Patch] **The Verification list does not cover what the change actually touches** — the Technical Notes call `AddVisitView.save()` "a behaviour change to shared code", yet no verification item opens `RestaurantDetailView`. The story also warns about `project.pbxproj` edits, yet no item exercises the ShareExtension target — which is exactly the defect class of finding 1. **low**

- [x] [Review][Defer] **The selected restaurant can be deleted while the visit sheet is open** [Features/RestaurantList/PickRestaurantView.swift:41] — deferred, pre-existing class. `.sheet(item: $selectedRestaurant)` holds a live `@Model`; a realtime or local delete while the sheet is up could crash or save a `VisitLog` against a deleted restaurant. Note realtime deletes do not currently work at all (see the 1.5 review), which is the only reason this is not reachable today.
- [x] [Review][Defer] **Partial failure leaves a saved visit with an unsaved status change** [Features/RestaurantDetail/AddVisitView.swift:94] — deferred, pre-existing. If `restaurantRepository.update` throws after `visitLogRepository.save` succeeded, the error surfaces and the user retries Save, writing a second visit for the same night. The two writes are not atomic.
- [x] [Review][Defer] **A second tap during the presentation animation changes the sheet's item identity** [Features/RestaurantList/PickRestaurantView.swift:59] — deferred, speculative. Guarding on `selectedRestaurant == nil` before assigning would settle it.
- [x] [Review][Defer] **Two chained sheets, mixing `isPresented:` and `item:`** [Features/RestaurantList/PickRestaurantView.swift:34-41] — deferred to the device pass rather than patched. `RestaurantDetailView.swift:173-180` already chains **three** `.sheet` modifiers on one view and is device-verified, so the pattern has precedent here. The `isPresented:`/`item:` mix and the empty-state route are the untested parts.

**Dismissed as noise (2):**
1. *"Two sheet modifiers mean the Add Restaurant sheet will never present."* Stated as a defect; the codebase already chains three sheets on a device-verified screen. Downgraded to a device-verification item above rather than treated as broken.
2. *"`restaurantRepository.update` no longer fires for non-`wantToGo`, so `updatedAt` is not bumped."* No regression: the only pre-existing caller was gated to `.wantToGo`, so that path is unchanged, and on the new path nothing about the restaurant changed — skipping the write is correct, not a dropped update.

---

## Review Patches Applied, 2026-09-02

All 6 applied. **`xcodebuild` BUILD SUCCEEDED** afterwards, and the ARCH-12 invariant is now verified by enumeration rather than assumed:

```
comm -23 <(find Features -name '*.swift' | sed 's|.*/Features/|Features/|' | sort) \
         <(grep -o 'Features/[A-Za-z/]*\.swift' project.pbxproj | sort -u)
```

returns empty — no `Features/` file is a member of the ShareExtension target.

| Fix | Where |
|---|---|
| `RestaurantSearch.swift` added to the ShareExtension `membershipExceptions` | `project.pbxproj` |
| Add Restaurant reachable from the picker's toolbar, not only from the empty state | `PickRestaurantView` |
| Sheet title decoupled from the promotion flag — the picker passes `title: "Add Visit"` | `AddVisitView`, `PickRestaurantView` |
| False "latent downgrade" claim corrected at source and in the Dev Notes | this file |
| ARCH-12 row now carries the ShareExtension clause it was missing | this file |
| Verification list covers `RestaurantDetailView` and the extension-membership check | this file |

**On the title change:** `markVisited` now means "promote a `want_to_go` restaurant", and the wording is the caller's business. `RestaurantDetailView`'s two entry points are untouched and still read "Mark as Visited" and "Add Visit" as before.

### Still outstanding — device pass

The story's Verification list, plus the two items the review added. The ones most likely to fail:

- **Log a visit against a `favorite`** and confirm it is still a favorite afterwards. This is the regression the story most invites and no build can catch it
- **From the picker, tap the toolbar `+`** with restaurants already in the list — the newly added path, and the one that exercises two sheets on one view
- **`RestaurantDetailView`'s own "Mark as Visited" and "Add Visit"**, since `AddVisitView.save()` is shared code this story changed

---

## Device Defect Found and Fixed, 2026-09-02

**Reported by Damon from his phone:** *"When I try to log a visit I hit view menu to copy what I had, but when I close it the whole window closes and puts me back to the history page. So I have to select the restaurant and start again."*

**Cause: sheet depth.** The picker presented `AddVisitView` as a sheet on top of its own sheet, so tapping "View menu" made Safari the **third** sheet in a chain — History → picker → Add Visit → Safari. Dismissing the innermost one collapsed the whole chain back to History, taking the half-entered visit with it.

The path device-verified for story 2.9 is only **two** deep — `RestaurantDetailView` (pushed, not presented) → Add Visit → Safari — which is exactly why 2.9 tested clean and this did not.

**Fix: the picker no longer presents anything.** It reports the chosen restaurant through an `onSelect` closure and dismisses itself; `HistoryView` then presents `AddVisitView` from its own `.sheet(isPresented:onDismiss:)` hook, once the picker has actually gone. Two sheets in sequence rather than stacked, matching the topology that works.

**`AddVisitView` and `RestaurantDetailView` were not touched**, deliberately — the 2.9 path Damon had already verified stays exactly as it was, so this fix cannot regress it.

**Trade-off accepted:** picking now costs a close-then-open animation rather than a single push. Slightly less slick, and reliable. The alternative — pushing `AddVisitView` inside the picker's `NavigationStack` — would have been smoother but required restructuring `AddVisitView` to work both pushed and presented, putting the already-verified 2.9 path at risk for a cosmetic gain.

Build green after the fix. **Needs a re-test on device:** pick a restaurant, tap View menu, close Safari, and confirm the visit form is still there with the date and any typed note intact.

### What this says about the review

The review deferred *"two chained sheets, mixing `isPresented:` and `item:`"* to the device pass, noting `RestaurantDetailView` already chains three modifiers on one view as precedent. **That reasoning was wrong in an instructive way:** chaining several sheet modifiers on one view is fine, and is what the precedent showed. Nesting sheets three levels deep is a different thing entirely, and nothing in the diff made the depth visible — it only emerges by tracing the presentation chain from `HistoryView` outward. Worth checking presentation *depth*, not just modifier count, whenever a new sheet is added to something that is itself presented.

---

## Device Defect Recurred, 2026-09-05

**Reported by Damon:** "tapped View menu, still closes everything." Confirmed on follow-up: Safari opens fine; tapping Safari's own **Done** button is what collapses the chain back to History.

**First attempted fix (delay) did not work.** Assuming the two-sheet-in-sequence topology was sound and the remaining gap was timing — presenting `AddVisitView` synchronously inside the picker's `onDismiss` might attach it to a not-yet-torn-down presentation context — a 300ms delay was inserted before presenting `AddVisitView`. Device-tested: bug persisted unchanged. This rules out pure timing as the cause and points at the two-independent-`.sheet`-modifiers structure itself, not the gap between them.

**Real fix: collapse two sheet modifiers into one.** `HistoryView` had two sibling modifiers on the same view — `.sheet(isPresented: $showPickRestaurant, ...)` and `.sheet(item: $visitRestaurant)`. Even presented sequentially rather than stacked, two separate `.sheet` modifiers on one view is a documented SwiftUI trouble spot: the framework's tracking of which presented view controller owns which content can get confused across a dismiss-then-present handoff between them, which likely explains why a `dismiss()` call originating from Safari's delegate callback (deep inside the second sheet's content) ended up collapsing further than intended.

Replaced both with a single `HistorySheet` enum (`.pick` / `.addVisit(Restaurant)`) and one `.sheet(item: $activeSheet)`. Selecting a restaurant in `PickRestaurantView` no longer calls `dismiss()` — it only reports the choice via `onSelect`, and `HistoryView` swaps `activeSheet` from `.pick` to `.addVisit(restaurant)` in place. There is now exactly one UIKit presentation for the History `+` flow at any time, with `AddVisitView`'s own Safari sheet nesting one level under that single presentation — structurally identical to the already-verified `RestaurantDetailView` → Add Visit → Safari path, but arrived at by removing the second presentation event entirely rather than by spacing it out.

**Trade-off changed:** picking a restaurant is no longer a close-then-reopen animation — it's an in-place content swap on the same presented sheet, since there's no separate dismiss/present cycle to animate. Likely feels snappier, but is unverified on device.

`AddVisitView` and `RestaurantDetailView` remain untouched.

Build green. **Needs a device re-test**, same checklist as before: pick a restaurant, tap View menu, tap Safari's Done, confirm the visit form (date + any typed note) is still there — plus a general check that the picker → Add Visit transition still feels right without the close/reopen animation.

---

## Device Defect, Actual Root Cause Found, 2026-09-05

**Reported by Damon:** "Same thing. However if I swipe the menu down it closes properly and does not crash the visit." This is the finding that broke the case open — **swipe-to-dismiss works, tapping Safari's own Done button does not.** Everything above this point (sheet depth, delay, collapsing two `.sheet` modifiers into one) was chasing the presentation *topology*, which was never the actual bug. The topology fix was arguably still worth doing, but it could never have fixed this.

**Real cause: `SafariView.swift`'s `SFSafariViewControllerDelegate` never dismissed the controller.** Per Apple's documented contract, `safariViewControllerDidFinish(_:)` fires when Done is tapped, and **the delegate is responsible for calling `dismiss(animated:)` on the controller** — tapping Done does not dismiss it automatically. The existing implementation only did `onFinish?()`, i.e. flipped the SwiftUI `menuLink` binding to `nil`, and relied on SwiftUI's `.sheet(item:)` to notice and dismiss the controller from the outside. Swipe-to-dismiss never went through this delegate at all — it's UIKit's own interactive transition — which is exactly why it worked while Done did not.

The mismatch — Safari internally expecting an explicit dismiss call it never got, while SwiftUI's binding-driven dismiss fired independently — is what let the collapse cascade up through every sheet above it, not just Safari's own.

**Fix:** call `controller.dismiss(animated: true) { onFinish?() }` inside `safariViewControllerDidFinish`, so the controller is dismissed the way its own API contract requires, and the SwiftUI binding only clears once that dismissal has actually completed — removing the race between "UIKit thinks it's still presented" and "SwiftUI thinks it's already gone."

This is shared code (`SafariView.swift`, used only from `AddVisitView.swift:67`), and was never exercised by story 2.9's device pass hitting this exact combination (Done button, not swipe) — which is why it shipped originally as "device-verified."

Build green. **Needs a device re-test**: pick a restaurant, tap View menu, tap Safari's **Done** button specifically (not swipe), confirm the visit form is still there. Also worth re-checking the `RestaurantDetailView` → Add Visit → Safari → Done path, since this is shared code and that path had the same latent bug, just never triggered during 2.9's pass.

**Device-verified 2026-09-05:** Damon confirmed — "worked, closing properly now." Combined with his earlier "otherwise 2.8 works as intended" (covering the rest of the story's Verification checklist), this story is fully device-verified.
