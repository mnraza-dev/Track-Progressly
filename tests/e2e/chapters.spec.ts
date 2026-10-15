import { test, expect, type Page } from "@playwright/test";
import { chartWorkspace } from "../fixtures/workspace";

type ChapterTestWindow = Window & {
  chapterTest: {
    position: number;
    state: number;
    seeks: number[];
    ready: () => void;
    setPosition: (value: number) => void;
  };
};
const chapterDescription =
  "Learn React at your own pace.\nChapters:\n0:00 Welcome\n01:20 Components\n03:30 Practice\n08:40 Recap";

async function installPlayer(page: Page, deferred = false) {
  await page.addInitScript(
    ({ deferred }) => {
      const state = {
        position: 0,
        state: 0,
        seeks: [] as number[],
        ready: () => {},
        setPosition: (value: number): void => {
          state.position = value;
        },
      };
      (window as unknown as ChapterTestWindow).chapterTest = state;
      class Player {
        constructor(
          element: HTMLElement,
          options: {
            playerVars: Record<string, string | number>;
            events: {
              onReady: () => void;
              onStateChange: (event: { data: number }) => void;
            };
          },
        ) {
          state.position = Number(options.playerVars.start) || 0;
          state.state = 0;
          element.dataset.testPlayer = "true";
          element.textContent = "YouTube player test fixture";
          element.style.cssText =
            "height:100%;display:grid;place-items:center;background:#173f49;color:#bbebd9";
          state.ready = options.events.onReady;
          state.setPosition = (value) => {
            state.position = value;
            state.state = 2;
            options.events.onStateChange({ data: 2 });
          };
          if (!deferred) window.setTimeout(options.events.onReady, 0);
        }
        getCurrentTime() {
          return state.position;
        }
        getDuration() {
          return 600;
        }
        getPlayerState() {
          return state.state;
        }
        seekTo(value: number) {
          state.position = value;
          state.seeks.push(value);
        }
        playVideo() {
          state.state = 1;
        }
        destroy() {
          state.state = -1;
        }
      }
      window.YT = { Player } as unknown as Window["YT"];
    },
    { deferred },
  );
}

test("description chapters navigate the player, queue early seeks, and follow playback", async ({
  page,
}, testInfo) => {
  const data = chartWorkspace();
  data.courses[0].videos[0].description = chapterDescription;
  await page.addInitScript(
    (data) =>
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data)),
    data,
  );
  await installPlayer(page, true);
  await page.goto("/courses/react/learn/lesson-0");
  const chapters = page.getByRole("region", { name: "Video chapters" });
  await expect(
    chapters.getByRole("button", { name: "Jump to Welcome at 0:00" }),
  ).toBeVisible();
  await expect(page.locator("[data-test-player]")).toBeAttached();
  await chapters
    .getByRole("button", { name: "Jump to Practice at 3:30" })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as ChapterTestWindow).chapterTest.seeks,
    ),
  ).toEqual([]);
  await page.evaluate(() =>
    (window as unknown as ChapterTestWindow).chapterTest.ready(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as ChapterTestWindow).chapterTest.seeks,
      ),
    )
    .toEqual([210]);
  await expect(
    chapters.getByRole("button", { name: "Jump to Practice at 3:30" }),
  ).toHaveAttribute("aria-current", "true");
  await chapters
    .getByRole("button", { name: "Jump to Welcome at 0:00" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as ChapterTestWindow).chapterTest.seeks.at(-1),
      ),
    )
    .toBe(0);
  await expect(
    chapters.getByRole("button", { name: "Jump to Welcome at 0:00" }),
  ).toHaveAttribute("aria-current", "true");
  await page.evaluate(() =>
    (window as unknown as ChapterTestWindow).chapterTest.setPosition(90),
  );
  await expect(
    chapters.getByRole("button", { name: "Jump to Components at 1:20" }),
  ).toHaveAttribute("aria-current", "true");
  await chapters.getByLabel("Search video chapters").fill("recap");
  await expect(chapters.getByRole("button", { name: /^Jump to/ })).toHaveCount(
    1,
  );
  await chapters.getByLabel("Search video chapters").fill("nothing here");
  await expect(chapters.getByText(/No chapters match/)).toBeVisible();
  await chapters.getByLabel("Search video chapters").fill("");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("learntrack-workspace-v1")!),
  );
  expect(
    saved.activity.reduce(
      (sum: number, row: { active_seconds: number }) =>
        sum + row.active_seconds,
      0,
    ),
  ).toBeLessThanOrEqual(6605);
  if (testInfo.project.name === "desktop") {
    const side = await chapters.boundingBox();
    const video = await page.locator(".player-container").boundingBox();
    expect(side!.x + side!.width).toBeLessThanOrEqual(video!.x);
  }
  await chapters.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/video-chapters-${testInfo.project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: /^Lessons / }).click();
  await expect(
    page.getByRole("heading", { name: "Your learning path" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Chapters / }).click();
  await expect(chapters).toBeVisible();
});

test("manual videos load chapter metadata with retry and do not carry chapters into another lesson", async ({
  page,
}) => {
  const duplicateKeys: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Encountered two children with the same key"))
      duplicateKeys.push(message.text());
  });
  const data = chartWorkspace();
  data.courses[0].videos[1].youtube_video_id = "Ke90Tje7VS0";
  await page.addInitScript(
    (data) =>
      localStorage.setItem("learntrack-workspace-v1", JSON.stringify(data)),
    data,
  );
  await installPlayer(page);
  let requests = 0;
  await page.route("**/api/youtube", async (route) => {
    requests++;
    const { input } = route.request().postDataJSON();
    if (requests === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Temporary metadata failure" },
      });
    await route.fulfill({
      json: {
        videos: [
          {
            youtube_video_id: input,
            description:
              input === "j942wKiXFu8"
                ? chapterDescription
                : "A lesson without creator timestamps.",
            duration_seconds: 600,
          },
        ],
      },
    });
  });
  await page.goto("/courses/react/learn/lesson-0");
  await page.getByRole("button", { name: /^Chapters / }).click();
  await expect(
    page.getByText("We couldn’t check this video’s chapters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Jump to Practice at 3:30" }),
  ).toBeVisible();
  expect(requests).toBe(2);
  await page
    .getByRole("textbox", { name: "Lesson notes" })
    .fill("First lesson notes.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Lessons / }).click();
  await page.locator(".lesson-item").filter({ hasText: "Lesson 1" }).click();
  await expect(page).toHaveURL(/\/learn\/lesson-1$/);
  await expect(
    page.getByRole("heading", { name: "Lesson 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Lesson notes" })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: /^Chapters / }).click();
  await expect(
    page.getByText(
      "No chapter timestamps were found in this video’s description.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Jump to/ })).toHaveCount(0);
  expect(requests).toBe(3);
  expect(duplicateKeys).toEqual([]);
});
