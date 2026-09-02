-- Story 2.9: Menu at the Point of Logging.
--
-- Lets a user save the restaurant's actual menu URL once, so the "View menu"
-- action inside Add Visit lands on the menu rather than the homepage that
-- Google Places returns. Nullable: when it is null both clients fall back to
-- `website`.
--
-- This column was first applied by hand to the linked project on 2026-09-02.
-- Checked in afterwards so the schema travels with the code: without it, a
-- project missing the column fails the whole `getRestaurants` select on web
-- (blank map, not a missing button) and 400s every restaurant upsert on iOS,
-- where SyncQueue discards the operation after three retries.

alter table restaurants add column if not exists menu_url text;
