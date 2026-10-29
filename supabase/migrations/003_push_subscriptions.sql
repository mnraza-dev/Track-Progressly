begin;
-- Clerk sync: ensure profiles table references Clerk user id and add password/hash fields for local auth compatibility
alter table public.profiles add column if not exists clerk_user_id text;
alter table public.profiles add column if not exists password_hash text;
update public.profiles set clerk_user_id = id::text where clerk_user_id is null;
commit;
