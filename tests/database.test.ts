import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const db = new PGlite();
let course: string;
let video: string;
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/001_learntrack.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(migration);
  await db.query("insert into auth.users(id) values ($1),($2)", [alice, bob]);
  await asUser(alice);
  const result = await db.query<{ id: string }>(
    "select public.import_course($1::jsonb) id",
    [
      JSON.stringify({
        title: "Private course",
        youtube_playlist_id: "PLsecuretest123456",
        description: "",
        category: "Development",
        thumbnail_url: "",
        channel_name: "",
        videos: [
          {
            youtube_video_id: "j942wKiXFu8",
            title: "Private lesson",
            description: "",
            thumbnail_url: "",
            duration_seconds: 60,
            position: 0,
            availability_status: "available",
          },
        ],
      }),
    ],
  );
  course = result.rows[0].id;
  const videos = await db.query<{ id: string }>("select id from course_videos");
  video = videos.rows[0].id;
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL migrations, atomic mutations, and RLS isolation", () => {
  it("creates a private profile for new accounts", async () => {
    await asUser(alice);
    const result = await db.query<{ id: string }>("select id from profiles");
    expect(result.rows.map((r) => r.id)).toEqual([alice]);
  });
  it("prevents another user reading courses and related lessons", async () => {
    await asUser(bob);
    expect((await db.query("select * from courses")).rows).toHaveLength(0);
    expect((await db.query("select * from course_videos")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
  });
  it("rejects notes attached to another user’s lesson", async () => {
    await asUser(bob);
    await expect(
      db.query(
        "insert into video_notes(user_id,course_video_id,content) values($1,$2,$3)",
        [bob, video, "Not allowed"],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects another user’s progress updates", async () => {
    await asUser(bob);
    await expect(
      db.query("select save_video_progress($1,'completed',12,0)", [video]),
    ).rejects.toThrow(/Lesson not found/);
  });
  it("stores completion and playback time independently", async () => {
    await asUser(alice);
    await db.query("select save_video_progress($1,null,18,15)", [video]);
    let result = await db.query<{
      is_completed: boolean;
      last_position_seconds: string;
      watched_seconds: number;
    }>("select * from video_progress");
    expect(result.rows[0].is_completed).toBe(false);
    expect(Number(result.rows[0].last_position_seconds)).toBe(18);
    expect(result.rows[0].watched_seconds).toBe(15);
    await db.query("select save_video_progress($1,'completed',42,0)", [video]);
    result = await db.query("select * from video_progress");
    expect(result.rows[0].is_completed).toBe(true);
    expect(
      (await db.query<{ status: string }>("select status from courses")).rows[0]
        .status,
    ).toBe("completed");
    const analytics = await db.query<{ active_seconds: number }>(
      "select * from learning_analytics()",
    );
    expect(Number(analytics.rows[0].active_seconds)).toBe(15);
  });
  it("persists notes and practice and isolates them from a different user", async () => {
    await asUser(alice);
    await db.query(
      "insert into video_notes(user_id,course_video_id,content) values($1,$2,$3)",
      [alice, video, "My saved idea"],
    );
    await db.query(
      "insert into practice_tasks(user_id,course_video_id,title) values($1,$2,$3)",
      [alice, video, "Try the concept"],
    );
    await asUser(bob);
    expect((await db.query("select * from video_notes")).rows).toHaveLength(0);
    expect((await db.query("select * from practice_tasks")).rows).toHaveLength(
      0,
    );
    await asUser(alice);
    expect(
      (await db.query<{ content: string }>("select content from video_notes"))
        .rows[0].content,
    ).toBe("My saved idea");
  });
  it("atomically rejects duplicate playlist imports", async () => {
    await asUser(alice);
    await expect(
      db.query("select import_course($1::jsonb)", [
        JSON.stringify({
          title: "Duplicate",
          youtube_playlist_id: "PLsecuretest123456",
          videos: [],
        }),
      ]),
    ).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from courses")).rows).toHaveLength(1);
  });
  it("refreshes existing lesson metadata while preserving progress and note IDs", async () => {
    await asUser(alice);
    await db.query("select refresh_course_metadata($1,$2::jsonb)", [
      course,
      JSON.stringify({
        videos: [
          {
            youtube_video_id: "j942wKiXFu8",
            title: "Refreshed title",
            description: "",
            thumbnail_url: "",
            duration_seconds: 90,
            position: 1,
            availability_status: "available",
          },
          {
            youtube_video_id: "Ke90Tje7VS0",
            title: "Added lesson",
            description: "",
            thumbnail_url: "",
            duration_seconds: 60,
            position: 0,
            availability_status: "available",
          },
        ],
      }),
    ]);
    expect(
      (
        await db.query<{ id: string }>(
          "select id from course_videos where youtube_video_id=$1",
          ["j942wKiXFu8"],
        )
      ).rows[0].id,
    ).toBe(video);
    expect(
      (
        await db.query<{ is_completed: boolean }>(
          "select is_completed from video_progress",
        )
      ).rows[0].is_completed,
    ).toBe(true);
    expect((await db.query("select * from video_notes")).rows).toHaveLength(1);
    expect(
      (await db.query<{ status: string }>("select status from courses")).rows[0]
        .status,
    ).toBe("in_progress");
  });
  it("enforces import rate limits without exposing their backing table", async () => {
    await asUser(alice);
    for (let i = 0; i < 10; i++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select consume_import_quota() allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select consume_import_quota() allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(db.query("select * from import_limits")).rejects.toThrow(
      /permission denied/,
    );
  });
});
