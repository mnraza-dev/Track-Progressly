"use client";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Plus,
  Clock,
  Check,
  Download,
  Copy,
  Trash2,
  Bookmark,
  Code2,
  Eye,
  Pencil,
  RotateCcw,
  LoaderCircle,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { Button } from "@/components/ui/button";
import { timestamp, downloadText } from "@/lib/utils";
import { createId } from "@/lib/id";
import type { Lesson, Note } from "@/types";
import type { PlayerHandle } from "@/components/player/youtube-player";
export function LessonNotes({
  lesson,
  player,
}: {
  lesson: Lesson;
  player: React.RefObject<PlayerHandle | null>;
}) {
  const { mutate, notify } = useWorkspace();
  const [tab, setTab] = useState("notes");
  const [editing, setEditing] = useState<Note | null>(lesson.notes[0] || null);
  const [draft, setDraft] = useState(lesson.notes[0]?.content || "");
  const [context, setContext] = useState({
    id: lesson.notes[0]?.id || "",
    timestamp: lesson.notes[0]?.timestamp_seconds || 0,
  });
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(true);
  const [task, setTask] = useState("");
  const [bookmarkLabel, setBookmarkLabel] = useState("");
  const pending = useRef<{
    id: string;
    timestamp: number;
    revision: boolean;
  } | null>(null);
  const dirty = useRef(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
    if (!dirty.current) return;
    if (!pending.current)
      pending.current = {
        id: editing?.id || createId(),
        timestamp:
          editing?.timestamp_seconds ??
          Math.floor(player.current?.position() || 0),
        revision: editing?.is_revision_required || false,
      };
    const current = pending.current;
    const timer = setTimeout(() => {
      void mutate({
        op: "save_note",
        video_id: lesson.id,
        id: current.id,
        content: draft,
        timestamp_seconds: current.timestamp,
        is_revision_required: current.revision,
      })
        .then(() => {
          if (
            pending.current?.id === current.id &&
            draftRef.current === draft
          ) {
            dirty.current = false;
            setSaved(true);
          }
        })
        .catch(() => setSaved(false));
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, editing, lesson.id, mutate, player]);
  useEffect(
    () => () => {
      const p = pending.current;
      if (p && dirty.current)
        void mutate({
          op: "save_note",
          video_id: lesson.id,
          id: p.id,
          content: draftRef.current,
          timestamp_seconds: p.timestamp,
          is_revision_required: p.revision,
        }).catch(() => {});
    },
    [lesson.id, mutate],
  );
  function edit(note: Note | null) {
    if (pending.current && dirty.current) {
      const previous = pending.current;
      void mutate({
        op: "save_note",
        video_id: lesson.id,
        id: previous.id,
        content: draftRef.current,
        timestamp_seconds: previous.timestamp,
        is_revision_required: previous.revision,
      }).catch(() => {});
    }
    dirty.current = false;
    pending.current = note
      ? {
          id: note.id,
          timestamp: note.timestamp_seconds,
          revision: note.is_revision_required,
        }
      : null;
    setContext({ id: note?.id || "", timestamp: note?.timestamp_seconds || 0 });
    setEditing(note);
    setDraft(note?.content || "");
    setSaved(true);
    setPreview(false);
  }
  function exportNotes() {
    downloadText(
      `# ${lesson.title}\n\n${lesson.notes.map((n) => `## ${timestamp(n.timestamp_seconds)}${n.is_revision_required ? " · Needs revision" : ""}\n\n${n.content}`).join("\n\n")}`,
      `${lesson.title.replace(/[^\w -]/g, "")}-notes.md`,
    );
  }
  return (
    <section className="panel lesson-notes">
      <div className="tabs">
        {[
          { key: "notes", label: "My notes", icon: Pencil },
          { key: "practice", label: "Practice", icon: Code2 },
          { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
        ].map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "selected" : ""}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={15} />
            {t.label}
            <span className="tab-count">
              {t.key === "notes"
                ? lesson.notes.length
                : t.key === "practice"
                  ? lesson.tasks.length
                  : lesson.bookmarks.length}
            </span>
          </button>
        ))}
      </div>
      {tab === "notes" && (
        <div className="note-editor-area">
          <div className="note-toolbar">
            <span className="note-save-status">
              {saved ? (
                <Check size={13} />
              ) : (
                <LoaderCircle className="spin" size={13} />
              )}
              {saved ? "All changes saved" : "Saving..."}
            </span>
            <div>
              <button
                className="icon-button"
                title="Preview Markdown"
                aria-label="Preview Markdown"
                onClick={() => setPreview(!preview)}
              >
                {preview ? <Pencil size={16} /> : <Eye size={16} />}
              </button>
              <button
                className="icon-button"
                aria-label="Copy note"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(draft)
                    .then(() => notify("Note copied."));
                }}
              >
                <Copy size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Export lesson notes"
                onClick={exportNotes}
              >
                <Download size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="New timestamped note"
                onClick={() => edit(null)}
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
          <div className="note-context">
            <Clock size={13} />
            <button onClick={() => player.current?.seek(context.timestamp)}>
              {timestamp(context.timestamp)}
            </button>
            <span>Markdown supported</span>
          </div>
          {preview ? (
            <div className="markdown-content">
              <ReactMarkdown>
                {draft || "*Your notes will appear here.*"}
              </ReactMarkdown>
            </div>
          ) : (
            <Textarea
              className="note-editor"
              aria-label="Lesson notes"
              placeholder="What clicked? Capture a key idea, a code snippet, or a question to come back to..."
              value={draft}
              onChange={(e) => {
                if (!pending.current)
                  pending.current = {
                    id: editing?.id || createId(),
                    timestamp:
                      editing?.timestamp_seconds ??
                      Math.floor(player.current?.position() || 0),
                    revision: editing?.is_revision_required || false,
                  };
                setContext({
                  id: pending.current.id,
                  timestamp: pending.current.timestamp,
                });
                dirty.current = true;
                draftRef.current = e.target.value;
                setSaved(false);
                setDraft(e.target.value);
              }}
            />
          )}
          <div className="note-bottom">
            <span>A thought worth keeping is a thought worth writing.</span>
            {editing && (
              <button
                className="revision-toggle"
                onClick={() => {
                  void mutate({
                    op: "save_note",
                    video_id: lesson.id,
                    id: editing.id,
                    content: draft,
                    timestamp_seconds: editing.timestamp_seconds,
                    is_revision_required: !editing.is_revision_required,
                  }).then(() => {
                    const updated = {
                      ...editing,
                      is_revision_required: !editing.is_revision_required,
                    };
                    setEditing(updated);
                    if (pending.current)
                      pending.current.revision = updated.is_revision_required;
                  });
                }}
              >
                <RotateCcw size={12} />
                {editing.is_revision_required
                  ? "Revision marked"
                  : "Mark for revision"}
              </button>
            )}
          </div>
          {lesson.notes.length > 0 && (
            <div className="saved-notes">
              {lesson.notes.map((n) => (
                <div
                  key={n.id}
                  className={context.id === n.id ? "selected-note" : ""}
                >
                  <button onClick={() => edit(n)}>
                    <span>{timestamp(n.timestamp_seconds)}</span>
                    <strong>{n.content.slice(0, 100) || "Empty note"}</strong>
                    {n.is_revision_required && <RotateCcw size={12} />}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Delete note"
                    onClick={() => {
                      if (editing?.id === n.id || pending.current?.id === n.id)
                        edit(null);
                      void mutate({ op: "delete_note", id: n.id });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "practice" && (
        <div className="practice-area">
          <h3>Turn watching into understanding.</h3>
          <p className="muted">
            Watching and practicing are different kinds of progress. Make room
            for both.
          </p>
          <div className="mastery-checklist">
            {["I can explain this concept", "I practiced this concept"].map(
              (title) => {
                const item = lesson.tasks.find((t) => t.title === title);
                return (
                  <label key={title}>
                    <Checkbox
                      checked={item?.is_completed || false}
                      onCheckedChange={() =>
                        void mutate({
                          op: "task",
                          video_id: lesson.id,
                          id: item?.id || createId(),
                          title,
                          is_completed: !item?.is_completed,
                        })
                      }
                    />
                    {title}
                  </label>
                );
              },
            )}
          </div>
          <div className="practice-list">
            {lesson.tasks
              .filter(
                (t) =>
                  ![
                    "I can explain this concept",
                    "I practiced this concept",
                  ].includes(t.title),
              )
              .map((t) => (
                <div key={t.id}>
                  <label>
                    <Checkbox
                      checked={t.is_completed}
                      onCheckedChange={() =>
                        void mutate({
                          op: "task",
                          video_id: lesson.id,
                          id: t.id,
                          title: t.title,
                          is_completed: !t.is_completed,
                        })
                      }
                    />
                    <span className={t.is_completed ? "task-done" : ""}>
                      {t.title}
                    </span>
                  </label>
                  <button
                    className="icon-button"
                    aria-label="Delete practice task"
                    onClick={() => void mutate({ op: "delete_task", id: t.id })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (task.trim())
                void mutate({
                  op: "task",
                  video_id: lesson.id,
                  id: createId(),
                  title: task.trim(),
                  is_completed: false,
                }).then(() => setTask(""));
            }}
          >
            <Input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Build something. Explain a concept. Try an exercise."
              aria-label="New practice task"
            />
            <Button type="submit">
              <Plus size={16} />
              Add task
            </Button>
          </form>
          <span className="secure-hint">
            {lesson.tasks.filter((t) => t.is_completed).length} of{" "}
            {lesson.tasks.length} practice tasks complete
          </span>
        </div>
      )}
      {tab === "bookmarks" && (
        <div className="bookmark-area">
          <h3>Keep the moments that matter.</h3>
          <p className="muted">
            Bookmark an explanation or an example to find it again in one click.
          </p>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate({
                op: "bookmark",
                video_id: lesson.id,
                id: createId(),
                timestamp_seconds: Math.floor(player.current?.position() || 0),
                label: bookmarkLabel.trim() || "An idea worth revisiting",
              }).then(() => {
                setBookmarkLabel("");
                notify("Timestamp bookmarked.");
              });
            }}
          >
            <Input
              value={bookmarkLabel}
              onChange={(e) => setBookmarkLabel(e.target.value)}
              placeholder="What do you want to remember?"
              aria-label="Bookmark label"
            />
            <Button type="submit">
              <Bookmark size={15} />
              Bookmark now
            </Button>
          </form>
          <div className="bookmark-list">
            {lesson.bookmarks.map((b) => (
              <div key={b.id}>
                <button
                  onClick={() => player.current?.seek(b.timestamp_seconds)}
                >
                  <span>{timestamp(b.timestamp_seconds)}</span>
                  {b.label}
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete bookmark"
                  onClick={() =>
                    void mutate({ op: "delete_bookmark", id: b.id })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
