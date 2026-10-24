import type { Workspace } from "@/types";
import { completion, localDay, timestamp } from "@/lib/utils";

export type ExportFormat =
  "notes" | "progress" | "activity" | "quizzes" | "backup" | "report";
export const exportFormats = [
  {
    id: "notes",
    title: "Markdown notes",
    extension: ".md",
    description:
      "Your notes, grouped by course with links to the exact video moment.",
  },
  {
    id: "progress",
    title: "Lesson progress",
    extension: ".csv",
    description:
      "Lesson status, watch time, practice, and course completion for spreadsheets.",
  },
  {
    id: "activity",
    title: "Learning activity",
    extension: ".csv",
    description:
      "Your full daily learning history, including study time and completed work.",
  },
  {
    id: "quizzes",
    title: "Quiz results",
    extension: ".csv",
    description:
      "Saved attempts, scores, pass status, and question-set versions by lesson.",
  },
  {
    id: "backup",
    title: "Workspace backup",
    extension: ".json",
    description:
      "All courses, notes, quizzes, attempts, rewards, goals, activity, and preferences.",
  },
  {
    id: "report",
    title: "Print / save PDF",
    extension: "PDF",
    description:
      "A clean progress report. Choose Save as PDF in your browser’s print dialog.",
  },
] as const;

// Quote every cell and neutralize spreadsheet formulas in untrusted text.
export function csvCell(value: string | number | boolean) {
  const text = String(value);
  const safe =
    typeof value === "string" && /^[\s\uFEFF]*[=+@-]/u.test(text)
      ? `'${text}`
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
function csv(rows: (string | number | boolean)[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
function heading(text: string) {
  return text.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]<>#])/g, "\\$1");
}
export function createExport(
  data: Workspace,
  format: ExportFormat,
  courseId = "all",
  now = new Date(),
) {
  const courses =
    courseId === "all"
      ? data.courses
      : data.courses.filter((course) => course.id === courseId);
  const day = localDay(now, data.profile.timezone);
  const scope = courseId === "all" ? "all-courses" : "course";
  const filename = (name: string, extension: string) =>
    `progressly-${name}-${day}.${extension}`;
  if (format === "backup")
    return {
      content: JSON.stringify(
        {
          version: 1,
          app: "progressly",
          exported_at: now.toISOString(),
          workspace: data,
        },
        null,
        2,
      ),
      filename: filename("workspace", "json"),
      mime: "application/json;charset=utf-8",
    };
  if (format === "activity")
    return {
      content: csv([
        [
          "Date",
          "Active seconds",
          "Active minutes",
          "Lessons completed",
          "Practice completed",
          "Courses completed",
        ],
        ...[...data.activity]
          .sort((a, b) => a.day.localeCompare(b.day))
          .map((a) => [
            a.day,
            a.active_seconds,
            Math.round((a.active_seconds / 60) * 100) / 100,
            a.videos_completed,
            a.practice_completed,
            a.courses_completed,
          ]),
      ]),
      filename: filename("activity", "csv"),
      mime: "text/csv;charset=utf-8",
    };
  if (format === "quizzes")
    return {
      content: csv([
        [
          "Course",
          "Lesson",
          "Attempt ID",
          "Question set",
          "Correct",
          "Total",
          "Score %",
          "Passed",
          "Completed at",
        ],
        ...courses.flatMap((c) =>
          c.videos.flatMap((v) =>
            (v.quiz_attempts || []).map((a) => [
              c.title,
              v.title,
              a.id,
              a.quiz_version,
              a.correct,
              a.total,
              Math.round((a.correct / a.total) * 100),
              a.passed,
              a.completed_at,
            ]),
          ),
        ),
      ]),
      filename: filename(`quiz-results-${scope}`, "csv"),
      mime: "text/csv;charset=utf-8",
    };
  if (format === "progress")
    return {
      content: csv([
        [
          "Course",
          "Category",
          "Course status",
          "Course completion %",
          "Lesson",
          "Position",
          "Availability",
          "Lesson status",
          "Completed",
          "Duration seconds",
          "Watched seconds",
          "Last position seconds",
          "Notes",
          "Practice completed",
          "Practice total",
          "Bookmarks",
          "Last watched at",
          "Completed at",
          "Video URL",
        ],
        ...courses.flatMap((c) =>
          [...c.videos]
            .sort((a, b) => a.position - b.position)
            .map((v) => [
              c.title,
              c.category,
              c.status,
              completion(c),
              v.title,
              v.position,
              v.availability_status,
              v.progress.status,
              v.progress.is_completed,
              v.duration_seconds,
              v.progress.watched_seconds,
              v.progress.last_position_seconds,
              v.notes.length,
              v.tasks.filter((t) => t.is_completed).length,
              v.tasks.length,
              v.bookmarks.length,
              v.progress.last_watched_at || "",
              v.progress.completed_at || "",
              `https://www.youtube.com/watch?v=${encodeURIComponent(v.youtube_video_id)}`,
            ]),
        ),
      ]),
      filename: filename(`progress-${scope}`, "csv"),
      mime: "text/csv;charset=utf-8",
    };
  if (format === "notes") {
    const sections = courses.flatMap((c) => {
      const lessons = [...c.videos]
        .sort((a, b) => a.position - b.position)
        .filter((v) => v.notes.length)
        .map(
          (v) =>
            `### ${heading(v.title)}\n\n${[...v.notes]
              .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
              .map(
                (n) =>
                  `#### [${timestamp(n.timestamp_seconds)}](https://www.youtube.com/watch?v=${encodeURIComponent(v.youtube_video_id)}&t=${Math.floor(n.timestamp_seconds)}s)${n.is_revision_required ? " · Needs revision" : ""}\n\n${n.content}`,
              )
              .join("\n\n")}`,
        );
      return lessons.length
        ? [`## ${heading(c.title)}\n\n${lessons.join("\n\n")}`]
        : [];
    });
    return {
      content: `# My Progressly notes\n\nExported ${day}\n\n${sections.join("\n\n") || "No notes in this selection yet."}\n`,
      filename: filename(`notes-${scope}`, "md"),
      mime: "text/markdown;charset=utf-8",
    };
  }
  const lessons = courses
    .flatMap((c) => c.videos)
    .filter((v) => v.availability_status === "available");
  return {
    filename: filename("report", "html"),
    mime: "text/html;charset=utf-8",
    content: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Progressly learning report</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#171717;max-width:960px;margin:48px auto;padding:0 24px}h1{font-size:38px;letter-spacing:-1.5px;margin-bottom:4px}h2{margin-top:36px}small,p{color:#555}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th{font-size:12px;text-transform:uppercase}tr{break-inside:avoid}.stats{border-block:1px solid #ddd;padding:20px 0;margin:28px 0;font-size:18px}a{color:inherit}@page{margin:18mm}@media print{body{margin:0;padding:0;font-size:11pt}h1{font-size:28pt}thead{display:table-header-group}}</style></head><body><small>PROGRESSLY / LEARNING REPORT</small><h1>${escapeHtml(data.profile.display_name || "My learning journey")}</h1><p>Exported ${day} · ${escapeHtml(data.profile.timezone)} · ${courseId === "all" ? "All courses, including archived" : "Selected course"}</p><div class="stats">${courses.length} courses &nbsp; / &nbsp; ${lessons.filter((v) => v.progress.is_completed).length} of ${lessons.length} available lessons complete &nbsp; / &nbsp; ${courses.reduce((sum, c) => sum + c.videos.reduce((n, v) => n + v.notes.length, 0), 0)} notes</div><h2>Course progress</h2><table><thead><tr><th>Course</th><th>Status</th><th>Progress</th><th>Practice</th></tr></thead><tbody>${courses.map((c) => `<tr><td>${escapeHtml(c.title)}<br><small>${escapeHtml(c.category)}</small></td><td>${escapeHtml(c.status.replaceAll("_", " "))}</td><td>${completion(c)}%</td><td>${c.videos.flatMap((v) => v.tasks).filter((t) => t.is_completed).length} / ${c.videos.flatMap((v) => v.tasks).length}</td></tr>`).join("") || '<tr><td colspan="4">No courses in this selection yet.</td></tr>'}</tbody></table><p>Completion uses available lessons and chapter progress for single-video courses. Watching and practice are tracked separately.</p></body></html>`,
  };
}
