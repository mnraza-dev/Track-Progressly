import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
let account: string;
async function asUser(subject: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    subject,
  ]);
  await db.exec("set role authenticated");
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('sub',nullif(current_setting('request.jwt.claim.sub',true),''))
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid(),auth.jwt() to authenticated;
  `);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(
      readFileSync(new URL(name, directory), "utf8").replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  }
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("first access to a completely empty workspace database", () => {
  it("starts with no accounts, profiles, or learning data", async () => {
    for (const table of [
      "auth.users",
      "profiles",
      "courses",
      "course_videos",
      "video_progress",
      "video_notes",
      "learning_goals",
      "learning_rewards",
      "lesson_quizzes",
      "lesson_quiz_attempts",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
  });
  it("automatically creates only the signed-in user's profile with default settings", async () => {
    await asUser("user_first_account");
    account = (
      await db.query<{ id: string }>("select ensure_workspace_profile() id")
    ).rows[0].id;
    expect(account).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      (
        await db.query(
          "select display_name,timezone,daily_minutes,auto_complete,weekend_rest from profiles",
        )
      ).rows,
    ).toEqual([
      {
        display_name: "",
        timezone: "Asia/Kolkata",
        daily_minutes: 30,
        auto_complete: false,
        weekend_rest: false,
      },
    ]);
    expect((await db.query("select * from courses")).rows).toEqual([]);
    expect((await db.query("select * from learning_goals")).rows).toEqual([]);
    expect((await db.query("select * from learning_analytics()")).rows).toEqual(
      [],
    );
    expect(
      (
        await db.query<{ rewards: unknown }>(
          "select sync_learning_rewards() rewards",
        )
      ).rows[0].rewards,
    ).toEqual({ version: 1, events: {} });
  });
  it("loads repeatedly without creating duplicate profiles or sample data", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (await db.query<{ id: string }>("select ensure_workspace_profile() id"))
          .rows[0].id,
      ).toBe(account);
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
    expect((await db.query("select * from course_videos")).rows).toEqual([]);
    expect((await db.query("select * from lesson_quizzes")).rows).toEqual([]);
  });
  it("can initialize again after all account data has been removed", async () => {
    await db.exec("reset role");
    await db.query("delete from profiles where id=$1", [account]);
    await asUser("user_first_account");
    const next = (
      await db.query<{ id: string }>("select ensure_workspace_profile() id")
    ).rows[0].id;
    expect(next).not.toBe(account);
    account = next;
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
    expect((await db.query("select * from learning_analytics()")).rows).toEqual(
      [],
    );
  });
  it("saves the first user-created course and progress without a Supabase Auth account", async () => {
    await db.query("select import_course($1::jsonb)", [
      JSON.stringify({
        title: "My first course",
        videos: [
          {
            youtube_video_id: "j942wKiXFu8",
            title: "First lesson",
            position: 0,
          },
        ],
      }),
    ]);
    const videos = await db.query<{ id: string; user_id: string }>(
      "select id,user_id from course_videos",
    );
    expect(videos.rows).toHaveLength(1);
    expect(videos.rows[0].user_id).toBe(account);
    await db.query("select save_video_progress($1,'completed',0,0)", [
      videos.rows[0].id,
    ]);
    expect(
      (
        await db.query<{ is_completed: boolean }>(
          "select is_completed from video_progress",
        )
      ).rows[0].is_completed,
    ).toBe(true);
    await db.exec("reset role");
    expect((await db.query("select * from auth.users")).rows).toEqual([]);
  });
  it("gives the next new account its own empty workspace", async () => {
    await asUser("user_second_account");
    const second = (
      await db.query<{ id: string }>("select ensure_workspace_profile() id")
    ).rows[0].id;
    expect(second).not.toBe(account);
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
    expect((await db.query("select * from courses")).rows).toEqual([]);
    expect(
      (
        await db.query<{ rewards: unknown }>(
          "select sync_learning_rewards() rewards",
        )
      ).rows[0].rewards,
    ).toEqual({ version: 1, events: {} });
  });
});
