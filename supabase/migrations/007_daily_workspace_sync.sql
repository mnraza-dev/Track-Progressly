begin;
-- One durable snapshot per account avoids a request for every edit or playback tick.
-- Existing normalized records remain available for the initial migration into local-first storage.
create table public.workspace_snapshots (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  workspace jsonb not null check(jsonb_typeof(workspace)='object'),
  revision uuid not null,
  synced_at timestamptz not null default now()
);
alter table public.workspace_snapshots enable row level security;
create policy snapshot_read on public.workspace_snapshots for select to authenticated using(user_id=public.workspace_user_id());
revoke all on public.workspace_snapshots from public,anon,authenticated;
grant select on public.workspace_snapshots to authenticated;

create function public.get_workspace_snapshot() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=public.workspace_user_id(); snapshot public.workspace_snapshots; result jsonb;
begin
  if account is null then raise exception 'UNAUTHORIZED'; end if;
  select * into snapshot from public.workspace_snapshots where user_id=account;
  if found then return jsonb_build_object('workspace',snapshot.workspace,'revision',snapshot.revision,'syncedAt',snapshot.synced_at); end if;
  -- Import the existing relational workspace in this same RPC, including libraries
  -- above PostgREST's row limit. No per-table HTTP requests are required.
  select jsonb_build_object(
    'profile',(select jsonb_build_object('display_name',p.display_name,'timezone',p.timezone,'daily_minutes',p.daily_minutes,'auto_complete',p.auto_complete,'weekend_rest',p.weekend_rest) from public.profiles p where p.id=account),
    'goals',coalesce((select jsonb_agg(to_jsonb(g)-'user_id') from public.learning_goals g where g.user_id=account),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.day) from public.learning_analytics() a),'[]'::jsonb),
    'rewards',public.sync_learning_rewards(),
    'courses',coalesce((select jsonb_agg(to_jsonb(c)-'user_id'||jsonb_build_object(
      'videos',coalesce((select jsonb_agg(to_jsonb(v)-'user_id'||jsonb_build_object(
        'progress',coalesce((select to_jsonb(p)-'id'-'user_id'-'course_video_id' from public.video_progress p where p.course_video_id=v.id and p.user_id=account),
          '{"status":"in_progress","last_position_seconds":0,"watched_seconds":0,"is_completed":false,"last_watched_at":null,"completed_at":null}'::jsonb),
        'notes',coalesce((select jsonb_agg(to_jsonb(n)-'user_id'-'course_video_id') from public.video_notes n where n.course_video_id=v.id and n.user_id=account),'[]'::jsonb),
        'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'user_id'-'course_video_id') from public.practice_tasks t where t.course_video_id=v.id and t.user_id=account),'[]'::jsonb),
        'bookmarks',coalesce((select jsonb_agg(to_jsonb(b)-'user_id'-'course_video_id') from public.video_bookmarks b where b.course_video_id=v.id and b.user_id=account),'[]'::jsonb),
        'quiz_attempts',coalesce((select jsonb_agg(to_jsonb(a)-'user_id'-'course_video_id' order by a.completed_at,a.id) from (
          select * from public.lesson_quiz_attempts a where a.course_video_id=v.id and a.user_id=account order by a.completed_at desc,a.id desc limit 100
        ) a),'[]'::jsonb)
      )||coalesce((select jsonb_build_object('quiz',jsonb_build_object('version',q.version,'questions',q.questions)) from public.lesson_quizzes q where q.course_video_id=v.id and q.user_id=account),'{}'::jsonb)
      order by v.position,v.id) from public.course_videos v where v.course_id=c.id and v.user_id=account),'[]'::jsonb)
    ) order by c.updated_at desc,c.id) from public.courses c where c.user_id=account),'[]'::jsonb)
  ) into result;
  return jsonb_build_object('workspace',result,'revision',null,'syncedAt',null);
end
$$;
revoke all on function public.get_workspace_snapshot() from public;
grant execute on function public.get_workspace_snapshot() to authenticated;

create function public.sync_workspace_snapshot(payload jsonb,expected_revision uuid,request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=public.workspace_user_id(); current_snapshot public.workspace_snapshots;
begin
  if account is null then raise exception 'UNAUTHORIZED'; end if;
  if request_id is null or octet_length(payload::text)>28000000 or jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(payload->'profile') is distinct from 'object'
    or jsonb_typeof(payload->'courses') is distinct from 'array'
    or jsonb_typeof(payload->'goals') is distinct from 'array'
    or jsonb_typeof(payload->'activity') is distinct from 'array' then raise exception 'Invalid workspace snapshot'; end if;
  -- Lock the account even when no snapshot exists yet, so concurrent first uploads serialize.
  perform 1 from public.profiles where id=account for update;
  select * into current_snapshot from public.workspace_snapshots where user_id=account;
  -- A retried request whose first response was lost must not write a second time.
  if current_snapshot.revision=request_id then
    return jsonb_build_object('revision',current_snapshot.revision,'syncedAt',current_snapshot.synced_at);
  end if;
  if current_snapshot.revision is distinct from expected_revision then
    raise sqlstate 'PT409' using message='The cloud workspace has changed on another device.';
  end if;
  insert into public.workspace_snapshots(user_id,workspace,revision)
    values(account,payload,request_id)
    on conflict(user_id) do update set workspace=excluded.workspace,revision=excluded.revision,synced_at=now()
    returning * into current_snapshot;
  return jsonb_build_object('revision',current_snapshot.revision,'syncedAt',current_snapshot.synced_at);
end $$;
revoke all on function public.sync_workspace_snapshot(jsonb,uuid,uuid) from public;
grant execute on function public.sync_workspace_snapshot(jsonb,uuid,uuid) to authenticated;
commit;
