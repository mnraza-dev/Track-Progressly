import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "@playwright/test";
let directory: string;
let script: string;
let css: string;
const channel = "telusko_courses";
const video = (id: number) => ({
  source: "telegram",
  telegram_post: `${channel}/${id}`,
  youtube_video_id: "",
  title: `Telegram lesson ${id}`,
  description: "A programming lesson",
  thumbnail_url: "",
  duration_seconds: 0,
  position: id,
  availability_status: "available",
});
const preview = {
  title: "Telusko courses",
  description: "Programming",
  channel_name: channel,
  telegram_channel: channel,
  thumbnail_url: "",
  youtube_playlist_id: null,
};

test.beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "progressly-telegram-"));
  execFileSync(
    "bun",
    [
      "build",
      resolve(__dirname, "../fixtures/telegram.tsx"),
      "--target=browser",
      "--outdir",
      directory,
      "--define",
      'process.env={"NODE_ENV":"production","NEXT_PUBLIC_SUPABASE_URL":"","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":""}',
    ],
    { cwd: resolve(__dirname, "../.."), stdio: "pipe" },
  );
  script = readFileSync(join(directory, "telegram.js"), "utf8");
  const root = resolve(__dirname, "../..");
  const compiled = await compile(
    '@import "./app/globals.css"; @import "./app/product.css"; @import "./app/quiz.css";',
    { base: root, onDependency: () => {} },
  );
  const scanner = new Scanner({
    sources: [
      {
        base: root,
        pattern: "{app,components,features}/**/*.{ts,tsx}",
        negated: false,
      },
    ],
  });
  css = compiled.build(scanner.scan());
});
test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  await page.route("**/telegram-fixture.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: script }),
  );
  await page.route("**/telegram-fixture.css", (route) =>
    route.fulfill({ contentType: "text/css", body: css }),
  );
  await page.route("**/telegram-test**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/telegram-fixture.css"><style>body{background:var(--background);color:var(--foreground);font-family:system-ui;margin:0;padding:20px}main{max-width:1200px;margin:0 auto}button,input,textarea,select{font:inherit}input,textarea{max-width:100%;box-sizing:border-box}button{cursor:pointer}a{color:inherit}</style><div id="root"></div><script src="/telegram-fixture.js"></script></html>',
    }),
  );
  await page.route("**/api/telegram", (route) => {
    const { before } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        ...preview,
        videos: [video(before ? 10 : 30)],
        next_before: before ? null : "20",
      },
    });
  });
  await page.route("https://telegram.org/js/telegram-widget.js*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `const script = document.currentScript; const frame = document.createElement('iframe'); frame.src = 'https://t.me/' + script.getAttribute('data-telegram-post') + '?embed=1'; frame.style.width='100%'; frame.height='280'; script.parentElement.appendChild(frame);`,
    }),
  );
  await page.route("https://t.me/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Telegram post player</p>",
    }),
  );
});

test("automatically imports channel history, embeds posts, and preserves learning across refresh and reload", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const youtubeRequests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (/api\/youtube|youtube.com\/iframe_api/.test(request.url()))
      youtubeRequests.push(request.url());
  });
  await page.goto("/telegram-test");
  await page.getByRole("button", { name: "Import from Telegram" }).click();
  await expect(
    page.getByLabel("Telegram channel link or username"),
  ).toHaveValue("https://t.me/telusko_courses");
  await page.getByRole("button", { name: "Preview channel" }).click();
  await expect(page.getByLabel("Course title", { exact: true })).toHaveValue(
    "Telusko courses",
  );
  await expect(page.locator(".preview-lessons > div")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Add to my courses", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Telegram lesson 10", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTitle("Telegram video: Telegram lesson 10"),
  ).toHaveAttribute("src", `https://t.me/${channel}/10?embed=1`);
  await expect(
    page.getByRole("button", { name: "Save progress", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Playback speed", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /^Chapters/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Bookmarks/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  await page
    .getByLabel("Lesson notes", { exact: true })
    .fill("Keep this programming idea.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh channel videos" }).click();
  await expect(
    page.getByRole("button", { name: "Refresh channel videos" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Completed · Undo", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Lesson notes", { exact: true })).toHaveValue(
    "Keep this programming idea.",
  );
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("learntrack-workspace-v1")!),
  );
  expect(stored.courses[0].videos).toHaveLength(2);
  expect(stored.courses[0].videos[0].progress.watched_seconds).toBe(0);
  expect(youtubeRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `test-results/telegram-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("reports discovery failures without saving a partial course, then permits retry", async ({
  page,
}) => {
  await page.route("**/api/telegram", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Telegram could not be reached. Please retry." },
    }),
  );
  await page.goto("/telegram-test");
  await page.getByRole("button", { name: "Import from Telegram" }).click();
  await page.getByRole("button", { name: "Preview channel" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Telegram could not be reached",
  );
  await expect(
    page.getByRole("button", { name: "Preview channel" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("learntrack-workspace-v1")!).courses
          .length,
    ),
  ).toBe(0);
});

test("shows a usable original-post link when Telegram’s widget fails", async ({
  page,
}) => {
  await page.route("https://telegram.org/js/telegram-widget.js*", (route) =>
    route.abort(),
  );
  await page.goto("/telegram-test");
  await page.getByRole("button", { name: "Import from Telegram" }).click();
  await page.getByRole("button", { name: "Preview channel" }).click();
  await page
    .getByRole("button", { name: "Add to my courses", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("player could not load");
  await expect(
    page.getByRole("button", { name: "Retry player" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in Telegram", exact: true }),
  ).toHaveAttribute("href", `https://t.me/${channel}/10`);
});
