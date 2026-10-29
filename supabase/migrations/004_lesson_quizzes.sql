begin;

create table public.lesson_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_video_id uuid not null unique,
  version uuid not null,
  questions jsonb not null,
  updated_at timestamptz not null default now(),
  foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade
);
create table public.lesson_quiz_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_video_id uuid not null,
  quiz_version uuid not null,
  answers jsonb not null,
  correct integer not null,
  total integer not null,
  passed boolean not null,
  completed_at timestamptz not null default now(),
  foreign key(course_video_id,user_id) references public.course_videos(id,user_id) on delete cascade
);
create index lesson_quiz_attempts_recent on public.lesson_quiz_attempts(user_id,course_video_id,completed_at);
alter table public.lesson_quizzes enable row level security;
alter table public.lesson_quiz_attempts enable row level security;
create policy quiz_read on public.lesson_quizzes for select to authenticated using(user_id=auth.uid());
create policy quiz_attempt_read on public.lesson_quiz_attempts for select to authenticated using(user_id=auth.uid());
revoke all on public.lesson_quizzes,public.lesson_quiz_attempts from public,anon,authenticated;
grant select on public.lesson_quizzes,public.lesson_quiz_attempts to authenticated;

create function public.save_lesson_quiz(video uuid,payload jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=auth.uid(); question jsonb; option jsonb; seen uuid[]:='{}'; question_id uuid;
begin
  perform 1 from public.course_videos where id=video and user_id=account and availability_status='available' for update;
  if not found then raise exception 'Lesson not found'; end if;
  if jsonb_typeof(payload->'questions') is distinct from 'array' then raise exception 'Invalid questions'; end if;
  if jsonb_array_length(payload->'questions') not between 1 and 20 or payload->>'version' is null then raise exception 'Invalid quiz'; end if;
  for question in select value from jsonb_array_elements(payload->'questions') loop
    question_id:=(question->>'id')::uuid;
    if question_id is null or question_id=any(seen) then raise exception 'Question IDs must be unique'; end if;
    seen:=array_append(seen,question_id);
    if jsonb_typeof(question->'prompt') is distinct from 'string' or length(trim(question->>'prompt')) not between 5 and 1000
      or jsonb_typeof(question->'explanation') is distinct from 'string' or length(trim(question->>'explanation'))>2000
      or jsonb_typeof(question->'options') is distinct from 'array'
      or jsonb_typeof(question->'correct_index') is distinct from 'number'
      or (question->>'correct_index') !~ '^[0-3]$' then raise exception 'Invalid question'; end if;
    if jsonb_array_length(question->'options')<>4 then raise exception 'Provide four answers'; end if;
    for option in select value from jsonb_array_elements(question->'options') loop
      if jsonb_typeof(option) is distinct from 'string' or length(trim(option#>>'{}')) not between 1 and 500 then raise exception 'Invalid answer option'; end if;
    end loop;
    if (select count(distinct lower(trim(value))) from jsonb_array_elements_text(question->'options'))<>4 then raise exception 'Each answer option must be different'; end if;
  end loop;
  insert into public.lesson_quizzes(user_id,course_video_id,version,questions)
    values(account,video,(payload->>'version')::uuid,payload->'questions')
    on conflict(course_video_id) do update set version=excluded.version,questions=excluded.questions,updated_at=now();
end $$;

create function public.submit_lesson_quiz(video uuid,attempt_id uuid,quiz_version uuid,answers jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare account uuid:=auth.uid(); quiz public.lesson_quizzes; attempt public.lesson_quiz_attempts; score integer; question_count integer;
begin
  perform 1 from public.course_videos where id=video and user_id=account and availability_status='available' for update;
  if not found then raise exception 'Lesson not found'; end if;
  select * into quiz from public.lesson_quizzes where course_video_id=video and user_id=account;
  if not found then raise exception 'Quiz not found'; end if;
  if quiz.version<>quiz_version then raise exception 'This quiz has changed. Restart to use the latest questions.'; end if;
  question_count:=jsonb_array_length(quiz.questions);
  if jsonb_typeof(answers) is distinct from 'array' then raise exception 'Answer every question before submitting'; end if;
  if jsonb_array_length(answers)<>question_count or exists(select 1 from jsonb_array_elements(answers) a where jsonb_typeof(a)<>'number' or a::text !~ '^[0-3]$') then raise exception 'Answer every question before submitting'; end if;
  select * into attempt from public.lesson_quiz_attempts where id=attempt_id;
  if found then
    if attempt.user_id<>account or attempt.course_video_id<>video or attempt.quiz_version<>quiz_version or attempt.answers<>answers then raise exception 'Attempt ID already used'; end if;
    return to_jsonb(attempt);
  end if;
  select count(*)::integer into score from jsonb_array_elements(quiz.questions) with ordinality as q(value,n)
    where (q.value->>'correct_index')::integer=(answers->>(q.n::integer-1))::integer;
  insert into public.lesson_quiz_attempts(id,user_id,course_video_id,quiz_version,answers,correct,total,passed)
    values(attempt_id,account,video,quiz_version,answers,score,question_count,score*100>=70*question_count) returning * into attempt;
  delete from public.lesson_quiz_attempts where id in (
    select id from public.lesson_quiz_attempts where user_id=account and course_video_id=video order by completed_at desc,id desc offset 100
  );
  return to_jsonb(attempt);
end $$;
revoke all on function public.save_lesson_quiz(uuid,jsonb),public.submit_lesson_quiz(uuid,uuid,uuid,jsonb) from public;
grant execute on function public.save_lesson_quiz(uuid,jsonb),public.submit_lesson_quiz(uuid,uuid,uuid,jsonb) to authenticated;
commit;
