begin;

-- Backups contain daily totals rather than raw playback sessions. Preserve only
-- the difference from restored completion records so analytics does not double count.
create table public.workspace_activity_imports (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  active_seconds bigint not null check(active_seconds>=0),
  videos_completed bigint not null check(videos_completed>=0),
  practice_completed bigint not null check(practice_completed>=0),
  courses_completed bigint not null check(courses_completed>=0),
  primary key(user_id,day)
);
alter table public.workspace_activity_imports enable row level security;
create policy activity_import_read on public.workspace_activity_imports for select to authenticated using(user_id=public.workspace_user_id());
revoke all on public.workspace_activity_imports from public,anon,authenticated;
grant select on public.workspace_activity_imports to authenticated;

alter function public.learning_analytics() rename to learning_analytics_live;
create function public.learning_analytics()
returns table(day date,active_seconds bigint,videos_completed bigint,practice_completed bigint,courses_completed bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  select day,sum(active_seconds)::bigint,sum(videos_completed)::bigint,sum(practice_completed)::bigint,sum(courses_completed)::bigint
  from (
    select * from public.learning_analytics_live()
    union all
    select day,active_seconds,videos_completed,practice_completed,courses_completed
    from public.workspace_activity_imports where user_id=public.workspace_user_id()
  ) activity group by day order by day
$$;
revoke all on function public.learning_analytics() from public;
grant execute on function public.learning_analytics() to authenticated;

create function public.restore_workspace(payload jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  account uuid:=public.workspace_user_id();
  course jsonb; video jsonb; item jsonb; progress jsonb; attempt jsonb;
  course_id uuid; video_id uuid; correct_count integer; total_count integer;
begin
  if account is null then raise exception 'UNAUTHORIZED'; end if;
  if octet_length(payload::text)>25000000
    or jsonb_typeof(payload->'profile') is distinct from 'object'
    or jsonb_typeof(payload->'courses') is distinct from 'array'
    or jsonb_typeof(payload->'goals') is distinct from 'array'
    or jsonb_typeof(payload->'activity') is distinct from 'array' then raise exception 'Invalid workspace backup'; end if;
  if jsonb_array_length(payload->'courses')>5000 then raise exception 'Too many courses'; end if;
  perform 1 from public.profiles where id=account for update;

  -- Every operation is in this one transaction. Any invalid record rolls back all changes.
  delete from public.courses where user_id=account;
  delete from public.learning_goals where user_id=account;
  delete from public.learning_rewards where user_id=account;
  delete from public.workspace_activity_imports where user_id=account;
  update public.profiles set
    display_name=payload->'profile'->>'display_name',timezone=payload->'profile'->>'timezone',
    daily_minutes=(payload->'profile'->>'daily_minutes')::integer,
    auto_complete=(payload->'profile'->>'auto_complete')::boolean,
    weekend_rest=coalesce((payload->'profile'->>'weekend_rest')::boolean,false),updated_at=now()
    where id=account;

  for course in select value from jsonb_array_elements(payload->'courses') loop
    if jsonb_typeof(course->'videos') is distinct from 'array' then raise exception 'Invalid lesson list'; end if;
    if jsonb_array_length(course->'videos')>5000 then raise exception 'Too many lessons'; end if;
    course_id:=gen_random_uuid();
    insert into public.courses(id,user_id,title,description,category,channel_name,thumbnail_url,youtube_playlist_id,status,is_favorite,target_completion_date,completed_at,created_at,updated_at)
      values(course_id,account,course->>'title',course->>'description',course->>'category',course->>'channel_name',course->>'thumbnail_url',course->>'youtube_playlist_id',course->>'status',(course->>'is_favorite')::boolean,(course->>'target_completion_date')::date,(course->>'completed_at')::timestamptz,(course->>'created_at')::timestamptz,(course->>'updated_at')::timestamptz);
    for video in select value from jsonb_array_elements(course->'videos') loop
      -- Always allocate new IDs and ownership; source IDs cannot overwrite another account.
      video_id:=gen_random_uuid();
      insert into public.course_videos(id,user_id,course_id,youtube_video_id,title,description,thumbnail_url,duration_seconds,position,availability_status)
        values(video_id,account,course_id,video->>'youtube_video_id',video->>'title',video->>'description',video->>'thumbnail_url',(video->>'duration_seconds')::integer,(video->>'position')::integer,video->>'availability_status');
      progress:=video->'progress';
      insert into public.video_progress(user_id,course_video_id,status,last_position_seconds,watched_seconds,is_completed,last_watched_at,completed_at)
        values(account,video_id,progress->>'status',(progress->>'last_position_seconds')::numeric,(progress->>'watched_seconds')::bigint,(progress->>'is_completed')::boolean,(progress->>'last_watched_at')::timestamptz,(progress->>'completed_at')::timestamptz);
      for item in select value from jsonb_array_elements(video->'notes') loop
        insert into public.video_notes(user_id,course_video_id,content,timestamp_seconds,is_revision_required,updated_at)
          values(account,video_id,item->>'content',(item->>'timestamp_seconds')::integer,(item->>'is_revision_required')::boolean,(item->>'updated_at')::timestamptz);
      end loop;
      for item in select value from jsonb_array_elements(video->'tasks') loop
        insert into public.practice_tasks(user_id,course_video_id,title,is_completed,completed_at)
          values(account,video_id,item->>'title',(item->>'is_completed')::boolean,(item->>'completed_at')::timestamptz);
      end loop;
      for item in select value from jsonb_array_elements(video->'bookmarks') loop
        insert into public.video_bookmarks(user_id,course_video_id,timestamp_seconds,label)
          values(account,video_id,(item->>'timestamp_seconds')::integer,item->>'label');
      end loop;
      if video->'quiz' is not null and video->'quiz'<>'null'::jsonb then
        -- Authoring validation also applies to restored quizzes from unavailable lessons.
        update public.course_videos set availability_status='available' where id=video_id;
        perform public.save_lesson_quiz(video_id,video->'quiz');
        update public.course_videos set availability_status=video->>'availability_status' where id=video_id;
      end if;
      if coalesce(jsonb_array_length(video->'quiz_attempts'),0)>100 then raise exception 'Too many quiz attempts'; end if;
      for attempt in select value from jsonb_array_elements(coalesce(video->'quiz_attempts','[]'::jsonb)) loop
        total_count:=(attempt->>'total')::integer;
        correct_count:=(attempt->>'correct')::integer;
        if total_count not between 1 and 20 or correct_count not between 0 and total_count then raise exception 'Invalid quiz result'; end if;
        -- Regrade the current question set; older versions retain their historical result.
        if attempt->>'quiz_version'=video->'quiz'->>'version' then
          total_count:=jsonb_array_length(video->'quiz'->'questions');
          if jsonb_array_length(attempt->'answers')<>total_count then raise exception 'Invalid quiz answers'; end if;
          select count(*)::integer into correct_count
            from jsonb_array_elements(video->'quiz'->'questions') with ordinality q(value,n)
            where (q.value->>'correct_index')::integer=(attempt->'answers'->>(q.n::integer-1))::integer;
        end if;
        insert into public.lesson_quiz_attempts(id,user_id,course_video_id,quiz_version,answers,correct,total,passed,completed_at)
          values(gen_random_uuid(),account,video_id,(attempt->>'quiz_version')::uuid,attempt->'answers',correct_count,total_count,correct_count*100>=70*total_count,(attempt->>'completed_at')::timestamptz);
      end loop;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(payload->'goals') loop
    insert into public.learning_goals(user_id,goal_type,target_value,start_date,end_date)
      values(account,item->>'goal_type',(item->>'target_value')::integer,(item->>'start_date')::date,(item->>'end_date')::date);
  end loop;
  insert into public.workspace_activity_imports(user_id,day,active_seconds,videos_completed,practice_completed,courses_completed)
    select account,(a.value->>'day')::date,(a.value->>'active_seconds')::bigint,
      greatest(0,(a.value->>'videos_completed')::bigint-coalesce(l.videos_completed,0)),
      greatest(0,(a.value->>'practice_completed')::bigint-coalesce(l.practice_completed,0)),
      greatest(0,(a.value->>'courses_completed')::bigint-coalesce(l.courses_completed,0))
    from jsonb_array_elements(payload->'activity') a(value)
    left join public.learning_analytics_live() l on l.day=(a.value->>'day')::date;
  -- Ignore supplied XP. Derive rewards from restored learning records and activity.
  perform public.sync_learning_rewards();
end $$;
revoke all on function public.restore_workspace(jsonb) from public;
grant execute on function public.restore_workspace(jsonb) to authenticated;
commit;
