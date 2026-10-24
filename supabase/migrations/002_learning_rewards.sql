-- Server-authoritative personal rewards. No client can directly insert or edit XP.
begin;
create table public.learning_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check(length(event_key) between 1 and 100000),
  xp integer not null check(xp between 1 and 10000), earned_at timestamptz not null default now(),
  primary key(user_id,event_key)
);
alter table public.learning_rewards enable row level security;
create policy reward_read on public.learning_rewards for select to authenticated using(user_id=auth.uid());
revoke all on public.learning_rewards from public,anon,authenticated;
grant select on public.learning_rewards to authenticated;

create function public.sync_learning_rewards() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare account uuid := auth.uid(); today date; record_count integer; result jsonb;
begin
  if account is null then raise exception 'UNAUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtext(account::text));
  select (now() at time zone timezone)::date into today from public.profiles where id=account;
  insert into public.learning_rewards(user_id,event_key,xp)
    select distinct account,'lesson:'||v.youtube_video_id,50 from public.course_videos v join public.video_progress p on p.course_video_id=v.id where v.user_id=account and v.availability_status='available' and p.is_completed
    on conflict do nothing;
  insert into public.learning_rewards(user_id,event_key,xp)
    select distinct account,'note:'||v.youtube_video_id,10 from public.course_videos v join public.video_notes n on n.course_video_id=v.id where v.user_id=account and v.availability_status='available' and length(trim(n.content))>=10
    on conflict do nothing;
  insert into public.learning_rewards(user_id,event_key,xp)
    select account,'practice:'||t.id::text,25 from public.practice_tasks t join public.course_videos v on v.id=t.course_video_id where t.user_id=account and v.availability_status='available' and t.is_completed
    on conflict do nothing;
  insert into public.learning_rewards(user_id,event_key,xp)
    select account,'course:'||coalesce(c.youtube_playlist_id,(select string_agg(v.youtube_video_id,'-' order by v.youtube_video_id) from public.course_videos v where v.course_id=c.id)),200
    from public.courses c where c.user_id=account
      and exists(select 1 from public.course_videos v where v.course_id=c.id and v.availability_status='available')
      and not exists(select 1 from public.course_videos v left join public.video_progress p on p.course_video_id=v.id where v.course_id=c.id and v.availability_status='available' and not coalesce(p.is_completed,false))
    on conflict do nothing;
  insert into public.learning_rewards(user_id,event_key,xp)
    select account,'day:'||day::text,30 from public.learning_analytics() where day<=today and (active_seconds>0 or videos_completed>0 or practice_completed>0)
    on conflict do nothing;
  insert into public.learning_rewards(user_id,event_key,xp)
    select account,'focus:'||day::text,(least(86400,active_seconds)/900)::integer*10 from public.learning_analytics() where day<=today and active_seconds>=900
    on conflict(user_id,event_key) do update set xp=greatest(learning_rewards.xp,excluded.xp);
  insert into public.learning_rewards(user_id,event_key,xp)
    select account,'quest_focus:'||day::text,35 from public.learning_analytics() where day<=today and active_seconds>=900
    union all select account,'quest_lesson:'||day::text,40 from public.learning_analytics() where day<=today and videos_completed>=1
    union all select account,'quest_practice:'||day::text,45 from public.learning_analytics() where day<=today and practice_completed>=1
    on conflict do nothing;
  with metrics as (
    select count(*) filter(where event_key like 'lesson:%') as lessons,
      count(*) filter(where event_key like 'practice:%') as practice,
      count(*) filter(where event_key like 'note:%') as notes,
      count(*) filter(where event_key like 'course:%') as courses,
      coalesce(sum(xp) filter(where event_key like 'focus:%'),0)/10*15 as minutes
    from public.learning_rewards where user_id=account
  ), active_days as (
    select substring(event_key from 5)::date as day from public.learning_rewards where user_id=account and event_key like 'day:%'
  ), streak_groups as (
    select day - (row_number() over(order by day))::integer as grp from active_days
  ), streaks as (
    select coalesce(max(n),0) as best from (select count(*) as n from streak_groups group by grp) grouped
  ), achievements as (
    select 'first_step' as id,50 as xp,lessons>=1 as earned from metrics
    union all select 'lesson_cadence',100,lessons>=5 from metrics
    union all select 'lesson_virtuoso',250,lessons>=20 from metrics
    union all select 'maker_mindset',100,practice>=3 from metrics
    union all select 'execution_prodigy',200,practice>=10 from metrics
    union all select 'the_archivist',75,notes>=5 from metrics
    union all select 'the_finisher',200,courses>=1 from metrics
    union all select 'deep_focus',150,minutes>=120 from metrics
    union all select 'streak_spark',75,best>=3 from streaks
    union all select 'streak_master',150,best>=7 from streaks
  ) insert into public.learning_rewards(user_id,event_key,xp) select account,'achievement:'||id,xp from achievements where earned on conflict do nothing;
  select jsonb_build_object('version',1,'events',coalesce(jsonb_object_agg(event_key,jsonb_build_object('xp',xp,'earned_at',to_char(earned_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'{}'::jsonb)) into result from public.learning_rewards where user_id=account;
  return result;
end $$;
revoke all on function public.sync_learning_rewards() from public;
grant execute on function public.sync_learning_rewards() to authenticated;
commit;
