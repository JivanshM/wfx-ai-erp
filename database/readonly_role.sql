-- ============================================================
-- Read-only database user for the Natural-Language-to-SQL feature.
--
-- Why: the AI generates SQL from user questions and we execute it.
-- Our backend already checks that the SQL is a SELECT, but as a
-- second, stronger layer the query runs as this user - Postgres
-- itself refuses any INSERT/UPDATE/DELETE/DROP from it.
--
-- Run this once in the Supabase SQL Editor (choose your own password).
-- ============================================================

create user wfx_readonly with password 'your-strong-password';

-- allow it to see the schema and read every table, nothing more
grant usage on schema public to wfx_readonly;
grant select on all tables in schema public to wfx_readonly;

-- tables created later automatically become readable too
alter default privileges in schema public grant select on tables to wfx_readonly;

-- Row Level Security is enabled on all tables, which hides every row
-- from a user unless a policy allows it. These policies say:
-- "wfx_readonly may read all rows" (and still nothing else).
create policy "readonly can read" on suppliers      for select to wfx_readonly using (true);
create policy "readonly can read" on buyers         for select to wfx_readonly using (true);
create policy "readonly can read" on finished_goods for select to wfx_readonly using (true);
create policy "readonly can read" on sales_orders   for select to wfx_readonly using (true);
create policy "readonly can read" on sales_invoices for select to wfx_readonly using (true);
create policy "readonly can read" on tech_packs     for select to wfx_readonly using (true);
