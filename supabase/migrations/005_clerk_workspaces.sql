-- Keep workspace UUIDs and existing data while authenticating with Clerk's text subject.
begin;
create unique index profiles_clerk_user_id on public.profiles(clerk_user_id);
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column supabase_user_id uuid unique references auth.users(id) on delete cascade;
update public.profiles set supabase_user_id=id;
alter table public.profiles drop constraint profiles_id_fkey;
-- Session owners can edit preferences, but only trusted database operations may link identities.
revoke update on public.profiles from authenticated;
grant update(display_name,timezone,daily_minutes,auto_complete,weekend_rest,updated_at) on public.profiles to authenticated;

-- Workspace records belong to a profile, including profiles without a Supabase Auth account.
do $$ declare fk record; begin
  for fk in
    select c.conname,c.conrelid::regclass as target,a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='auth.users'::regclass
      and c.connamespace='public'::regnamespace and cardinality(c.conkey)=1
      and a.attname='user_id'
      and c.conrelid in ('public.courses'::regclass,'public.course_videos'::regclass,
        'public.video_progress'::regclass,'public.video_notes'::regclass,'public.practice_tasks'::regclass,
        'public.video_bookmarks'::regclass,'public.learning_goals'::regclass,'public.learning_sessions'::regclass,
        'public.import_limits'::regclass,'public.learning_rewards'::regclass,
        'public.lesson_quizzes'::regclass,'public.lesson_quiz_attempts'::regclass)
  loop
    execute format('alter table %s drop constraint %I',fk.target,fk.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete cascade',fk.target,fk.conname,fk.attname);
  end loop;
end $$;

create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.profiles(id,supabase_user_id,clerk_user_id,display_name)
    values(new.id,new.id,new.id::text,left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
  return new;
end $$;

create function public.workspace_user_id() returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  select id from public.profiles where clerk_user_id=auth.jwt()->>'sub' or supabase_user_id::text=auth.jwt()->>'sub'
$$;
revoke all on function public.workspace_user_id() from public;
grant execute on function public.workspace_user_id() to authenticated;

create function public.ensure_workspace_profile() returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare subject text:=auth.jwt()->>'sub'; account uuid;
begin
  if subject is null or subject='' then raise exception 'UNAUTHORIZED'; end if;
  select public.workspace_user_id() into account;
  if account is not null then return account; end if;
  if subject not like 'user\_%' escape '\' then raise exception 'UNAUTHORIZED'; end if;
  insert into public.profiles(clerk_user_id) values(subject)
    on conflict(clerk_user_id) do update set clerk_user_id=excluded.clerk_user_id returning id into account;
  return account;
end $$;
revoke all on function public.ensure_workspace_profile() from public;
grant execute on function public.ensure_workspace_profile() to authenticated;

-- Replace the identity lookup in the existing policies without changing their ownership checks.
do $$ declare policy record; statement text; begin
  for policy in select * from pg_policies where schemaname='public'
    and tablename in ('profiles','courses','course_videos','video_progress','video_notes',
      'practice_tasks','video_bookmarks','learning_goals','learning_sessions','learning_rewards',
      'lesson_quizzes','lesson_quiz_attempts')
  loop
    statement:=format('alter policy %I on public.%I',policy.policyname,policy.tablename);
    if policy.qual is not null then statement:=statement||' using ('||replace(policy.qual,'auth.uid()','public.workspace_user_id()')||')'; end if;
    if policy.with_check is not null then statement:=statement||' with check ('||replace(policy.with_check,'auth.uid()','public.workspace_user_id()')||')'; end if;
    execute statement;
  end loop;
end $$;

-- RPCs keep their UUID ownership checks, locks, validations, and grants.
do $$ declare routine record; begin
  for routine in select pg_get_functiondef(p.oid) as definition from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname in (
      'import_course','update_course_completion','save_video_progress','refresh_course_metadata',
      'consume_import_quota','learning_analytics','sync_learning_rewards','save_lesson_quiz','submit_lesson_quiz')
  loop
    execute replace(routine.definition,'auth.uid()','public.workspace_user_id()');
  end loop;
end $$;
commit;
