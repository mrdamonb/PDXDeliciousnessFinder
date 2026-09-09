---
title: 'Replace the header wordmark with the app logo'
type: 'feature'
created: '2026-09-08'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '4395d061d3fb987e726d01bd2ae9a44e35ec283d'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The header wordmark "PDX Deliciousness Finder" (`HomeView.tsx:106`) already truncates on a phone and eats the header width that story 3's third toggle segment (the visit journal) will need.

**Approach:** Replace the text wordmark with an inline SVG rendering of the app's pin logo, mirroring the existing inline-SVG icon pattern already used for the Map/List toggle, filled in the app's orange (`#C2410C`) rather than the source logo file's orange (`#E14729`).

## Boundaries & Constraints

**Always:**
- Add the logo as an inline SVG React function component in `HomeView.tsx`, following the `MapIcon`/`ListIcon` pattern (`HomeView.tsx:32-52`) — no image file, no `<img>`, no new asset request.
- Fill the pin silhouette `#C2410C`. One orange in the app — this is Damon's decision, not a suggestion.
- Redraw the shape as a plain pin/marker silhouette. Do not attempt to reproduce the "PDX" lettering or the cutlery detail from the source artwork — Damon's call is that neither survives legibly at header size.
- Leave every other header element (height, toggle, add button, user menu, spacing) untouched — this story is the wordmark swap only.

**Ask First:** Any change to header layout, height, or spacing beyond the wordmark→logo swap. The header has two prior repaint regressions (`c096d6a`, `c036895`); anything wider than this swap needs Damon's sign-off before it lands.

**Never:**
- Do not touch the other three, unrelated occurrences of "PDX Deliciousness Finder" — `web/src/app/layout.tsx:5` (page `<title>`), `web/src/app/(auth)/login/page.tsx:44`, `web/src/app/(auth)/signup/page.tsx:39`. Out of scope.
- Do not add a `public/` directory or ship `Assets.xcassets/Logo.imageset/Logo.png` as-is — it has a near-white background against the app's warm `#F7F3EE`, the wrong orange, and artwork filling only ~48% of its canvas.
- Do not change header height or the width given to the Map/List toggle.

</frozen-after-approval>

## Code Map

- `web/src/components/HomeView.tsx:32-52` — `MapIcon`/`ListIcon`: existing inline-SVG function-component pattern to mirror for the new logo mark (24x24 viewBox, sized ~15-18px, no external asset).
- `web/src/components/HomeView.tsx:101-108` — the wordmark `<span>` (text "PDX Deliciousness Finder", already colored `#C2410C`) to remove and replace with the new logo component, inside the same `flex: 1, minWidth: 0` wrapper.
- `PDXDeliciousnessFinder/Assets.xcassets/Logo.imageset/Logo.png` — reference only for the pin's general silhouette; 1024x1024, background (254,254,253), fill `#E14729`. Not to be shipped; redraw as SVG per constraints above.
- `web/src/app/layout.tsx:5`, `web/src/app/(auth)/login/page.tsx:44`, `web/src/app/(auth)/signup/page.tsx:39` — other, unrelated instances of the wordmark text. Confirmed out of scope; do not edit.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/components/HomeView.tsx` -- add a `LogoMark` inline SVG function component near `MapIcon`/`ListIcon`, drawing a solid pin/marker silhouette filled `#C2410C` -- matches the established icon pattern, adds no image request
- [x] `web/src/components/HomeView.tsx` -- replace the wordmark `<span>` (lines ~101-108) with `<LogoMark />` inside the existing `flex: 1, minWidth: 0, overflow: 'hidden'` wrapper -- buys back the width story 3's third toggle segment needs

**Acceptance Criteria:**
- Given the home page header, when it renders, then the "PDX Deliciousness Finder" text is gone and a pin silhouette renders in its place, filled `#C2410C`.
- Given the login page, signup page, and browser tab title, when they render, then their existing "PDX Deliciousness Finder" text is unchanged.
- Given the header before and after this change, when compared, then height, toggle, add button, and user menu are pixel-identical — only the wordmark→logo swap changed.

## Design Notes

Keep the mark simple enough to read at ~20-24px tall: a rounded-top, pointed-bottom pin outline, filled solid (not stroked, unlike `MapIcon`/`ListIcon` which are stroke-only) so it stays legible at small size. A `viewBox="0 0 24 24"` path such as a circle-over-teardrop (classic map-pin glyph) is enough — no need to trace the source PNG's exact curves.

## Verification

**Commands:**
- `cd web && npm run build` -- expected: zero errors
- `cd web && npx tsc --noEmit` -- expected: zero TypeScript errors

**Manual checks (if no CLI):**
- Load the home page in a browser: the header shows the pin mark in `#C2410C` where the wordmark used to be, header height and every other header element are unchanged, and the mark stays crisp (not blurry/pixelated) at header size.
- Confirm the login page, signup page, and browser tab title still read "PDX Deliciousness Finder".

## Suggested Review Order

- New logo mark: solid pin silhouette, filled `#C2410C`, with a `<title>` alongside `aria-label` for accessibility since the visible text is gone.
  [`HomeView.tsx:55`](../../../../web/src/components/HomeView.tsx#L55)

- Swap site: the wordmark `<span>` is replaced with `<LogoMark />` inside the same untouched flex wrapper — the only structural change in the header.
  [`HomeView.tsx:112`](../../../../web/src/components/HomeView.tsx#L112)
