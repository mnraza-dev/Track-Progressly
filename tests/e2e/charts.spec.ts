import { test, expect } from "@playwright/test";
import { chartWorkspace } from "../fixtures/workspace";

test("real activity powers chart views, lesson segments, and the interactive 3D timeline", async ({
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
  await page
    .getByRole("combobox", { name: "Analytics period" })
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
    activity.getByRole("cell", { name: "45", exact: true }),
  ).toBeVisible();
  await activity.getByText("View chart data", { exact: true }).click();
  await page.screenshot({
    path: `test-results/charts-analytics-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  await expect(page.locator('[data-chart="course-comparison"]')).toBeVisible();
  await expect(page.locator(".course-chart-links")).toContainText("33%");
  await expect(page.locator(".course-chart-links")).toContainText("25%");
  await expect(page.locator(".course-chart-links")).not.toContainText(
    "Archived course",
  );
  const mix = page.locator(".learning-mix-panel");
  await mix.scrollIntoViewIfNeeded();
  await expect(mix.locator(".donut-center strong")).toHaveText("10");
  await mix
    .getByRole("button", { name: "Completed 3 30%", exact: true })
    .click();
  await expect(mix.locator(".donut-center strong")).toHaveText("3");
  await expect(mix.locator(".donut-center span")).toHaveText("Completed");
  const landscape = page.locator(".landscape-panel");
  await landscape.scrollIntoViewIfNeeded();
  await expect(
    landscape.locator('[data-three-scene="timeline"]'),
  ).toHaveAttribute("data-three-state", "ready", { timeout: 20000 });
  await expect(landscape.locator(".landscape-copy > strong")).toContainText(
    "110",
  );
  await landscape.getByRole("button", { name: /45 minutes$/ }).click();
  await expect(landscape.locator(".landscape-footer strong")).toHaveText(
    "45 minutes",
  );
  await landscape.getByRole("button", { name: "Lessons", exact: true }).click();
  await expect(landscape.locator(".landscape-copy > strong")).toContainText(
    "5",
  );
  await expect(landscape.locator(".landscape-footer strong")).toHaveText(
    "2 lessons",
  );
  await landscape.locator('[data-three-scene="timeline"]').focus();
  await page.keyboard.press("ArrowRight");
  await landscape.getByRole("button", { name: "Reset 3D view" }).click();
  await page.screenshot({
    path: `test-results/charts-dimension-${testInfo.project.name}.png`,
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
    "#648d7b",
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
  const landscape = page.locator(".landscape-panel");
  await landscape.scrollIntoViewIfNeeded();
  await expect(landscape.locator(".scene-fallback")).toBeVisible();
  await expect(landscape.locator(".landscape-copy > strong")).toContainText(
    "0",
  );
  await landscape.getByRole("button", { name: "Lessons", exact: true }).click();
  await expect(landscape.locator(".landscape-footer strong")).toHaveText(
    "0 lessons",
  );
  await expect(page.locator(".donut-center strong")).toHaveText("0");
});
