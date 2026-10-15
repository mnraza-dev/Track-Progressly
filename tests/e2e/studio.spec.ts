import { test, expect } from "@playwright/test";
test("3D studio renders through one context, responds to input, and stays responsive", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "ready",
    { timeout: 20000 },
  );
  await expect(page.locator('[data-three-scene="hero"]')).toHaveAttribute(
    "data-three-state",
    "ready",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-active-scenes",
    /^[1-9]/,
  );
  const scene = page.locator('[data-three-scene="hero"]');
  await scene.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await scene.getByRole("button", { name: "Reset 3D view" }).click();
  await page.screenshot({
    path: `test-results/studio-dashboard-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  await page
    .getByRole("heading", { name: "Follow your curiosity" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-three-scene="code"]').first(),
  ).toHaveAttribute("data-three-state", "ready");
  await page.screenshot({
    path: `test-results/studio-objects-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await page.goto("/welcome");
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "ready",
  );
  await page.screenshot({
    path: `test-results/studio-landing-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("reduced-motion mode renders the studio and quick import pre-fills the importer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "ready",
    { timeout: 20000 },
  );
  await page
    .getByLabel("One link. A fresh start.")
    .fill("https://youtu.be/j942wKiXFu8");
  await page.getByRole("button", { name: "Import this YouTube link" }).click();
  await expect(
    page.getByPlaceholder("https://www.youtube.com/playlist?list=..."),
  ).toHaveValue("https://youtu.be/j942wKiXFu8");
});

test("WebGL context loss falls back and restores without disrupting the workspace", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "ready",
    { timeout: 20000 },
  );
  const available = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "canvas.studio-webgl",
    )!;
    const gl = canvas.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    (window as Window & { testContext?: WEBGL_lose_context }).testContext =
      extension;
    extension.loseContext();
    return true;
  });
  test.skip(
    !available,
    "The browser driver does not support WebGL context loss simulation.",
  );
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "fallback",
  );
  await expect(
    page.locator('[data-three-scene="hero"] .scene-fallback'),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as Window & { testContext?: WEBGL_lose_context }
    ).testContext?.restoreContext(),
  );
  await expect(page.locator("canvas.studio-webgl")).toHaveAttribute(
    "data-engine",
    "ready",
    { timeout: 20000 },
  );
  await page.getByRole("link", { name: "Add course", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create manually" }),
  ).toBeVisible();
});
