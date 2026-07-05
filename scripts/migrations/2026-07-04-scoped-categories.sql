-- Migration: side-scoped category taxonomy (run once in Supabase SQL editor)
--
-- What this does, in order:
--   1. Adds a `scope` column to categories (business | personal)
--   2. Clears category assignments from all transactions (spend_type and
--      approval status are UNTOUCHED — only the category label resets)
--   3. Deletes learned merchant rules (they point at old category ids)
--   4. Deletes the old unscoped categories
--   5. Replaces the (user, name) uniqueness with (user, scope, name) so
--      "Travel" can exist on both sides
--
-- The app reseeds the new taxonomy automatically on the next import or
-- "AI categorize" tap, which also re-fills every cleared category.

alter table categories
  add column if not exists scope text
  check (scope in ('business', 'personal'));

update transactions set category_id = null;

delete from merchant_rules;

delete from categories;

alter table categories drop constraint if exists categories_user_id_name_key;
alter table categories
  add constraint categories_user_scope_name_key unique (user_id, scope, name);
alter table categories alter column scope set not null;
