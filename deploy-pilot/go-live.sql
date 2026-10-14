-- Ageing Navigator pilot: clear the test data before the first real family.
--
-- WHO RUNS IT: the user, in the Supabase SQL editor of the client's project (Ageing Navigator, Sydney).
-- WHEN: once Paul has finished testing and approved the content, just before launch.
-- WHAT IT DOES: removes every case (all are fictional or test cases before launch), their family links, coordination
-- requests and feedback (by cascade), the test navigator account, the rate-limit counters, and the event counts, so
-- the pilot's numbers start from zero. Paul's navigator account (paul@ageingnavigator.com) is kept.
-- It cannot be undone. Read the counts first, then run the deletes.

-- 1. Look first.
select count(*) as cases from cases;
select email, disabled_at is not null as disabled from navigators order by created_at;

-- 2. Delete (run as one block).
begin;
delete from cases;
delete from events;
delete from rate_limits;
delete from navigators where email = 'staging-check@example.test';
commit;

-- 3. Check.
select (select count(*) from cases) as cases, (select count(*) from events) as events,
       (select count(*) from navigators) as navigators;
