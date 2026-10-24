"use client";
import { useState, useRef } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/stores/workspace";
import { createId } from "@/lib/id";
import {
  lessonQuizSchema,
  latestQuizPass,
  QUIZ_PASS_PERCENT,
  type QuizQuestion,
  type QuizAttempt,
} from "@/lib/quiz";
import { fireConfetti } from "@/lib/confetti";
import { playFeedbackSound } from "@/lib/sounds";
import type { Lesson } from "@/types";

const blankQuestion = (): QuizQuestion => ({
  id: createId(),
  prompt: "",
  options: ["", "", "", ""],
  correct_index: 0,
  explanation: "",
});
export function LessonQuiz({
  lesson,
  onComplete,
}: {
  lesson: Lesson;
  onComplete: () => Promise<void>;
}) {
  const { mutate, notify } = useWorkspace();
  const [mode, setMode] = useState<"overview" | "edit" | "take" | "result">(
    "overview",
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const quiz = lesson.quiz;
  const passed = latestQuizPass(quiz, lesson.quiz_attempts);
  const attempts = (lesson.quiz_attempts || []).filter(
    (a) => a.quiz_version === quiz?.version,
  );
  const best = attempts.length
    ? Math.max(...attempts.map((a) => Math.round((a.correct / a.total) * 100)))
    : null;
  const [attemptVersion, setAttemptVersion] = useState(quiz?.version || "");
  function start() {
    setAnswers({});
    setResult(null);
    setError("");
    setAttemptVersion(quiz!.version);
    setMode("take");
  }
  function edit() {
    setQuestions(quiz ? structuredClone(quiz.questions) : [blankQuestion()]);
    setError("");
    setMode("edit");
  }
  function update(index: number, patch: Partial<QuizQuestion>) {
    setQuestions((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  async function save() {
    const parsed = lessonQuizSchema.safeParse({
      version: createId(),
      questions,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message || "Check your questions and answers.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate({ op: "save_quiz", video_id: lesson.id, quiz: parsed.data });
      setMode("overview");
      notify("Lesson quiz saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save quiz.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!quiz) return;
    if (quiz.questions.some((_, i) => answers[i] === undefined)) {
      setError("Answer every question before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    const id = createId();
    try {
      await mutate({
        op: "submit_quiz",
        video_id: lesson.id,
        id,
        quiz_version: attemptVersion,
        answers: quiz.questions.map((_, i) => answers[i]),
      });
      const saved = useWorkspace
        .getState()
        .data.courses.flatMap((c) => c.videos)
        .find((v) => v.id === lesson.id)
        ?.quiz_attempts?.find((a) => a.id === id);
      if (!saved)
        throw new Error("The result could not be loaded. Please try again.");
      setResult(saved);
      setMode("result");
      requestAnimationFrame(() => resultHeading.current?.focus());
      if (saved.passed && !passed) {
        fireConfetti();
        void playFeedbackSound("achievement");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit quiz.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel lesson-quiz"
      id="lesson-quiz"
      aria-labelledby="lesson-quiz-title"
      tabIndex={-1}
    >
      <div className="quiz-heading">
        <div>
          <span className="section-index">WATCH. RECALL. MAKE IT STICK.</span>
          <h2 id="lesson-quiz-title">
            <CircleHelp size={23} />
            Lesson quiz
          </h2>
        </div>
        <span className={`quiz-status ${passed ? "passed" : ""}`}>
          {passed ? (
            <>
              <Check size={14} />
              Passed
            </>
          ) : quiz ? (
            `${quiz.questions.length} questions`
          ) : (
            "Your knowledge check"
          )}
        </span>
      </div>
      {mode === "overview" && (
        <div className="quiz-overview">
          <div>
            <h3>
              {passed
                ? "You’ve put your learning to the test."
                : lesson.progress.is_completed
                  ? "Lesson complete. How much stuck?"
                  : "Close the loop on this lesson."}
            </h3>
            <p>
              {quiz
                ? `Take a quick knowledge check. Score ${QUIZ_PASS_PERCENT}% to pass, review explanations, and retry whenever you need.`
                : "Create a personal multiple-choice quiz from what you learned. Add four options, the correct answer, and an explanation for each question."}
            </p>
            {best !== null && (
              <p className="quiz-record">
                Best score {best}% · {attempts.length}{" "}
                {attempts.length === 1 ? "attempt" : "attempts"} · Current
                question set
              </p>
            )}
          </div>
          <div className="quiz-actions">
            {quiz && (
              <Button onClick={start}>
                {passed ? "Retake quiz" : "Take quiz"}
                <ArrowRight size={16} />
              </Button>
            )}
            <Button variant={quiz ? "outline" : "default"} onClick={edit}>
              <Pencil size={15} />
              {quiz ? "Edit questions" : "Create lesson quiz"}
            </Button>
          </div>
          {!quiz && (
            <small className="muted">
              Personal quizzes use your own questions. Video imports do not
              include a verified question bank.
            </small>
          )}
        </div>
      )}
      {mode === "edit" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="quiz-editor"
        >
          <p className="muted">
            Write questions from this lesson. Select the correct answer and add
            an explanation. Saving an edit starts a new question set; previous
            attempts stay in your backup.
          </p>
          {questions.map((q, index) => (
            <fieldset className="quiz-question-editor" key={q.id}>
              <legend>QUESTION {index + 1}</legend>
              <label htmlFor={`quiz-prompt-${q.id}`}>Question</label>
              <Textarea
                id={`quiz-prompt-${q.id}`}
                value={q.prompt}
                required
                minLength={5}
                maxLength={1000}
                placeholder="What does this concept help you do?"
                onChange={(e) => update(index, { prompt: e.target.value })}
              />
              <div className="quiz-options-editor">
                {q.options.map((option, choice) => (
                  <div key={choice}>
                    <label className="quiz-correct-choice">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correct_index === choice}
                        onChange={() =>
                          update(index, { correct_index: choice })
                        }
                        aria-label={`Correct answer ${String.fromCharCode(65 + choice)} for question ${index + 1}`}
                      />
                      <span>{String.fromCharCode(65 + choice)}</span>
                    </label>
                    <Input
                      aria-label={`Option ${String.fromCharCode(65 + choice)} for question ${index + 1}`}
                      value={option}
                      required
                      maxLength={500}
                      placeholder={`Answer ${String.fromCharCode(65 + choice)}`}
                      onChange={(e) =>
                        update(index, {
                          options: q.options.map((value, i) =>
                            i === choice ? e.target.value : value,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <small className="muted">
                Choose the circle beside the correct answer.
              </small>
              <label htmlFor={`quiz-explanation-${q.id}`}>
                Explanation <span className="muted">(optional)</span>
              </label>
              <Textarea
                id={`quiz-explanation-${q.id}`}
                value={q.explanation}
                maxLength={2000}
                placeholder="Why is this answer correct?"
                onChange={(e) => update(index, { explanation: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={questions.length === 1 || busy}
                onClick={() =>
                  setQuestions((items) => items.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={14} />
                Remove question {index + 1}
              </Button>
            </fieldset>
          ))}
          <div className="quiz-actions">
            <Button
              type="button"
              variant="outline"
              disabled={questions.length >= 20 || busy}
              onClick={() =>
                setQuestions((items) => [...items, blankQuestion()])
              }
            >
              <Plus size={15} />
              Add question
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save quiz"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMode("overview");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {mode === "take" && quiz && (
        <form
          className="quiz-run"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="muted">
            {Object.keys(answers).length} of {quiz.questions.length} answered ·{" "}
            {QUIZ_PASS_PERCENT}% to pass · Take your time
          </p>
          {quiz.questions.map((q, index) => (
            <fieldset key={q.id} className="quiz-question">
              <legend>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {q.prompt}
              </legend>
              <div className="quiz-answer-options">
                {q.options.map((option, choice) => (
                  <label
                    key={choice}
                    className={answers[index] === choice ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name={`answer-${q.id}`}
                      checked={answers[index] === choice}
                      onChange={() => {
                        setAnswers((values) => ({
                          ...values,
                          [index]: choice,
                        }));
                        setError("");
                      }}
                      disabled={busy}
                    />
                    <span className="quiz-choice-letter">
                      {String.fromCharCode(65 + choice)}
                    </span>
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="quiz-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Checking answers…" : "Submit answers"}
              <ArrowRight size={15} />
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("overview");
                setError("");
              }}
            >
              Leave quiz
            </Button>
          </div>
        </form>
      )}
      {mode === "result" && result && quiz && (
        <div className="quiz-result">
          <div className={`quiz-score ${result.passed ? "passed" : ""}`}>
            <Trophy size={28} />
            <strong>
              {Math.round((result.correct / result.total) * 100)}%
            </strong>
            <span>
              {result.correct} of {result.total} correct
            </span>
          </div>
          <h3 tabIndex={-1} ref={resultHeading}>
            {result.passed
              ? "Knowledge checked. Keep building."
              : "A little review goes a long way."}
          </h3>
          <p className="muted">
            {result.passed
              ? "You passed this lesson’s quiz. Your result is saved."
              : `Score ${QUIZ_PASS_PERCENT}% to pass. Review the answers, revisit your notes, and try again.`}
          </p>
          <div className="quiz-review">
            {quiz.questions.map((q, i) => (
              <div key={q.id}>
                <h4>
                  <span
                    className={
                      result.answers[i] === q.correct_index
                        ? "green-text"
                        : "muted"
                    }
                  >
                    {result.answers[i] === q.correct_index ? "✓" : "↻"}
                  </span>{" "}
                  {q.prompt}
                </h4>
                <p>Your answer: {q.options[result.answers[i]]}</p>
                {result.answers[i] !== q.correct_index && (
                  <p className="green-text">
                    Correct answer: {q.options[q.correct_index]}
                  </p>
                )}
                {q.explanation && (
                  <p className="quiz-explanation">{q.explanation}</p>
                )}
              </div>
            ))}
          </div>
          <div className="quiz-actions">
            {result.passed && !lesson.progress.is_completed && (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await onComplete();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not complete lesson.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Complete lesson"}
                <Check size={15} />
              </Button>
            )}
            <Button variant="outline" onClick={start}>
              <RotateCcw size={15} />
              Try again
            </Button>
            <Button variant="ghost" onClick={() => setMode("overview")}>
              Back to quiz
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="quiz-error">
          {error}
        </p>
      )}
    </section>
  );
}
