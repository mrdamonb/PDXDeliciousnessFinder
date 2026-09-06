-- Story 2.10: Edit a Visit.
--
-- Visits were write-once: there was no way to distinguish an edited visit
-- from a stale one when reconciling remote and local copies. This adds
-- `updated_at`, mirroring `restaurants.updated_at`, so `VisitLogRepository`
-- can apply the same last-write-wins comparison (`dto.updatedAt >
-- existing.updatedAt`) that `RestaurantRepository` already uses.
--
-- Existing rows backfill to `now()`. That means the first pull after deploy
-- treats every remote visit as newer than what's stored locally — harmless
-- at deploy time: no visit has gone through the new edit path yet, so every
-- existing row's `note` and `visitedAt` are still identical between local
-- and remote regardless of which one "wins" that first comparison.

alter table visit_logs add column if not exists updated_at timestamptz not null default now();
