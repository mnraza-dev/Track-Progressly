begin;
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '' check(length(display_name)<=100),timezone text not null default 'Asia/Kolkata',daily_minutes integer not null default 30 check(daily_minutes between 1 and 1440),auto_complete boolean not null default false,weekend_rest boolean not null default false,updated_at timestamptz not null default now());
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100)); return new; end $$;
create trigger on_account_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
create table public.courses(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null check(length(title) between 1 and 250),description text not null default '',category text not null default 'Development',channel_name text not null default '',thumbnail_url text not null default '',youtube_playlist_id text,single_video_id text,status text not null default 'in_progress' check(status in ('not_started','in_progress','completed','paused','archived')),is_favorite boolean not null default false,target_completion_date date,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create unique index courses_unique_playlist on public.courses(user_id,youtube_playlist_id) where youtube_playlist_id is not null;
create unique index courses_unique_single_video on public.courses(user_id,single_video_id) where single_video_id is not null;
create index courses_recent on public.courses(user_id,updated_at desc);
create index courses_search on public.courses using gin(to_tsvector('english',title||' '||description));
create table public.course_videos(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,course_id uuid not null,youtube_video_id text not null check(youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),title text not null,description text not null default '',thumbnail_url text not null default '',duration_seconds integer not null default 0 check(duration_seconds between 0 and 604800),position integer not null check(position>=0),availability_status text not null default 'available' check(availability_status in ('available','unavailable')),created_at timestamptz not null default now(),unique(id,user_id),unique(course_id,youtube_video_id),foreign key(course_id,user_id) references public.courses(id,user_id) on delete cascade);
create index course_videos_order on public.course_videos(user_id,course_id,position);
create table public.video_progress(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,course_video_id uuid not null unique,status text not null default 'in_progress' check(status in ('not_started','in_progress','completed','needs_revision')),last_position_seconds numeric not null default 0 check(last_position_seconds between 0 and 604800),watched_seconds bigint not null default 0 check(watched_seconds>=0),is_completed boolean not null default false,last_watched_at timestamptz,completed_at timestamptz,foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade);
create table public.video_notes(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,course_video_id uuid not null,content text not null default '' check(length(content)<=50000),timestamp_seconds integer not null default 0 check(timestamp_seconds between 0 and 604800),is_revision_required boolean not null default false,updated_at timestamptz not null default now(),foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade);
create index video_notes_recent on public.video_notes(user_id,updated_at desc);
create index video_notes_search on public.video_notes using gin(to_tsvector('english',content));
create table public.practice_tasks(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,course_video_id uuid not null,title text not null check(length(title) between 1 and 500),is_completed boolean not null default false,completed_at timestamptz,foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade);
create table public.video_bookmarks(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,course_video_id uuid not null,timestamp_seconds integer not null default 0 check(timestamp_seconds between 0 and 604800),label text not null default '',foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade);
create table public.learning_goals(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,goal_type text not null check(goal_type in ('daily_minutes','daily_videos','weekly_minutes')),target_value integer not null check(target_value between 1 and 10080),start_date date not null default current_date,end_date date,unique(user_id,goal_type));
create table public.learning_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,course_video_id uuid not null,started_at timestamptz not null default now(),active_seconds integer not null check(active_seconds between 1 and 60),foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade);
create index sessions_recent on public.learning_sessions(user_id,started_at);
create table public.import_limits(user_id uuid primary key references auth.users(id) on delete cascade,window_started timestamptz not null,requests integer not null);
do $$ declare name text; begin
 foreach name in array array['profiles','courses','course_videos','video_progress','video_notes','practice_tasks','video_bookmarks','learning_goals','learning_sessions','import_limits'] loop execute format('alter table public.%I enable row level security',name); end loop;
 foreach name in array array['courses','course_videos','learning_goals'] loop
  execute format('create policy owner_all on public.%I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',name);
  execute format('grant select,insert,update,delete on public.%I to authenticated',name);
 end loop;
 foreach name in array array['video_notes','practice_tasks','video_bookmarks'] loop
  execute format('create policy owner_all on public.%I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.course_videos v where v.id=course_video_id and v.user_id=auth.uid()))',name);
  execute format('grant select,insert,update,delete on public.%I to authenticated',name);
 end loop;
 foreach name in array array['video_progress','learning_sessions'] loop
  execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',name);
  execute format('grant select on public.%I to authenticated',name);
 end loop;
end $$;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select,update on public.profiles to authenticated;
grant usage on schema public to authenticated;
revoke all on public.import_limits from public,anon,authenticated;
create function public.import_course(payload jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=auth.uid(); target uuid; item jsonb;
begin
 if account is null then raise exception 'UNAUTHORIZED'; end if;
 if jsonb_typeof(payload->'videos')<>'array' or jsonb_array_length(payload->'videos')>5000 then raise exception 'Invalid lesson list'; end if;
 insert into public.courses(user_id,title,description,category,channel_name,thumbnail_url,youtube_playlist_id,single_video_id,target_completion_date) values(account,payload->>'title',coalesce(payload->>'description',''),coalesce(payload->>'category','Development'),coalesce(payload->>'channel_name',''),coalesce(payload->>'thumbnail_url',''),payload->>'youtube_playlist_id',case when payload->>'youtube_playlist_id' is null and jsonb_array_length(payload->'videos')=1 then payload->'videos'->0->>'youtube_video_id' end,(payload->>'target_completion_date')::date) returning id into target;
 if jsonb_array_length(payload->'videos')<1 then raise exception 'Add at least one lesson'; end if;
 for item in select distinct on(value->>'youtube_video_id') value from jsonb_array_elements(payload->'videos') order by value->>'youtube_video_id',(value->>'position')::integer loop
  insert into public.course_videos(user_id,course_id,youtube_video_id,title,description,thumbnail_url,duration_seconds,position,availability_status) values(account,target,item->>'youtube_video_id',item->>'title',coalesce(item->>'description',''),coalesce(item->>'thumbnail_url',''),coalesce((item->>'duration_seconds')::integer,0),(item->>'position')::integer,coalesce(item->>'availability_status','available'));
 end loop; return target;
end $$;
create function public.update_course_completion(target uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare done boolean;
begin
 if not exists(select 1 from public.courses where id=target and user_id=auth.uid()) then raise exception 'Course not found'; end if;
 select count(*)>0 and bool_and(coalesce(p.is_completed,false)) into done from public.course_videos v left join public.video_progress p on p.course_video_id=v.id where v.course_id=target and v.availability_status='available';
 update public.courses set status=case when done then 'completed' else 'in_progress' end,completed_at=case when done then coalesce(completed_at,now()) end,updated_at=now() where id=target and status not in ('archived','paused');
end $$;
create function public.save_video_progress(video uuid,new_status text default null,playback_position numeric default null,active integer default 0) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=auth.uid(); parent uuid;
begin
 select course_id into parent from public.course_videos where id=video and user_id=account and availability_status='available' for update;
 if parent is null then raise exception 'Lesson not found'; end if;
 if active<0 or active>60 or (playback_position is not null and (playback_position<0 or playback_position>604800)) then raise exception 'Invalid playback values'; end if;
 if new_status is not null and new_status not in ('not_started','in_progress','completed','needs_revision') then raise exception 'Invalid status'; end if;
 insert into public.video_progress(user_id,course_video_id,status,last_position_seconds,watched_seconds,is_completed,last_watched_at,completed_at) values(account,video,coalesce(new_status,'in_progress'),coalesce(playback_position,0),active,new_status is not distinct from 'completed',now(),case when new_status='completed' then now() end)
 on conflict(course_video_id) do update set status=coalesce(new_status,video_progress.status),last_position_seconds=coalesce(playback_position,video_progress.last_position_seconds),watched_seconds=video_progress.watched_seconds+active,last_watched_at=now(),is_completed=case when new_status is null then video_progress.is_completed else new_status='completed' end,completed_at=case when new_status is null then video_progress.completed_at when new_status='completed' then coalesce(video_progress.completed_at,now()) end;
 if active>0 then insert into public.learning_sessions(user_id,course_video_id,active_seconds) values(account,video,active); end if;
 perform public.update_course_completion(parent);
end $$;
create function public.refresh_course_metadata(target uuid,payload jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=auth.uid(); item jsonb;
begin
 if not exists(select 1 from public.courses where id=target and user_id=account) then raise exception 'Course not found'; end if;
 if jsonb_typeof(payload->'videos')<>'array' or jsonb_array_length(payload->'videos')>5000 then raise exception 'Invalid lesson list'; end if;
 update public.course_videos set availability_status='unavailable' where course_id=target;
 for item in select distinct on(value->>'youtube_video_id') value from jsonb_array_elements(payload->'videos') order by value->>'youtube_video_id',(value->>'position')::integer loop
  insert into public.course_videos(user_id,course_id,youtube_video_id,title,description,thumbnail_url,duration_seconds,position,availability_status) values(account,target,item->>'youtube_video_id',item->>'title',coalesce(item->>'description',''),coalesce(item->>'thumbnail_url',''),coalesce((item->>'duration_seconds')::integer,0),(item->>'position')::integer,coalesce(item->>'availability_status','available'))
  on conflict(course_id,youtube_video_id) do update set title=excluded.title,description=excluded.description,thumbnail_url=excluded.thumbnail_url,duration_seconds=excluded.duration_seconds,position=excluded.position,availability_status=excluded.availability_status;
 end loop; perform public.update_course_completion(target);
end $$;
create function public.consume_import_quota() returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare result integer; account uuid:=auth.uid();
begin
 if account is null then raise exception 'UNAUTHORIZED'; end if;
 insert into public.import_limits(user_id,window_started,requests) values(account,date_trunc('minute',now()),1) on conflict(user_id) do update set requests=case when import_limits.window_started=date_trunc('minute',now()) then import_limits.requests+1 else 1 end,window_started=date_trunc('minute',now()) returning requests into result;
 return result<=10;
end $$;
create function public.learning_analytics() returns table(day date,active_seconds bigint,videos_completed bigint,practice_completed bigint,courses_completed bigint) language sql stable security definer set search_path=public,pg_temp as $$
 with events as (
 select (s.started_at at time zone p.timezone)::date as day,s.active_seconds::bigint as active,0::bigint as videos,0::bigint as tasks,0::bigint as courses from public.learning_sessions s join public.profiles p on p.id=s.user_id where s.user_id=auth.uid()
 union all select (v.completed_at at time zone p.timezone)::date,0,1,0,0 from public.video_progress v join public.profiles p on p.id=v.user_id join public.course_videos cv on cv.id=v.course_video_id where v.user_id=auth.uid() and v.is_completed and v.completed_at is not null and cv.availability_status='available'
 union all select (t.completed_at at time zone p.timezone)::date,0,0,1,0 from public.practice_tasks t join public.profiles p on p.id=t.user_id where t.user_id=auth.uid() and t.is_completed and t.completed_at is not null
 union all select (c.completed_at at time zone p.timezone)::date,0,0,0,1 from public.courses c join public.profiles p on p.id=c.user_id where c.user_id=auth.uid() and c.status='completed' and c.completed_at is not null
 ) select day,sum(active)::bigint,sum(videos)::bigint,sum(tasks)::bigint,sum(courses)::bigint from events group by day order by day
$$;
revoke all on function public.create_profile() from public;
revoke all on function public.update_course_completion(uuid) from public;
revoke all on function public.import_course(jsonb) from public;
revoke all on function public.save_video_progress(uuid,text,numeric,integer) from public;
revoke all on function public.refresh_course_metadata(uuid,jsonb) from public;
revoke all on function public.consume_import_quota() from public;
revoke all on function public.learning_analytics() from public;
grant execute on function public.import_course(jsonb),public.save_video_progress(uuid,text,numeric,integer),public.refresh_course_metadata(uuid,jsonb),public.consume_import_quota(),public.learning_analytics() to authenticated;
commit;
