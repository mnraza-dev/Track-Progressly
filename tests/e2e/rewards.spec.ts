import { test, expect } from "@playwright/test";
import { emptyWorkspace, emptyProgress } from "../../types";
import { createId } from "../../lib/id";

const courseId = "11111111-1111-4111-8111-111111111111";
const videoId = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const data = structuredClone(emptyWorkspace);
  data.profile.display_name = "Alex";
  data.courses.push({
    id: courseId,
    title: "Build a daily practice",
    description: "",
    category: "Development",
    channel_name: "",
    thumbnail_url: "",
    youtube_playlist_id: null,
    status: "in_progress",
    is_favorite: false,
    target_completion_date: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    videos: ["j942wKiXFu8", "Ke90Tje7VS0"].map((youtube_video_id, i) => ({
      id: i === 0 ? videoId : createId(),
      youtube_video_id,
      title: `Lesson ${i + 1}`,
      description: "",
      thumbnail_url: "",
      duration_seconds: 600,
      position: i,
      availability_status: "available" as const,
      progress: { ...emptyProgress },
      notes: [],
      tasks: [],
      bookmarks: [],
    })),
  });
  return data;
}
type AudioTestWindow = Window & {
  soundTest: { voices: number; stops: number };
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/youtube", (route) =>
    route.fulfill({ json: { videos: [] } }),
  );
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem("rewards-seeded")) {
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data));
      sessionStorage.setItem("rewards-seeded", "true");
    }
    const soundTest = { voices: 0, stops: 0 };
    (window as unknown as AudioTestWindow).soundTest = soundTest;
    const node = () => ({
      connect() {},
      disconnect() {},
      frequency: { setValueAtTime() {} },
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      start() {
        soundTest.voices++;
      },
      stop() {
        soundTest.stops++;
      },
    });
    class Audio {
      state = "running";
      destination = {};
      get currentTime() {
        return performance.now() / 1000;
      }
      async resume() {
        this.state = "running";
      }
      createOscillator() {
        return node();
      }
      createGain() {
        return node();
      }
    }
    window.AudioContext = Audio as unknown as typeof AudioContext;
  }, fixture());
});

test("shows the generated collection, locked previews, XP rules and filters", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Achievements & Badges/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Your effort. Made visible." }),
  ).toBeVisible();
  await expect(dialog.locator(".level-collectible")).toHaveCount(8);
  await dialog.getByRole("button", { name: /Level 8: Grand Scholar/ }).click();
  await expect(
    dialog.getByRole("region", { name: "Level details" }),
  ).toContainText("The Crown of Craft");
  await expect(
    dialog.getByRole("region", { name: "Level details" }),
  ).toContainText("4,500 more XP");
  await expect(
    dialog.getByRole("button", { name: "Celebrate this level" }),
  ).toHaveCount(0);
  await dialog.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: `test-results/badge-collection-${info.project.name}.png`,
    fullPage: false,
    animations: "disabled",
  });
  await dialog.getByRole("tab", { name: /Achievements/ }).click();
  await dialog.getByRole("button", { name: "Earned", exact: true }).click();
  await expect(
    dialog.getByText(/Your first milestone is waiting/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "All", exact: true }).click();
  await expect(dialog.locator(".milestone-card")).toHaveCount(10);
  await dialog.getByRole("tab", { name: "XP & sound" }).click();
  await expect(
    dialog.getByText("Seeking through chapters does not earn XP.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as AudioTestWindow).soundTest.voices,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("awards a level and keeps XP through undo, replay, reload, and archive", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/courses/${courseId}/learn/${videoId}`);
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  const reward = page.getByRole("complementary", { name: "Learning reward" });
  await expect(reward).toContainText("Level 2 unlocked");
  await expect(reward).toContainText("+170 XP EARNED");
  expect(
    await page.evaluate(
      () => (window as unknown as AudioTestWindow).soundTest.voices,
    ),
  ).toBe(0);
  await page.screenshot({
    path: `test-results/level-up-${info.project.name}.png`,
    animations: "disabled",
  });
  await reward.getByRole("button", { name: "Dismiss learning reward" }).click();
  await page
    .getByRole("button", { name: "Completed · Undo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  await expect(reward).toHaveCount(0);
  await page.reload();
  await expect(reward).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("learntrack-workspace-v1")!),
  );
  expect(
    Object.values(saved.rewards.events).reduce(
      (n: number, event) => n + (event as { xp: number }).xp,
      0,
    ),
  ).toBe(170);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Achievements & Badges/ }).click();
  await expect(page.getByRole("dialog")).toContainText("170 XP");
  await expect(
    page.getByRole("button", { name: /Level 2: Dedicated Apprentice, earned/ }),
  ).toBeVisible();
});

test("sound is opt-in, previews play, mute and volume persist", async ({
  page,
}) => {
  await page.goto("/settings");
  const sound = page.getByRole("switch", {
    name: "Sound effects",
    exact: true,
  });
  const preview = page.getByRole("button", {
    name: "Preview celebration sound",
  });
  await expect(sound).not.toBeChecked();
  await expect(preview).toBeDisabled();
  await sound.check();
  await preview.click();
  await expect(
    page.getByText("Preview played.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as AudioTestWindow).soundTest.voices,
    ),
  ).toBe(5);
  await page.getByRole("slider", { name: "Sound effect volume" }).focus();
  await page.getByRole("slider", { name: "Sound effect volume" }).press("Home");
  await expect(preview).toBeDisabled();
  await page.reload();
  await expect(sound).toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Sound effect volume" }),
  ).toHaveValue("0");
  await sound.uncheck();
  await page.goto(`/courses/${courseId}/learn/${videoId}`);
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as AudioTestWindow).soundTest.voices,
    ),
  ).toBe(0);
});

test("an enabled milestone chime plays once and repeat completion stays silent", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("switch", { name: "Sound effects", exact: true })
    .check();
  await page.goto(`/courses/${courseId}/learn/${videoId}`);
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Learning reward" }),
  ).toContainText("Level 2 unlocked");
  expect(
    await page.evaluate(
      () => (window as unknown as AudioTestWindow).soundTest.voices,
    ),
  ).toBe(5);
  await page.getByRole("button", { name: "Dismiss learning reward" }).click();
  await page
    .getByRole("button", { name: "Completed · Undo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as AudioTestWindow).soundTest.voices,
    ),
  ).toBe(5);
});

test("localStorage quota falls back to IndexedDB and keeps courses exportable after reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "learntrack-workspace-v1" &&
        sessionStorage.getItem("rewards-seeded")
      )
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex" }),
  ).toBeVisible();
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Export workspace", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("radio", { name: /Workspace backup/ })
    .check();
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Download export" })
    .click();
  expect((await download).suggestedFilename()).toContain(".json");
});
