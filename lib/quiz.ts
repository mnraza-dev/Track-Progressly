import { z } from "zod";

export const quizQuestionSchema = z
  .object({
    id: z.uuid(),
    prompt: z.string().trim().min(5).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).length(4),
    correct_index: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(2000),
  })
  .refine(
    (q) => new Set(q.options.map((s) => s.toLocaleLowerCase())).size === 4,
    {
      message: "Each answer option must be different.",
      path: ["options"],
    },
  );
export const lessonQuizSchema = z
  .object({
    version: z.uuid(),
    questions: z.array(quizQuestionSchema).min(1).max(20),
  })
  .refine(
    (q) =>
      new Set(q.questions.map((item) => item.id)).size === q.questions.length,
    {
      message: "Question IDs must be unique.",
    },
  );
export const quizAttemptSchema = z.object({
  id: z.uuid(),
  quiz_version: z.uuid(),
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(20),
  correct: z.number().int().min(0).max(20),
  total: z.number().int().min(1).max(20),
  passed: z.boolean(),
  completed_at: z.string().datetime({ offset: true }),
});
export type LessonQuiz = z.infer<typeof lessonQuizSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizAttempt = z.infer<typeof quizAttemptSchema>;
export const QUIZ_PASS_PERCENT = 70;
/** Grade against the saved version. Never accept a score provided by a client. */
export function gradeQuiz(
  quiz: LessonQuiz,
  version: string,
  answers: number[],
) {
  if (quiz.version !== version)
    throw new Error(
      "This quiz has changed. Restart to use the latest questions.",
    );
  if (
    answers.length !== quiz.questions.length ||
    answers.some((value) => !Number.isInteger(value) || value < 0 || value > 3)
  )
    throw new Error("Answer every question before submitting.");
  const correct = quiz.questions.filter(
    (q, i) => q.correct_index === answers[i],
  ).length;
  return {
    correct,
    total: quiz.questions.length,
    passed: correct * 100 >= QUIZ_PASS_PERCENT * quiz.questions.length,
  };
}
export function latestQuizPass(
  quiz: LessonQuiz | undefined,
  attempts: QuizAttempt[] = [],
) {
  return (
    !!quiz && attempts.some((a) => a.quiz_version === quiz.version && a.passed)
  );
}
