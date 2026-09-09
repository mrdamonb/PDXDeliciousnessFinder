---
title: 'PDX Deliciousness Finder — Web App S6: Parity with the iOS App'
type: 'feature'
created: '2026-09-01'
retired: '2026-09-06'
status: 'superseded'
---

# Superseded — do not plan from this file

This draft was written **2026-09-01** and never approved. It has been absorbed into, and replaced by:

**`_bmad-output/specs/spec-web-s6-parity/`** — `SPEC.md` plus `parity-audit.md`, `edge-cases.md`, `build-plan.md`, `stories.yaml`, and the `.memlog.md` they derive from.

**Why it was retired rather than kept as reference.** Two of its claims went stale and would mislead anyone who read it:

1. It lists **menu at the point of logging** as a web gap. It is not — web shipped it. `RestaurantPanel.tsx:444` renders the "View menu" link inside the inline log form, `EditRestaurantModal.tsx:260` has the Menu URL field.
2. It predates iOS story **2.10, Edit a visit**, which is a parity gap it therefore never mentions.

Its open navigation question is also closed: the journal is a **third segment in the header Map/List toggle**, Damon's decision 2026-09-06.

The full original text is in git history at commit `370c9af` ("Plan Sprint 3 — Logging & Findability"): `git show 370c9af:_bmad-output/implementation-artifacts/spec-wip.md`.
