import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyWorkspace, emptyProgress, type Workspace } from "@/types";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";

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

describe("atomic account backup restore", () => {
  let restoredCourse: string;
  const when = "2026-10-27T12:00:00.000Z";
  function backup(): Workspace {
    return {
      ...structuredClone(emptyWorkspace),
      profile: {
        ...emptyWorkspace.profile,
        display_name: "Restored name",
        timezone: "UTC",
      },
      rewards: {
        version: 1,
        events: { cheat: { xp: 10000, earned_at: when } },
      },
      activity: [
        {
          day: "2026-10-27",
          active_seconds: 1200,
          videos_completed: 1,
          practice_completed: 1,
          courses_completed: 1,
        },
      ],
      goals: [
        {
          id: "local-goal",
          goal_type: "daily_minutes",
          target_value: 30,
          start_date: "2026-10-27",
          end_date: null,
        },
      ],
      courses: [
        {
          id: "local-course",
          title: "Restored course",
          description: "",
          category: "Development",
          channel_name: "",
          thumbnail_url: "",
          youtube_playlist_id: null,
          status: "completed",
          is_favorite: true,
          target_completion_date: null,
          completed_at: when,
          created_at: when,
          updated_at: when,
          videos: [
            {
              id: "local-video",
              youtube_video_id: "j942wKiXFu8",
              title: "Restored lesson",
              description: "",
              thumbnail_url: "",
              duration_seconds: 600,
              position: 0,
              availability_status: "available",
              progress: {
                ...emptyProgress,
                status: "completed",
                is_completed: true,
                watched_seconds: 300,
                last_position_seconds: 60,
                completed_at: when,
              },
              notes: [
                {
                  id: "local-note",
                  content: "My restored learning notes",
                  timestamp_seconds: 15,
                  is_revision_required: true,
                  updated_at: when,
                },
              ],
              tasks: [
                {
                  id: "local-task",
                  title: "My practice",
                  is_completed: true,
                  completed_at: when,
                },
              ],
              bookmarks: [
                {
                  id: "local-bookmark",
                  label: "Review",
                  timestamp_seconds: 30,
                },
              ],
              quiz: {
                version: "33333333-3333-4333-8333-333333333333",
                questions: [
                  {
                    id: "44444444-4444-4444-8444-444444444444",
                    prompt: "Which answer is correct?",
                    options: ["A", "B", "C", "D"],
                    correct_index: 1,
                    explanation: "B is correct",
                  },
                ],
              },
              quiz_attempts: [
                {
                  id: "55555555-5555-4555-8555-555555555555",
                  quiz_version: "33333333-3333-4333-8333-333333333333",
                  answers: [0],
                  correct: 1,
                  total: 1,
                  passed: true,
                  completed_at: when,
                },
              ],
            },
          ],
        },
      ],
    };
  }
  it("restores learning data and preferences into the caller's account with new IDs", async () => {
    await asUser("user_restore_account");
    await db.query("select ensure_workspace_profile()");
    await db.query("select restore_workspace($1::jsonb)", [
      JSON.stringify(backup()),
    ]);
    const courses = (
      await db.query<{ id: string; title: string }>(
        "select id,title from courses",
      )
    ).rows;
    expect(courses).toHaveLength(1);
    expect(courses[0].title).toBe("Restored course");
    expect(courses[0].id).not.toBe("local-course");
    restoredCourse = courses[0].id;
    expect((await db.query("select * from video_notes")).rows).toHaveLength(1);
    expect((await db.query("select * from practice_tasks")).rows).toHaveLength(
      1,
    );
    expect((await db.query("select * from video_bookmarks")).rows).toHaveLength(
      1,
    );
    expect((await db.query("select * from learning_goals")).rows).toHaveLength(
      1,
    );
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from profiles",
        )
      ).rows[0].display_name,
    ).toBe("Restored name");
    expect(
      (await db.query("select * from learning_rewards where event_key='cheat'"))
        .rows,
    ).toEqual([]);
  });
  it("preserves daily activity totals without double-counting restored completions", async () => {
    const rows = (
      await db.query<Record<string, unknown>>(
        "select * from learning_analytics()",
      )
    ).rows;
    expect(rows).toHaveLength(1);
    for (const [key, expected] of Object.entries({
      active_seconds: 1200,
      videos_completed: 1,
      practice_completed: 1,
      courses_completed: 1,
    }))
      expect(Number(rows[0][key])).toBe(expected);
    const attempts = (
      await db.query<{ correct: number; passed: boolean }>(
        "select correct,passed from lesson_quiz_attempts",
      )
    ).rows;
    expect(attempts).toEqual([{ correct: 0, passed: false }]);
  });
  it("rolls back the entire replacement if any backup record fails", async () => {
    const invalid = backup();
    invalid.courses[0].title = "";
    await expect(
      db.query("select restore_workspace($1::jsonb)", [
        JSON.stringify(invalid),
      ]),
    ).rejects.toThrow(/check constraint/);
    expect(
      (await db.query<{ id: string }>("select id from courses")).rows[0].id,
    ).toBe(restoredCourse);
    expect((await db.query("select * from video_notes")).rows).toHaveLength(1);
  });
  it("cannot overwrite records owned by the account that produced the source backup", async () => {
    await asUser("user_first_account");
    expect(
      (await db.query<{ title: string }>("select title from courses")).rows,
    ).toEqual([{ title: "My first course" }]);
    await asUser("user_restore_account");
    await db.query("select restore_workspace($1::jsonb)", [
      JSON.stringify(backup()),
    ]);
    expect((await db.query("select * from courses")).rows).toHaveLength(1);
    expect(
      (await db.query("select * from workspace_activity_imports")).rows,
    ).toHaveLength(1);
  });
  it("can replace an account with an empty backup without changing other accounts", async () => {
    await db.query("select restore_workspace($1::jsonb)", [
      JSON.stringify(emptyWorkspace),
    ]);
    expect((await db.query("select * from courses")).rows).toEqual([]);
    expect((await db.query("select * from learning_analytics()")).rows).toEqual(
      [],
    );
    expect((await db.query("select * from learning_rewards")).rows).toEqual([]);
    await asUser("user_first_account");
    expect((await db.query("select * from courses")).rows).toHaveLength(1);
  });
  it("rejects anonymous restore requests", async () => {
    await asUser("");
    await expect(
      db.query("select restore_workspace($1::jsonb)", [
        JSON.stringify(emptyWorkspace),
      ]),
    ).rejects.toThrow(/UNAUTHORIZED/);
    await db.exec("reset role; set role anon");
    await expect(
      db.query("select restore_workspace($1::jsonb)", [
        JSON.stringify(emptyWorkspace),
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("versioned daily cloud snapshots", () => {
  const firstRevision = "11111111-1111-4111-8111-111111111111";
  const secondRevision = "22222222-2222-4222-8222-222222222222";
  let payload: Workspace;
  it("exports existing relational data as one complete workspace before the first snapshot", async () => {
    await asUser("user_first_account");
    const result = (
      await db.query<{ result: { workspace: Workspace; revision: null } }>(
        "select get_workspace_snapshot() result",
      )
    ).rows[0].result;
    expect(result.revision).toBeNull();
    payload = parseWorkspaceBackup(JSON.stringify(result.workspace));
    expect(payload.courses).toHaveLength(1);
    expect(payload.courses[0].videos[0].progress.is_completed).toBe(true);
  });
  it("stores the full workspace with ownership taken only from the authenticated account", async () => {
    payload.profile.display_name = "Snapshot name";
    const result = (
      await db.query<{ result: { revision: string } }>(
        "select sync_workspace_snapshot($1::jsonb,null,$2) result",
        [JSON.stringify(payload), firstRevision],
      )
    ).rows[0].result;
    expect(result.revision).toBe(firstRevision);
    const cloud = (
      await db.query<{ result: { workspace: Workspace; revision: string } }>(
        "select get_workspace_snapshot() result",
      )
    ).rows[0].result;
    expect(cloud.workspace).toEqual(payload);
    expect(cloud.revision).toBe(firstRevision);
    expect(
      (await db.query("select * from workspace_snapshots")).rows,
    ).toHaveLength(1);
  });
  it("acknowledges an identical request ID without a second write", async () => {
    const changed = {
      ...payload,
      profile: { ...payload.profile, display_name: "Should not replace" },
    };
    await db.query("select sync_workspace_snapshot($1::jsonb,null,$2)", [
      JSON.stringify(changed),
      firstRevision,
    ]);
    const cloud = (
      await db.query<{ result: { workspace: Workspace } }>(
        "select get_workspace_snapshot() result",
      )
    ).rows[0].result;
    expect(cloud.workspace.profile.display_name).toBe("Snapshot name");
  });
  it("rejects stale revisions and permits a compare-and-swap update", async () => {
    await expect(
      db.query("select sync_workspace_snapshot($1::jsonb,null,$2)", [
        JSON.stringify(payload),
        secondRevision,
      ]),
    ).rejects.toMatchObject({ code: "PT409" });
    await db.query("select sync_workspace_snapshot($1::jsonb,$2,$3)", [
      JSON.stringify(payload),
      firstRevision,
      secondRevision,
    ]);
    const cloud = (
      await db.query<{ result: { revision: string } }>(
        "select get_workspace_snapshot() result",
      )
    ).rows[0].result;
    expect(cloud.revision).toBe(secondRevision);
  });
  it("isolates another account and rejects direct client snapshot writes", async () => {
    await asUser("user_snapshot_bob");
    await db.query("select ensure_workspace_profile()");
    expect((await db.query("select * from workspace_snapshots")).rows).toEqual(
      [],
    );
    const cloud = (
      await db.query<{ result: { workspace: Workspace; revision: null } }>(
        "select get_workspace_snapshot() result",
      )
    ).rows[0].result;
    expect(cloud.workspace.courses).toEqual([]);
    expect(cloud.revision).toBeNull();
    await expect(
      db.query("select sync_workspace_snapshot($1::jsonb,$2,$3)", [
        JSON.stringify(payload),
        secondRevision,
        firstRevision,
      ]),
    ).rejects.toMatchObject({ code: "PT409" });
    await expect(
      db.query(
        "insert into workspace_snapshots(user_id,workspace,revision) values(workspace_user_id(),$1::jsonb,$2)",
        [JSON.stringify(payload), firstRevision],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies anonymous snapshot access", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select get_workspace_snapshot()")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("select sync_workspace_snapshot($1::jsonb,null,$2)", [
        JSON.stringify(payload),
        firstRevision,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
