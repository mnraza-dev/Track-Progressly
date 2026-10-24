import { describe, it, expect } from "vitest";
import {
  gradeQuiz,
  lessonQuizSchema,
  latestQuizPass,
  type LessonQuiz,
} from "@/lib/quiz";
import { learningTime, duration, timestamp } from "@/lib/utils";
import { createId } from "@/lib/id";
import { applyMutation } from "@/features/courses/local-reducer";
import { createExport } from "@/lib/exports";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import { emptyWorkspace } from "@/types";

function quiz(count = 1): LessonQuiz {
  return {
    version: createId(),
    questions: Array.from({ length: count }, () => ({
      id: createId(),
      prompt: "Which value is immutable?",
      options: ["A string", "An array", "An object", "A map"],
      correct_index: 0,
      explanation: "Strings cannot be mutated in place.",
    })),
  };
}
describe("lesson quizzes", () => {
  it("grades at the exact 70% threshold and rejects incomplete or stale submissions", () => {
    const q = quiz(10);
    expect(gradeQuiz(q, q.version, [0, 0, 0, 0, 0, 0, 0, 1, 1, 1])).toEqual({
      correct: 7,
      total: 10,
      passed: true,
    });
    expect(gradeQuiz(q, q.version, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]).passed).toBe(
      false,
    );
    expect(() => gradeQuiz(q, createId(), Array(10).fill(0))).toThrow(
      /changed/,
    );
    for (const answers of [
      [0],
      Array(10).fill(-1),
      Array(10).fill(4),
      Array(10).fill(0.5),
    ])
      expect(() => gradeQuiz(q, q.version, answers)).toThrow(/every question/);
  });
  it("rejects empty quizzes, ambiguous options, and duplicate question IDs", () => {
    expect(
      lessonQuizSchema.safeParse({ version: createId(), questions: [] })
        .success,
    ).toBe(false);
    const q = quiz();
    q.questions[0].options[1] = "A STRING";
    expect(lessonQuizSchema.safeParse(q).success).toBe(false);
    const duplicate = quiz();
    duplicate.questions.push(duplicate.questions[0]);
    expect(lessonQuizSchema.safeParse(duplicate).success).toBe(false);
  });
  it("persists idempotent attempts, invalidates passes after edits, and includes history in backups", () => {
    let data = applyMutation(emptyWorkspace, {
      op: "create_course",
      course: {
        title: "JS",
        description: "",
        category: "Development",
        channel_name: "",
        thumbnail_url: "",
        youtube_playlist_id: null,
        target_completion_date: null,
        videos: [
          {
            youtube_video_id: "j942wKiXFu8",
            title: "Strings",
            description: "",
            thumbnail_url: "",
            duration_seconds: 3600,
            position: 0,
            availability_status: "available",
          },
        ],
      },
    });
    const video_id = data.courses[0].videos[0].id;
    const q = quiz();
    data = applyMutation(data, { op: "save_quiz", video_id, quiz: q });
    const submission = {
      op: "submit_quiz" as const,
      video_id,
      id: createId(),
      quiz_version: q.version,
      answers: [0],
    };
    data = applyMutation(data, submission);
    data = applyMutation(data, submission);
    const lesson = data.courses[0].videos[0];
    expect(lesson.quiz_attempts).toHaveLength(1);
    expect(latestQuizPass(lesson.quiz, lesson.quiz_attempts)).toBe(true);
    expect(lesson.progress.is_completed).toBe(false);
    expect(parseWorkspaceBackup(createExport(data, "backup").content)).toEqual(
      data,
    );
    const csv = createExport(data, "quizzes").content;
    expect(csv).toContain('"Score %","Passed"');
    expect(csv).toContain('"1","1","100","true"');
    expect(
      createExport(data, "quizzes", "missing").content.split("\r\n"),
    ).toHaveLength(1);
    data = applyMutation(data, {
      op: "save_quiz",
      video_id,
      quiz: { ...q, version: createId() },
    });
    expect(
      latestQuizPass(
        data.courses[0].videos[0].quiz,
        data.courses[0].videos[0].quiz_attempts,
      ),
    ).toBe(false);
    expect(data.courses[0].videos[0].quiz_attempts).toHaveLength(1);
  });
});
describe("consistent learning time", () => {
  it.each([
    [0, "0 Minutes"],
    [1, "1 Minute"],
    [59, "59 Minutes"],
    [60, "1 Hour"],
    [90, "1 Hour 30 Minutes"],
    [120, "2 Hours"],
    [125, "2 Hours 5 Minutes"],
  ])("formats %i minutes as %s", (minutes, label) =>
    expect(learningTime(minutes as number)).toBe(label),
  );
  it("formats long video durations, compact charts, invalid values, and playback clocks", () => {
    expect(duration(3600)).toBe("1 Hour");
    expect(duration(5400)).toBe("1 Hour 30 Minutes");
    expect(learningTime(60, true)).toBe("1h");
    expect(learningTime(90, true)).toBe("1h 30m");
    expect(learningTime(NaN)).toBe("0 Minutes");
    expect(learningTime(-4)).toBe("0 Minutes");
    expect(timestamp(3601)).toBe("1:00:01");
    expect(timestamp(75)).toBe("1:15");
  });
});
