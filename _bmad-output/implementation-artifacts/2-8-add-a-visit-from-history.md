# Story 2.8: Add a Visit from History

**Epic:** 2 — Your Portland Food Journal
**Status:** 🔲 Ready for Dev
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

Make the promotion conditional (`guard restaurant.status == .wantToGo`) rather than adding a second flag. That also corrects the existing "Mark as Visited" path from `RestaurantDetailView`, which has the same latent downgrade today. **This is a behaviour change to shared code — call it out in the Dev Notes rather than slipping it in.**

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
| ARCH-12 | `RestaurantSearch.swift` and `PickRestaurantView.swift` both live under `Features/`; `Core/` must not import them |
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
