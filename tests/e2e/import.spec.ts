import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/iframe_api", (route) => route.abort());
  await page.route("**/api/youtube", (route) => {
    const { input } = route.request().postDataJSON();
    const id = input.includes("Ke90Tje7VS0") ? "Ke90Tje7VS0" : "j942wKiXFu8";
    const title =
      id === "j942wKiXFu8" ? "React foundations" : "React components";
    return route.fulfill({
      json: {
        title,
        description: "A public lesson for practicing React.",
        channel_name: "Example instructor",
        thumbnail_url: "",
        youtube_playlist_id: null,
        videos: [
          {
            youtube_video_id: id,
            title,
            description: "",
            thumbnail_url: "",
            duration_seconds: 600,
            position: 0,
            availability_status: "available",
          },
        ],
      },
    });
  });
});

async function createManual(page: Page, title: string, id = "j942wKiXFu8") {
  await page
    .getByRole("button", { name: "Create manually", exact: true })
    .click();
  await page.getByLabel("Course title", { exact: true }).fill(title);
  await page.getByLabel("Lesson 1 video URL").fill(`https://youtu.be/${id}`);
  await page.getByLabel("Lesson 1 title", { exact: true }).fill("First lesson");
  await page
    .getByRole("button", { name: "Add to my courses", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

async function addAnotherCourse(page: Page) {
  await page.getByRole("link", { name: "My courses", exact: true }).click();
  await page.getByRole("link", { name: "Add course", exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/new$/);
}

test("YouTube preview saves a course and Add course opens a fresh importer", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Add course", exact: true }).click();
  const link = page.getByPlaceholder(
    "https://www.youtube.com/playlist?list=...",
  );
  await link.fill("https://youtu.be/j942wKiXFu8");
  await page.getByRole("button", { name: "Preview course" }).click();
  await expect(page.getByLabel("Course title", { exact: true })).toHaveValue(
    "React foundations",
  );
  await page
    .getByRole("button", { name: "Add to my courses", exact: true })
    .click();
  await expect(page.locator(".course-workspace-heading:visible h1")).toHaveText(
    "React foundations",
  );

  await addAnotherCourse(page);
  await expect(link).toBeVisible();
  await expect(link).toHaveValue("");
  await link.fill("https://youtu.be/Ke90Tje7VS0");
  await page.getByRole("button", { name: "Preview course" }).click();
  await page
    .getByRole("button", { name: "Add to my courses", exact: true })
    .click();
  await expect(page.locator(".course-workspace-heading:visible h1")).toHaveText(
    "React components",
  );
  await page.reload();
  await expect(page.locator(".course-workspace-heading:visible h1")).toHaveText(
    "React components",
  );
  const titles = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("learntrack-workspace-v1")!).courses.map(
      (course: { title: string }) => course.title,
    ),
  );
  expect(titles).toEqual(["React components", "React foundations"]);
});

test("manual course creation clears the completed form before adding another course", async ({
  page,
}) => {
  await page.goto("/courses/new");
  await createManual(page, "My first course");
  await addAnotherCourse(page);
  await expect(
    page.getByPlaceholder("https://www.youtube.com/playlist?list=..."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create manually", exact: true })
    .click();
  await expect(page.getByLabel("Course title", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Lesson 1 video URL")).toHaveValue("");
  await createManual(page, "My second course", "Ke90Tje7VS0");
});

test("course creation works when the browser has no native randomUUID", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/courses/new");
  await createManual(page, "A course from my local network");
});
