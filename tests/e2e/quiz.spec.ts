import { test, expect } from "@playwright/test";
import { emptyWorkspace, emptyProgress } from "../../types";
import { createId } from "../../lib/id";
const courseId = "11111111-1111-4111-8111-111111111111";
const videoId = "22222222-2222-4222-8222-222222222222";
function fixture(withQuiz = true) {
  const data = structuredClone(emptyWorkspace);
  data.profile.daily_minutes = 60;
  data.courses.push({
    id: courseId,
    title: "JavaScript essentials",
    description: "",
    category: "Development",
    channel_name: "",
    thumbnail_url: "",
    youtube_playlist_id: null,
    status: "in_progress",
    is_favorite: false,
    target_completion_date: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    videos: [
      {
        id: videoId,
        youtube_video_id: "j942wKiXFu8",
        title: "Understanding strings",
        description: "",
        thumbnail_url: "",
        duration_seconds: 3600,
        position: 0,
        availability_status: "available",
        progress: { ...emptyProgress },
        notes: [],
        tasks: [],
        bookmarks: [],
        quiz: withQuiz
          ? {
              version: createId(),
              questions: [
                {
                  id: createId(),
                  prompt: "Which value is immutable?",
                  options: ["A string", "An array", "An object", "A map"],
                  correct_index: 0,
                  explanation: "Strings cannot be changed in place.",
                },
                {
                  id: createId(),
                  prompt: "Which method returns uppercase text?",
                  options: ["toUpperCase()", "push()", "map()", "pop()"],
                  correct_index: 0,
                  explanation: "toUpperCase returns a new uppercase string.",
                },
              ],
            }
          : undefined,
      },
    ],
  });
  return data;
}
async function seed(page: import("@playwright/test").Page, withQuiz = true) {
  await page.route("**/api/youtube", (route) =>
    route.fulfill({ json: { videos: [] } }),
  );
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem("quiz-seeded")) {
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data));
      sessionStorage.setItem("quiz-seeded", "true");
    }
  }, fixture(withQuiz));
  await page.goto(`/courses/${courseId}/learn/${videoId}`);
}
test("grades a lesson quiz, reviews mistakes, retries, completes and persists results", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await expect(page.locator(".course-workspace-heading")).toContainText(
    "1 Hour",
  );
  await page.getByRole("button", { name: "Lesson quiz", exact: true }).click();
  const quiz = page.locator("#lesson-quiz");
  await quiz.getByRole("button", { name: "Take quiz", exact: true }).click();
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  await expect(quiz.getByRole("alert")).toHaveText(
    "Answer every question before submitting.",
  );
  await quiz.getByRole("radio", { name: "B An array", exact: true }).check();
  await quiz
    .getByRole("radio", { name: "A toUpperCase()", exact: true })
    .check();
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  await expect(quiz.locator(".quiz-score strong")).toHaveText("50%");
  await expect(quiz.getByText("Correct answer: A string")).toBeVisible();
  await expect(
    quiz.getByRole("button", { name: "Complete lesson", exact: true }),
  ).toHaveCount(0);
  await quiz.getByRole("button", { name: "Try again" }).click();
  await quiz.getByRole("radio", { name: "A A string", exact: true }).check();
  await quiz
    .getByRole("radio", { name: "A toUpperCase()", exact: true })
    .check();
  await quiz.getByRole("button", { name: "Submit answers" }).click();
  await expect(quiz.locator(".quiz-score strong")).toHaveText("100%");
  await page.screenshot({
    path: `test-results/quiz-passed-${info.project.name}.png`,
    animations: "disabled",
    fullPage: true,
  });
  await quiz
    .getByRole("button", { name: "Complete lesson", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Completed · Undo" }),
  ).toBeVisible();
  await page.reload();
  await expect(quiz.locator(".quiz-status")).toHaveText("Passed");
  await expect(quiz.getByText(/Best score 100% · 2 attempts/)).toBeVisible();
  const attempts = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("learntrack-workspace-v1")!).courses[0]
        .videos[0].quiz_attempts,
  );
  expect(attempts).toHaveLength(2);
  expect(attempts.map((a: { passed: boolean }) => a.passed)).toEqual([
    false,
    true,
  ]);
  await page.getByRole("button", { name: /Export workspace/ }).click();
  await page.getByRole("radio", { name: /Quiz results/ }).check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download export" }).click();
  expect((await download).suggestedFilename()).toMatch(/quiz-results.*\.csv$/);
  expect(errors).toEqual([]);
});
test("authors a custom quiz, validates options, edits version and keeps responsive layouts", async ({
  page,
}, info) => {
  await seed(page, false);
  const quiz = page.locator("#lesson-quiz");
  await quiz.getByRole("button", { name: "Create lesson quiz" }).click();
  await quiz
    .getByLabel("Question", { exact: true })
    .fill("Which value is immutable?");
  for (const [i, option] of [
    "A string",
    "An array",
    "An object",
    "A map",
  ].entries())
    await quiz
      .getByRole("textbox", {
        name: `Option ${String.fromCharCode(65 + i)} for question 1`,
      })
      .fill(option);
  await quiz
    .getByLabel("Explanation (optional)")
    .fill("Strings cannot be changed in place.");
  await quiz.getByRole("button", { name: "Add question" }).click();
  await quiz.getByRole("button", { name: "Remove question 2" }).click();
  await page.screenshot({
    path: `test-results/quiz-editor-${info.project.name}.png`,
    animations: "disabled",
    fullPage: true,
  });
  await quiz.getByRole("button", { name: "Save quiz", exact: true }).click();
  await expect(
    quiz.getByRole("button", { name: "Take quiz", exact: true }),
  ).toBeVisible();
  await page.reload();
  await quiz.getByRole("button", { name: "Edit questions" }).click();
  await quiz
    .getByRole("textbox", { name: "Option B for question 1" })
    .fill("A STRING");
  await quiz.getByRole("button", { name: "Save quiz", exact: true }).click();
  await expect(quiz.getByRole("alert")).toHaveText(
    "Each answer option must be different.",
  );
  await quiz
    .getByRole("textbox", { name: "Option B for question 1" })
    .fill("An array");
  await quiz.getByRole("button", { name: "Save quiz", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.goto("/dashboard");
  await expect(page.locator(".goal-ring-value > span")).toHaveText(
    "of 1h goal",
  );
});
