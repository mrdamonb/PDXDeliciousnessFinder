# Web header redesign, direction 1c: decisions

Source: Claude Design project "Header Logo Options.dc.html" (Turn 1 directions 1a to 1d, Turn 2 frames 2a to 2e). Reviewed with Sally 2026-09-11 to 2026-09-13.

## Decided

| Date | Decision | Who |
|---|---|---|
| 2026-09-11 | Direction **1c**: one 64px bar (logo badge, pill search, avatar); Map/List/Journal as a floating segmented pill with text labels; + as a 56px FAB bottom-right. | Damon |
| 2026-09-13 | **Accept the trade:** map gains 44px, List and Journal give some up. See "The trade, corrected" below; the numbers changed after the first acceptance, and Damon **re-confirmed on the corrected terms** (about 23px shorter List/Journal in every state, not recovered on scroll). | Damon |
| 2026-09-13 | **Filter must exist on List**, not only Map. Design's second pass dropped it; rejected. Design's third pass placed it as a chip at the right end of the pill row (frames 2a/2b). Journal still hides Filter (it ignores filters; story 3) and shows the visit count in that slot. | Damon |
| 2026-09-13 | Search works on Journal, query persists across views, placeholder changes on Journal, query clears after adding a visit from Journal. Tracked as S6 story 6, independent of the header work. | Damon |
| 2026-09-13 | **Badge tap returns to Map, keeping filters and search.** The badge is a button, not a static image. | Damon |
| 2026-09-06 | Logo pin in `#C2410C`, not the file's `#E14729`. Turn 2 asset `assets/pdx-logo-brand.png` is recolored. | Damon |

## The trade, corrected (Design third pass, 2026-09-13)

Damon accepted the trade when the design showed List content at 140px at rest, **mostly recovered on scroll** by a fading scrim behind the pill. The third pass changed both halves:

| | Today | 1c, second pass | 1c, third pass |
|---|---|---|---|
| List content starts (at rest) | 108 (sort row) | 140 | 131 (sort row, `padding-top: 67px`) |
| Scrolled | 108 | rows ghost under a fading scrim | **opaque band 64 to 123**, 12px fade, next whole row at 135 |

So the loss is smaller at rest (23px, not 32) but **no longer recovered on scroll**: List and Journal are about 23 to 27px shorter than today in every state. Surfaced to Damon rather than absorbed into the earlier acceptance.

## Resolved by Design's third pass

- **Journal month headers:** no count, no month chip in the pill. `HistoryView`'s existing sticky headers stay; only their sticky `top` offsets to the pill's bottom edge (frame 2d). This was Sally's lean; **confirmed by Damon 2026-09-13**.
- **Logo keeps "PDX"** (Damon, 2026-09-13, "at least for now"): the full mark goes in the 1c badge, not the simplified fork + spoon pin. Provisional; the simplified pin (frame 2e) stays on file as the fallback if the phone test disappoints.
- **Frames now match the real app:** `ListView`'s flat rows and A–Z / Latest sort row; `HistoryView`'s flat rows with the edit pencil.

## Open

- **Filter chip with filters active.** Only the zero state is drawn. The active count badge from `FilterButton.tsx` must carry over.
- **Match highlighting** in Journal search results (frame 2c). **Deferred by Damon 2026-09-13**: not added to story 6 (already in review), and no follow-up story written. Damon will decide later whether it is needed at all.

## Build order (Sally's recommendation)

1. Badge + recolored logo in the current header, nothing else moves. Small, isolated, easy to revert; the header has two prior repaint regressions.
   **Built 2026-09-13, not yet committed.** `HomeView.tsx`: `LogoMark` SVG replaced by `LogoBadge` (44px cream badge, radius 14, logo at 30px, a `<button>`). Asset `web/src/assets/pdx-logo.png` (75×96, from Design's recolored `pdx-logo-brand.png`, re-encoded without metadata), loaded via `next/image` static import, `unoptimized`. `tsc` and `npm run build` pass. Checked with a stand-alone render of the header at 390 and 320px at 3x; the real signed-in page has not been seen yet.
   **Assumption to confirm:** tapping the badge also closes an open restaurant panel (`setSelectedId(null)`), reading "back to Map" as a clean map.
2. The 1c restructure: merged bar, floating pill, FAB, Filter chip on Map and List, pill-clearance padding and opaque band on List and Journal, Journal sticky-header offset, FAB hidden while the restaurant panel is up.

## Constraints carried into the build

- `FilterButton.tsx`, `FilterPopover.tsx`, and the List/Journal wrappers position from `TOP_BAR_HEIGHT` in `HomeView.tsx`; all change with the merged bar.
- Touch targets at least 44×44 (Turn 2 pill segments are 44px tall).
- FAB: add restaurant on Map/List, add visit on Journal (existing `HistoryView` FAB). Hidden while a bottom sheet is up, per the UX spec's FAB visibility rule.
