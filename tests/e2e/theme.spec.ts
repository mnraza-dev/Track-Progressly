import { test, expect, type Page } from "@playwright/test";

async function textContrast(page: Page, selectors: string[]) {
  return page.evaluate((selectors) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    function rgba(color: string) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).map(
        (value, index) => (index === 3 ? value / 255 : value),
      );
    }
    function composite(front: number[], back: number[]) {
      return front
        .slice(0, 3)
        .map((value, i) => value * front[3] + back[i] * (1 - front[3]));
    }
    function luminance(rgb: number[]) {
      const channels = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    return selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing contrast sample: ${selector}`);
      const ancestors: HTMLElement[] = [];
      for (
        let parent: HTMLElement | null = element;
        parent;
        parent = parent.parentElement
      )
        ancestors.unshift(parent);
      let background = [255, 255, 255];
      for (const ancestor of ancestors)
        background = composite(
          rgba(getComputedStyle(ancestor).backgroundColor),
          background,
        );
      const foreground = composite(
        rgba(getComputedStyle(element).color),
        background,
      );
      const a = luminance(foreground);
      const b = luminance(background);
      return {
        selector,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  }, selectors);
}

test("light, dark, and system themes persist with readable text and larger typography", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  const themes = page.getByRole("tablist", { name: "Color theme" });
  await expect(
    themes.getByRole("tab", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const samples = [
    "body",
    ".page-heading p",
    ".settings-section-heading p",
    ".form-stack label",
    ".form-stack input",
    '.settings-layout button[type="submit"]',
    ".settings-panel .muted",
    '.theme-options [data-state="active"]',
    '.theme-options [data-state="inactive"]',
    ".settings-help",
    ".connection-status",
    ".settings-panel .eyebrow",
  ];
  for (const theme of ["Dark", "Light"]) {
    await themes.getByRole("tab", { name: theme, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme.toLowerCase(),
    );
    for (const sample of await textContrast(page, samples))
      expect(
        sample.ratio,
        `${theme}: ${sample.selector}`,
      ).toBeGreaterThanOrEqual(4.5);
    await page.addStyleTag({
      content: "nextjs-portal { visibility: hidden !important; }",
    });
    await page.screenshot({
      path: `test-results/settings-${theme.toLowerCase()}-${testInfo.project.name}.png`,
      animations: "disabled",
      fullPage: true,
    });
    await page.reload();
    await expect(
      themes.getByRole("tab", { name: theme, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme.toLowerCase(),
    );
  }
  const type = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
    bodySize: parseFloat(getComputedStyle(document.body).fontSize),
    inputSize: parseFloat(
      getComputedStyle(document.querySelector("input")!).fontSize,
    ),
  }));
  expect(type.body).toContain("DM Sans");
  expect(type.heading).toContain("Space Grotesk");
  expect(type.bodySize).toBeGreaterThanOrEqual(15);
  expect(type.inputSize).toBeGreaterThanOrEqual(15);
  await themes.getByRole("tab", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(themes.getByRole("tab", { name: "System" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.goto("/dashboard");
  await expect(page.locator(".hero-copy h2")).toBeVisible();
  for (const sample of await textContrast(page, [
    ".hero-copy h2",
    ".hero-copy h2 em",
    ".hero-copy p",
    '.hero-copy [data-slot="button"]',
    ".stage-caption p",
    ".stage-chapters button",
  ]))
    expect(sample.ratio, sample.selector).toBeGreaterThanOrEqual(4.5);
});
