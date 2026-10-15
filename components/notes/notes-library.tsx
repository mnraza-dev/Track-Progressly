"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Search,
  Download,
  StickyNote,
  ArrowUpRight,
  Clock,
  RotateCcw,
  Copy,
  BookOpen,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { downloadText, timestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
export function NotesLibrary() {
  const { data, notify } = useWorkspace();
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(false);
  const all = data.courses.flatMap((c) =>
    c.videos.flatMap((v) =>
      v.notes.map((n) => ({ note: n, lesson: v, course: c })),
    ),
  );
  const notes = all
    .filter(
      (n) =>
        (!revision || n.note.is_revision_required) &&
        `${n.note.content} ${n.lesson.title} ${n.course.title}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.note.updated_at.localeCompare(a.note.updated_at));
  function exportAll() {
    downloadText(
      `# My Progressly notes\n\n${notes.map((n) => `## ${n.course.title}\n### ${n.lesson.title} · ${timestamp(n.note.timestamp_seconds)}\n\n${n.note.content}`).join("\n\n")}`,
      "progressly-notes.md",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE WORTH KEEPING</span>
          <h1>
            My notes<span className="heading-count">{all.length}</span>
          </h1>
          <p>
            Your ideas, your aha moments, and the things you want to remember.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!notes.length}
          onClick={exportAll}
        >
          <Download size={16} />
          Export Markdown
        </Button>
      </div>
      <div className="library-toolbar">
        <div className="search-input">
          <Search size={17} />
          <Input
            aria-label="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notes and lessons..."
          />
        </div>
        <button
          className={`filter-toggle ${revision ? "selected" : ""}`}
          onClick={() => setRevision(!revision)}
        >
          <RotateCcw size={15} />
          Needs revision
        </button>
      </div>
      {notes.length ? (
        <div className="notes-grid">
          {notes.map(({ note, lesson, course }) => (
            <article className="panel note-card" key={note.id}>
              <div className="note-card-meta">
                <span>{course.category}</span>
                {note.is_revision_required && (
                  <span className="revision-badge">
                    <RotateCcw size={11} />
                    Revision
                  </span>
                )}
                <button
                  className="icon-button"
                  aria-label="Copy saved note"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(note.content)
                      .then(() => notify("Note copied."))
                  }
                >
                  <Copy size={15} />
                </button>
              </div>
              <h3>{lesson.title}</h3>
              <p className="note-course-name">
                <BookOpen size={12} />
                {course.title}
              </p>
              <div className="markdown-content note-card-content">
                <ReactMarkdown>{note.content}</ReactMarkdown>
              </div>
              <div className="note-card-footer">
                <Link href={`/courses/${course.id}/learn/${lesson.id}`}>
                  <Clock size={13} />
                  {timestamp(note.timestamp_seconds)}
                </Link>
                <Link href={`/courses/${course.id}/learn/${lesson.id}`}>
                  Open lesson
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="large-empty">
          <div className="empty-icon">
            <StickyNote size={34} strokeWidth={1.4} />
          </div>
          <span className="eyebrow">MAKE THE KNOWLEDGE YOURS</span>
          <h2>
            {all.length ? "No matching notes" : "Let the good ideas stay."}
          </h2>
          <p>
            {all.length
              ? "Try another search or remove the revision filter."
              : "Write a note while you learn. Save a timestamp, capture a code snippet, or leave a question for your future self."}
          </p>
          <Button asChild>
            <Link href="/courses">
              Find a lesson
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
