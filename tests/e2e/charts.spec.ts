import { test, expect } from "@playwright/test";
import { chartWorkspace } from "../fixtures/workspace";

test("dashboard learning overview shows real activity, lesson status, and course progress", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    (data) =>
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data)),
    chartWorkspace(),
  );
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/dashboard#learning-overview$/, { timeout: 15000 });
  const todayStat = page.locator('[data-tour="stats-grid"] .stat-card').first();
  await expect(todayStat).toContainText("Learning today");
  await expect(todayStat.locator(".stat-value")).toHaveText("18m");
  await page
    .getByRole("combobox", { name: "Learning period" })
    .selectOption("7");
  const activity = page.locator('[data-chart="activity"]');
  await expect(activity.locator(".recharts-area")).toBeVisible();
  await activity
    .getByRole("button", { name: "Show activity as a bar chart" })
    .click();
  await expect(
    activity.locator(".recharts-bar-rectangle").first(),
  ).toBeVisible();
  await activity
    .getByRole("button", { name: "Show activity as an area chart" })
    .click();
  await activity.getByText("View chart data", { exact: true }).click();
  await expect(
    activity.getByRole("cell", { name: "45 Minutes", exact: true }),
  ).toBeVisible();
  await activity.getByText("View chart data", { exact: true }).click();
  await page.screenshot({
    path: `test-results/charts-analytics-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  await expect(
    page.getByRole("link", { name: "Analytics", exact: true }),
  ).toHaveCount(0);
  await page.getByText("More insights", { exact: true }).click();
  const courses = page.locator(".dashboard-studio > .course-grid");
  await expect(courses).toContainText("33%");
  await expect(courses).toContainText("25%");
  await expect(courses).not.toContainText("Archived course");
  await expect(page.locator(".course-diagnostics-panel")).toHaveCount(0);
  const mix = page.locator(".learning-mix-panel");
  await mix.scrollIntoViewIfNeeded();
  await expect(mix.locator(".donut-center strong")).toHaveText("10");
  await mix
    .getByRole("button", { name: "Completed 3 30%", exact: true })
    .click();
  await expect(mix.locator(".donut-center strong")).toHaveText("3");
  await expect(mix.locator(".donut-center span")).toHaveText("Completed");
  await expect(page.locator(".rhythm-panel")).toHaveCount(0);
  const momentum = page.getByRole("region", { name: "Learning momentum" });
  await expect(momentum.getByRole("button")).toHaveCount(365);
  await expect(momentum).toContainText("5 active days");
  const today = momentum.locator('[aria-current="date"]');
  await today.focus();
  await expect(momentum.getByRole("status")).toContainText("18m focused");
  await page.keyboard.press("ArrowLeft");
  await expect(momentum.getByRole("status")).toContainText("0m focused");
  await page.keyboard.press("ArrowRight");
  await expect(today).toBeFocused();
  await page.screenshot({
    path: `test-results/dashboard-insights-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.goto("/goals");
  await expect(page.locator('[data-three-scene="rings"]')).toHaveAttribute(
    "data-three-state",
    "ready",
    { timeout: 20000 },
  );
  await page
    .getByRole("heading", { name: "A little more consistent" })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".recharts-reference-line line")).toHaveAttribute(
    "stroke",
    "var(--chart-2)",
  );
  await page.screenshot({
    path: `test-results/charts-goals-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("empty charts keep their real zero values when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl" || type === "webgl2") return null;
      return getContext.apply(this, [type, ...args] as Parameters<
        typeof getContext
      >);
    } as typeof getContext;
  });
  await page.goto("/analytics");
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "fallback",
    { timeout: 20000 },
  );
  await expect(page.locator(".goal-ring-value strong")).toHaveText("0m");
  await expect(page.locator(".goal-ring-value > span")).toHaveText(
    "of 30m goal",
  );
  await page.getByText("More insights", { exact: true }).click();
  await expect(page.locator(".donut-center strong")).toHaveText("0");
});
