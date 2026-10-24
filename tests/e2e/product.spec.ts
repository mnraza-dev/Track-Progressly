import { test, expect } from "@playwright/test";
import { chartWorkspace } from "../fixtures/workspace";

test("product showcase switches chapters, explains the product, and opens the workspace", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/welcome");
  await page.addStyleTag({
    content: "nextjs-portal { visibility: hidden !important; }",
  });
  const stage = page.locator(".product-stage");
  await stage.scrollIntoViewIfNeeded();
  await expect(stage.locator('[data-three-scene="hero"]')).toHaveAttribute(
    "data-three-state",
    "ready",
    { timeout: 20000 },
  );
  await stage.getByRole("button", { name: /Practice/ }).click();
  await expect(
    stage.getByText("Make it click.", { exact: true }),
  ).toBeVisible();
  await expect(stage.locator('[data-three-scene="code"]')).toHaveAttribute(
    "data-three-state",
    "ready",
  );
  await stage.getByRole("button", { name: /Remember/ }).click();
  await expect(
    stage.getByText("Keep the good bits.", { exact: true }),
  ).toBeVisible();
  await expect(stage.locator('[data-three-scene="books"]')).toHaveAttribute(
    "data-three-state",
    "ready",
  );
  await stage.getByRole("button", { name: /Watch/ }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/product-welcome-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  await page.getByText("Do I need a YouTube account?", { exact: true }).click();
  await expect(
    page.getByText(/Progressly uses public YouTube videos/),
  ).toBeVisible();
  await page
    .getByText("Can I start without setting anything up?", { exact: true })
    .click();
  await expect(
    page.getByText(/The local workspace saves your courses/),
  ).toBeVisible();
  await page.locator(".product-bento").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/product-features-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.getByRole("link", { name: "Find your next chapter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "A good day to learn" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("product tour uses isolated data and keeps both themes readable", async ({
  page,
}, testInfo) => {
  await page.addInitScript(
    (data) =>
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data)),
    chartWorkspace(),
  );
  await page.goto("/dashboard");
  await page.addStyleTag({
    content: "nextjs-portal { visibility: hidden !important; }",
  });
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show 3D interactive stage", exact: true })
    .click();
  await expect(
    page.locator('.resume-3d-stage [data-three-scene="code"]'),
  ).toHaveAttribute("data-three-state", "ready", { timeout: 20000 });
  if (
    testInfo.project.name === "desktop" &&
    process.env.UPDATE_PRODUCT_SHOTS === "1"
  ) {
    await page.screenshot({
      path: "docs/images/workspace.jpg",
      type: "jpeg",
      quality: 90,
      animations: "disabled",
    });
    await page.goto("/analytics");
    await page.addStyleTag({
      content: "nextjs-portal { visibility: hidden !important; }",
    });
    await page
      .getByRole("combobox", { name: "Analytics period" })
      .selectOption("7");
    await expect(page.locator(".recharts-area")).toBeVisible();
    await page.screenshot({
      path: "docs/images/analytics.jpg",
      type: "jpeg",
      quality: 90,
      animations: "disabled",
    });
  }
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Dark", exact: true }).click();
  await page.goto("/dashboard");
  await page.addStyleTag({
    content: "nextjs-portal { visibility: hidden !important; }",
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Show 3D interactive stage", exact: true })
    .click();
  await expect(
    page.locator('.resume-3d-stage [data-three-scene="code"]'),
  ).toHaveAttribute("data-three-state", "ready", { timeout: 20000 });
  await page.screenshot({
    path: `test-results/product-dark-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
