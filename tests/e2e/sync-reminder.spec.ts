import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";

let directory: string;
let script: string;
let css: string;

// Mount the production component independently of Clerk so browser lifecycle
// dialogs and upload failures can be tested without real accounts or cloud writes.
test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "progressly-sync-reminder-"));
  execFileSync(
    "bun",
    [
      "build",
      resolve(__dirname, "../fixtures/sync-reminder.tsx"),
      "--target=browser",
      "--outdir",
      directory,
      "--define",
      'process.env.NODE_ENV="production"',
    ],
    { cwd: resolve(__dirname, "../.."), stdio: "pipe" },
  );
  script = readFileSync(join(directory, "sync-reminder.js"), "utf8");
  const tokens = readFileSync(
    resolve(__dirname, "../../app/globals.css"),
    "utf8",
  )
    .match(/:root \{[^}]+\}|\.dark \{[^}]+\}/g)
    ?.join("\n");
  css = `${tokens}\n${readFileSync(join(directory, "sync-reminder.css"), "utf8")}`;
});
test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/sync-fixture.js", (route) =>
    route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: script,
    }),
  );
  await page.route("**/sync-fixture.css", (route) =>
    route.fulfill({ contentType: "text/css", body: css }),
  );
  await page.route("**/sync-test", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await page.route("**/signed-out-test", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Signed out</h1>" }),
  );
  await page.route("**/sync-reminder-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/sync-fixture.css"><style>body{background:var(--background);color:var(--foreground);font-family:system-ui;margin:0;padding:20px}main{max-width:1000px;margin:0 auto}button{margin:4px}</style><div id="root"></div><script src="/sync-fixture.js"></script>',
    }),
  );
  await page.goto("/sync-reminder-test");
  await expect(
    page.getByRole("heading", { name: "Learning workspace" }),
  ).toBeVisible();
});

async function stayAfterCloseWarning(page: Page) {
  const warning = page.waitForEvent("dialog");
  const closing = page.close({ runBeforeUnload: true });
  const dialog = await warning;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await closing;
  expect(page.isClosed()).toBe(false);
}

test("warns before leaving unsynced progress and allows leaving after Sync now", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", () => {
    dialogs++;
  });
  await expect(
    page.getByRole("complementary", { name: "Cloud sync" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save learning progress" }).click();
  await expect(
    page.getByText("Sync progress before closing", { exact: true }),
  ).toBeVisible();
  await stayAfterCloseWarning(page);
  await expect(
    page.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeVisible();
  const upload = page.waitForRequest(
    (request) =>
      request.url().endsWith("/sync-test") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await upload;
  await expect(
    page.getByRole("complementary", { name: "Cloud sync" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Learning workspace" }),
  ).toBeVisible();
  expect(dialogs).toBe(1);
});

test("keeps the close warning and offers retry when cloud sync fails", async ({
  page,
}) => {
  await page.route("**/sync-test", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.getByRole("button", { name: "Save learning progress" }).click();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your changes are saved locally",
  );
  await expect(
    page.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeEnabled();
  await stayAfterCloseWarning(page);
});

test("warns during an upload and keeps edits made while it was running pending", async ({
  page,
}) => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/sync-test", async (route) => {
    await pending;
    await route.fulfill({ json: { success: true } });
  });
  await page.getByRole("button", { name: "Save learning progress" }).click();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Syncing…", exact: true }),
  ).toBeDisabled();
  await stayAfterCloseWarning(page);
  await page.getByRole("button", { name: "Save learning progress" }).click();
  finish();
  await expect(
    page.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Sync progress before closing", { exact: true }),
  ).toBeVisible();
  await stayAfterCloseWarning(page);
});

test("routes conflicts to sync settings without overwriting cloud data", async ({
  page,
}) => {
  await page.route("**/sync-test", (route) =>
    route.fulfill({ status: 409, json: { error: "Conflict" } }),
  );
  await page.getByRole("button", { name: "Save learning progress" }).click();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Another device");
  await expect(
    page.getByRole("button", { name: "Sync now", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Review sync settings" }).click();
  await expect(page).toHaveTitle("Sync settings opened");
});

test("does not block sign-out after the account state has been reset", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Save learning progress" }).click();
  await expect(
    page.getByText("Sync progress before closing", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Signed out" })).toBeVisible();
  expect(dialogs).toBe(0);
});

test("keeps the reminder readable in light and dark themes on narrow screens", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "Save learning progress" }).click();
  for (const dark of [false, true]) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      dark,
    );
    await expect(
      page.getByRole("button", { name: "Sync now", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/sync-reminder-${info.project.name}-${dark ? "dark" : "light"}.png`,
    });
  }
});
