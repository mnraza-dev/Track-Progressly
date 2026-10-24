import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { chartWorkspace } from "../fixtures/workspace";
import { createExport } from "../../lib/exports";

function fixture() {
  const data = chartWorkspace();
  data.courses[0].videos[0].notes.push({
    id: "saved-note",
    content: "Remember React composition.",
    timestamp_seconds: 90,
    is_revision_required: true,
    updated_at: new Date().toISOString(),
  });
  return data;
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem("exports-seeded")) {
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data));
      sessionStorage.setItem("exports-seeded", "true");
    }
  }, fixture());
});

test("downloads scoped notes, lesson CSV, activity CSV, and a complete backup", async ({
  page,
}, testInfo) => {
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Export workspace", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Export course" })
    .selectOption("react");
  for (const [name, extension, includes] of [
    ["Markdown notes", ".md", "Remember React composition."],
    ["Lesson progress", ".csv", "Watched seconds"],
    ["Learning activity", ".csv", "Active minutes"],
    ["Workspace backup", ".json", '"app": "progressly"'],
  ]) {
    await dialog.getByRole("radio", { name: new RegExp(name) }).check();
    const waiting = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download export" }).click();
    const file = await waiting;
    expect(file.suggestedFilename()).toContain(extension);
    const content = await readFile((await file.path())!, "utf8");
    expect(content).toContain(includes);
    if (name === "Lesson progress")
      expect(content).not.toContain("Python for curious minds");
    if (name === "Workspace backup")
      expect(JSON.parse(content).workspace.courses).toHaveLength(3);
  }
  await page.screenshot({
    path: `test-results/exports-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export workspace", exact: true }),
  ).toBeFocused();
});

test("opens an escaped printable report for the selected course", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Export workspace", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Export course" })
    .selectOption("react");
  await dialog.getByRole("radio", { name: /Print \/ save PDF/ }).check();
  // Keep browser printing out of the test's UI while checking the report window.
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => {
      const popup = open(...args);
      if (popup) popup.print = () => {};
      return popup;
    };
  });
  const waiting = page.waitForEvent("popup");
  await dialog
    .getByRole("button", { name: "Print / save PDF", exact: true })
    .click();
  const popup = await waiting;
  await expect(
    popup.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
  await expect(
    popup.getByRole("cell", { name: /React: from ideas/ }),
  ).toBeVisible();
  await expect(popup.getByText("Python for curious minds")).toHaveCount(0);
  await popup.close();
});

test("validates backups, confirms replacement, and preserves restored data after reload", async ({
  page,
}) => {
  await page.goto("/settings");
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"courses":[]}'),
  });
  await expect(page.locator(".export-error")).toContainText(
    "incomplete or invalid",
  );
  const data = fixture();
  data.profile.display_name = "Restored learner";
  await input.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(createExport(data, "backup").content),
  });
  await expect(page.getByRole("dialog")).toContainText("Restoring replaces");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue(
    "Alex",
  );
  await input.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(createExport(data, "backup").content),
  });
  await page.getByRole("button", { name: "Replace and restore" }).click();
  await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue(
    "Restored learner",
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue(
    "Restored learner",
  );
});

test("empty workspace offers backup and explains empty exports", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("learntrack-workspace-v1")!);
    data.courses = [];
    data.activity = [];
    data.goals = [];
    localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Export workspace", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Nothing to export/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Download export" }),
  ).toBeDisabled();
  await dialog.getByRole("radio", { name: /Workspace backup/ }).check();
  await expect(
    dialog.getByRole("button", { name: "Download export" }),
  ).toBeEnabled();
});

test("export options fit a small phone and landscape with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Export workspace", exact: true })
    .click();
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Workspace backup/ }).check();
    await dialog
      .getByRole("button", { name: "Download export" })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("button", { name: "Download export" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/export-${viewport.width}-${testInfo.project.name}.png`,
      animations: "disabled",
    });
  }
});
