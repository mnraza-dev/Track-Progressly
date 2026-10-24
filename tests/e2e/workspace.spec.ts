import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/youtube", (route) =>
    route.fulfill({ json: { videos: [] } }),
  );
});
test("manual course, completion, notes, practice and reload persistence", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.text().includes("Encountered two children with the same key"))
      errors.push(message.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A good day to learn" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Add course", exact: true }).click();
  await page.getByRole("button", { name: "Create manually" }).click();
  await page.getByLabel("Course title").fill("My React learning path");
  await page
    .getByLabel("Lesson 1 video URL")
    .fill("https://www.youtube.com/watch?v=j942wKiXFu8");
  await page.getByLabel("Lesson 1 title").fill("Learn React foundations");
  await page.getByRole("button", { name: "Add another lesson" }).click();
  await page
    .getByLabel("Lesson 2 video URL")
    .fill("https://youtu.be/Ke90Tje7VS0");
  await page.getByLabel("Lesson 2 title").fill("Practice React components");
  await page.getByRole("button", { name: "Add to my courses" }).click();
  await expect(
    page.getByRole("heading", { name: "My React learning path", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark as completed", exact: true })
    .click();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Lesson notes" })
    .fill("## Key idea\nComponents make interfaces reusable.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Practice/ }).click();
  await page
    .getByRole("textbox", { name: "New practice task" })
    .fill("Build a counter component");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Build a counter component" })
    .check();
  await expect(page.getByText("1 of 1 practice tasks complete")).toBeVisible();
  await page.screenshot({
    path: `test-results/lesson-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Lesson notes" })).toHaveValue(
    "## Key idea\nComponents make interfaces reusable.",
  );
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "Key idea" })).toBeVisible();
  await page.goto("/goals");
  await page.getByRole("button", { name: "Set a goal", exact: true }).click();
  await page.getByRole("button", { name: "Set my goal" }).click();
  await expect(
    page.getByRole("heading", { name: "Daily learning time" }),
  ).toBeVisible();
  await page.goto("/dashboard#learning-overview");
  await page.getByText("More insights", { exact: true }).click();
  await expect(
    page
      .locator(".course-diag-card")
      .filter({ hasText: "My React learning path" })
      .getByText("50%", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Alex");
  await page.getByRole("button", { name: "Save my preferences" }).click();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("invalid YouTube link is rejected and a free manual fallback is available", async ({
  page,
}) => {
  await page.goto("/courses/new");
  await page
    .getByPlaceholder("https://www.youtube.com/playlist?list=...")
    .fill("https://not-youtube.test");
  await page.getByRole("button", { name: "Preview course" }).click();
  await expect(
    page.getByText("Enter a valid YouTube playlist or video URL or ID."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create manually" }).click();
  await expect(page.getByLabel("Course title")).toBeVisible();
});

test("bookmarks, mastery flags, note revisions, theme and public homepage", async ({
  page,
}) => {
  await page.goto("/courses/new");
  await page.getByRole("button", { name: "Create manually" }).click();
  await page.getByLabel("Course title").fill("My practice course");
  await page
    .getByLabel("Lesson 1 video URL")
    .fill("https://youtu.be/j942wKiXFu8");
  await page.getByLabel("Lesson 1 title").fill("A concept to practice");
  await page.getByRole("button", { name: "Add to my courses" }).click();
  await page.getByRole("button", { name: /^Bookmarks/ }).click();
  await page.getByLabel("Bookmark label").fill("A helpful explanation");
  await page.getByRole("button", { name: "Bookmark now" }).click();
  await expect(
    page.getByRole("button", { name: "0:00 A helpful explanation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Practice/ }).click();
  await page
    .getByRole("checkbox", { name: "I can explain this concept" })
    .check();
  await page
    .getByRole("checkbox", { name: "I practiced this concept" })
    .check();
  await expect(page.getByText("2 of 2 practice tasks complete")).toBeVisible();
  await page.getByRole("button", { name: /^My notes/ }).click();
  await page
    .getByRole("textbox", { name: "Lesson notes", exact: true })
    .fill("Remember to practice.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "0:00 Remember to practice." })
    .click();
  await page.getByRole("button", { name: "Mark for revision" }).click();
  await expect(
    page.getByRole("button", { name: "Revision marked" }),
  ).toBeVisible();
  await page.goto("/notes");
  await page.getByRole("button", { name: "Needs revision" }).click();
  await expect(
    page.getByText("Remember to practice.", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("tab", { name: "Light", exact: true }).click();
  await page.goto("/welcome");
  await expect(
    page.getByRole("heading", { name: /Consistency meets/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get started free" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Bring your curiosity." }),
  ).toBeVisible();
});
