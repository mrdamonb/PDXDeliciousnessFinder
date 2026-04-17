# Sprint 1 — Story-by-story acceptance checklist

**Source:** `_bmad-output/planning-artifacts/epics.md` (Stories **1.1**–**1.4**, **2.1**–**2.6**)  
**Environment:** Prefer **physical device** + **pdx-dev** Supabase dashboard (you already validated host/keys). Simulator optional.  
**How to use:** Run each **Then** as a pass/fail. Check `[x]` when verified; add **Notes** (date, build, anomaly) in the section at the bottom.

---

## Story 1.1 — App Foundation & Email Sign-In

- [ ] **Fresh install → open app:** Onboarding shows **email + password** and a clear path for **new account** (sign up vs sign in).
- [ ] **Valid credentials → submit:** After Supabase auth succeeds, you land on the **home** (list) experience — not stuck on onboarding.
- [ ] **Previously signed in → open app:** You go **straight to home** (no onboarding) after a normal relaunch (not only after reinstall).
- [ ] **Home → Sign out:** Returned to onboarding; signing in again required; session cleared (Keychain — infer from behavior).
- [ ] **Debug build / Supabase routing:** Client calls go to **your** pdx-dev project (same `SUPABASE_HOST` as dashboard — you already matched xcconfig).
- [ ] **New user → `public.users`:** After **first-ever** auth for a test email, a row exists in **`users`** (or your profile table) with matching user id — *confirm in Table Editor; depends on `handle_new_user` / migration naming.*

---

## Story 1.2 — SwiftData core storage layer

- [ ] **Airplane on → open list:** With **network off**, restaurants saved **earlier** still appear in the list **without** a long loading spinner (local read).
- [ ] **App Group store (architecture):** Model store uses shared App Group path — *quick check: `PersistenceController.appGroupID` matches Signing & Capabilities App Group; optional: confirm store URL in code review.*
- [ ] **Restaurant model (architecture):** Model has the fields and enums expected by epics — *spot-check in Xcode `Restaurant.swift` if you skip runtime inspection.*
- [ ] **VisitLog model (architecture):** Same for `VisitLog.swift` vs epics.
- [ ] **Save → immediate local list:** After Save, the new row appears in the list **before** you rely on Supabase (SwiftData is UI source of truth).

---

## Story 1.3 — Offline write queue (outbound sync)

- [ ] **Online add → save:** Row appears in UI immediately; within a short time row appears in Supabase **`restaurants`** (enqueue + flush).
- [ ] **Offline add → reconnect:** Turn **airplane mode on**, add a restaurant, save; turn **airplane off**; row appears in **Supabase** within **~30s** without re-saving.
- [ ] **Sync fails after 3 retries:** Error surfaced **inline** (ViewState / non-blocking) — *may require simulating failure; optional strict gate.*
- [ ] **Writes route via repository + SyncQueue:** No direct `supabase.from()` from ViewModels — *one-time: Xcode global search in `Features/` for `supabase.` should be clean.*
- [ ] **Offline → online flush order:** If you queue **multiple** offline mutations, they appear remotely in a sensible **FIFO** order after reconnect — *light test: two adds offline.*

---

## Story 1.4 — Realtime inbound sync (multi-device)

- [ ] **Two devices, add on A:** While **Device B** is foregrounded, new restaurant from A appears on B within **60 seconds** — *needs second device or simulator + phone.*
- [ ] **Foreground + Realtime:** Inserts/updates/deletes done in **dashboard or other device** reconcile into local SwiftData — *spot test with Table Editor insert only if policies allow your role; usually second client is easier.*
- [ ] **Background B → foreground B:** After time on A, B catches up on return to foreground (subscription / reconcile).
- [ ] **Remote update + local queue:** No lost **pending** local writes when remote updates arrive — *advanced case; optional if you only single-device.*

---

## Story 2.1 — Add a restaurant manually

- [ ] **Add Restaurant → form:** Only **name** required; address, venue type, cuisine, price optional in the form.
- [ ] **Name + Save:** New row in list with status **Want to Go**.
- [ ] **Name only (no address):** Saves and list/detail read cleanly without blank-looking broken layout.
- [ ] **Offline save → online:** Same as 1.3 offline add path for a manual add.
- [ ] **Empty name + Save:** **Inline** validation; save blocked.

---

## Story 2.2 — View your restaurant list

- [ ] **List rows:** Each row shows **name**, **venue type**, **status badge**, **cuisine** (as applicable).
- [ ] **Tap row → detail:** Card shows **name, address, website, venue type, cuisine, price, status, general note, visit count** (show empty/sensible for missing fields).
- [ ] **Empty list:** Clear **empty state** + prompt to add first restaurant.
- [ ] **New restaurant ordering:** After add, returning to list shows new item **at top** without pull-to-refresh (if that’s current behavior).

---

## Story 2.3 — Edit a restaurant’s details

- [ ] **Edit → fields:** All listed fields editable (name, address, website, venue type, cuisine, price, general note).
- [ ] **Save → UI:** Card and list reflect updates **immediately** after save.
- [ ] **Offline edit → online:** Edit while offline; after reconnect, Supabase row matches — *verify in Table Editor.*
- [ ] **Edit → Cancel:** No persistence of edit session changes.

---

## Story 2.4 — Set restaurant status

- [ ] **New restaurant default:** **Want to Go** in list/detail.
- [ ] **Mark as visited:** Status **Been There** + **visit** created (date = day of action unless you change it in flow).
- [ ] **Been There → Favorite toggle:** Becomes **Favorite**; visually distinct in list.
- [ ] **Favorite → toggle again:** Back to **Been There**, **not** Want to Go.
- [ ] **Status change → list:** Badge updates **without** manual list refresh.

---

## Story 2.5 — Log visits & notes

- [ ] **Mark visited flow:** Visit entry with **today** (or chosen date in sheet) + optional per-visit note path matches product intent.
- [ ] **Add Visit (additional):** Can set **custom date** + optional note for extra visits.
- [ ] **Visit history section:** Visits **newest first**, each with date + note if any.
- [ ] **General note:** Editable field on card persists (not the same as per-visit only).
- [ ] **Per-visit note offline → online:** Syncs after reconnect — *optional if 1.3 already heavily tested.*

---

## Story 2.6 — Delete a restaurant

- [ ] **Delete tap:** Confirmation shows **restaurant name**.
- [ ] **Confirm delete:** Row gone from app list; row gone from **`restaurants`**; related **`visit_logs`** removed in Supabase — *check Table Editor.*
- [ ] **Offline delete → online:** Row removed from Supabase after reconnect.
- [ ] **Cancel delete:** Restaurant unchanged.

---

## Notes (fill as you go)

| Date | Build / scheme | Story | Result | Comment |
|------|----------------|-------|--------|---------|
| | | | | |

---

## When this file is “done”

- All **required** boxes you care about for Sprint 1 are `[x]`.
- Then tick **Sprint 1 closure** in `sprint-plan.md` → *Full story-by-story acceptance sweep from `epics.md`* and proceed to **`[SP] Sprint Planning`** for Sprint 2 when ready.
