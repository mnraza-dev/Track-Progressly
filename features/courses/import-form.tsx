"use client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SceneArtwork } from "@/components/three/scene-provider";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  SquarePlay as Youtube,
  Link2,
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  CheckCircle2,
  ListVideo,
  LoaderCircle,
  ShieldCheck,
  BookOpen,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/stores/workspace";
import { parseYouTube } from "@/lib/youtube/parse";
import { duration } from "@/lib/utils";
import { CourseArtwork } from "@/components/courses/course-card";
import type { ImportPreview } from "@/types";
const schema = z.object({
  input: z
    .string()
    .trim()
    .min(1, "Paste a YouTube URL or ID.")
    .refine((value) => {
      try {
        parseYouTube(value);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid YouTube playlist or video URL or ID."),
});
export function ImportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate, notify, data } = useWorkspace();
  const [tab, setTab] = useState("youtube");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(
    params.get("category") || "Development",
  );
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [links, setLinks] = useState([{ url: "", title: "" }]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { input: params.get("url") || "" },
  });
  async function getPreview({ input }: z.infer<typeof schema>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
      setTitle(result.title);
      setDescription(result.description);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    setError("");
    setBusy(true);
    try {
      let source = preview;
      if (tab === "manual") {
        if (!title.trim()) throw new Error("Give your course a title.");
        const videos = links
          .filter((l) => l.url.trim())
          .map((l, position) => {
            const parsed = parseYouTube(l.url);
            if (parsed.type !== "video")
              throw new Error("Manual lessons need individual video links.");
            if (!l.title.trim())
              throw new Error(
                "Give each lesson a title. YouTube metadata is not fetched for manual courses.",
              );
            return {
              youtube_video_id: parsed.id,
              title: l.title.trim(),
              description: "",
              thumbnail_url: "",
              duration_seconds: 0,
              position,
              availability_status: "available" as const,
            };
          });
        if (!videos.length) throw new Error("Add at least one video link.");
        if (
          new Set(videos.map((v) => v.youtube_video_id)).size !== videos.length
        )
          throw new Error("Each lesson must have a different video link.");
        source = {
          title,
          description,
          channel_name: "",
          thumbnail_url: "",
          youtube_playlist_id: null,
          videos,
        };
      }
      if (!source) throw new Error("Preview your import first.");
      const existing = new Set(data.courses.map((c) => c.id));
      await mutate({
        op: "create_course",
        course: {
          ...source,
          title: title.trim() || source.title,
          description,
          category,
          target_completion_date: deadline || null,
        },
      });
      const added = useWorkspace
        .getState()
        .data.courses.find((c) => !existing.has(c.id));
      notify("Your course is ready. Let’s make progress!");
      router.push(added ? `/courses/${added.id}` : "/courses");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create course.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="import-page">
      <Link href="/courses" className="back-link">
        <ArrowLeft size={15} />
        Back to my courses
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR NEXT CHAPTER</div>
          <h1>Bring your curiosity.</h1>
          <p>
            Turn a YouTube playlist into a learning path you’ll actually finish.
          </p>
        </div>
      </div>
      <div className="import-layout">
        <section className="panel import-panel">
          <div className="tabs">
            <button
              className={tab === "youtube" ? "selected" : ""}
              onClick={() => {
                setTab("youtube");
                setError("");
              }}
            >
              <Youtube size={17} />
              Import from YouTube
            </button>
            <button
              className={tab === "manual" ? "selected" : ""}
              onClick={() => {
                setTab("manual");
                setError("");
              }}
            >
              <BookOpen size={17} />
              Create manually
            </button>
          </div>
          {tab === "youtube" && !preview ? (
            <form
              onSubmit={form.handleSubmit(getPreview)}
              className="form-stack"
            >
              <div className="import-icon">
                <Youtube size={34} />
              </div>
              <h2>One link. A whole new possibility.</h2>
              <p className="muted">
                Paste a playlist, video URL, or YouTube ID. We’ll organize the
                lessons for you.
              </p>
              <label>
                YouTube link or ID
                <div className="input-with-icon">
                  <Link2 size={17} />
                  <Input
                    className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                    {...form.register("input")}
                    placeholder="https://www.youtube.com/playlist?list=..."
                  />
                </div>
              </label>
              {form.formState.errors.input && (
                <p className="field-error">
                  {form.formState.errors.input.message}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ListVideo size={17} />
                )}
                {busy ? "Finding your lessons..." : "Preview course"}
                <ArrowRight size={16} />
              </Button>
              <span className="secure-hint">
                <ShieldCheck size={14} />
                Videos play on YouTube. Your learning stays organized here.
              </span>
            </form>
          ) : (
            <div className="form-stack">
              {preview && tab === "youtube" && (
                <div className="import-preview-heading">
                  <CourseArtwork
                    category={category}
                    title={preview.title}
                    thumbnail={preview.thumbnail_url}
                  />
                  <div>
                    <span className="success-label">
                      <CheckCircle2 size={14} />
                      Ready to import
                    </span>
                    <h3>{preview.title}</h3>
                    <p>{preview.channel_name}</p>
                    <span>
                      <ListVideo size={14} />
                      {preview.videos.length} lessons <Clock size={14} />
                      {duration(
                        preview.videos.reduce(
                          (n, v) => n + v.duration_seconds,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                </div>
              )}
              <label>
                Course title
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What will you learn?"
                  maxLength={250}
                />
              </label>
              <div className="form-row">
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {[
                      "Development",
                      "Data & Python",
                      "Design",
                      "Business",
                      "Languages",
                      "Personal growth",
                      "Other",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target completion date <span>(optional)</span>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Description or learning intention
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="I want to learn this so I can..."
                />
              </label>
              {tab === "manual" && (
                <div className="manual-lessons">
                  <h3>Your lessons</h3>
                  <p className="muted">
                    Add video links and give each lesson a title.
                  </p>
                  {links.map((link, index) => (
                    <div key={index} className="manual-lesson">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <Input
                          aria-label={`Lesson ${index + 1} video URL`}
                          placeholder="YouTube video URL"
                          value={link.url}
                          onChange={(e) =>
                            setLinks(
                              links.map((l, i) =>
                                i === index ? { ...l, url: e.target.value } : l,
                              ),
                            )
                          }
                        />
                        <Input
                          aria-label={`Lesson ${index + 1} title`}
                          placeholder="Lesson title"
                          value={link.title}
                          onChange={(e) =>
                            setLinks(
                              links.map((l, i) =>
                                i === index
                                  ? { ...l, title: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Remove lesson ${index + 1}`}
                        onClick={() =>
                          setLinks(links.filter((_, i) => i !== index))
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setLinks([...links, { url: "", title: "" }])}
                  >
                    <Plus size={16} />
                    Add another lesson
                  </Button>
                </div>
              )}
              {preview && tab === "youtube" && (
                <div className="preview-lessons">
                  {preview.videos.slice(0, 8).map((v, i) => (
                    <div key={v.youtube_video_id}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <span>
                        {v.title}
                        {v.availability_status !== "available" && (
                          <small>Unavailable · excluded from progress</small>
                        )}
                      </span>
                      <small>{duration(v.duration_seconds)}</small>
                    </div>
                  ))}
                  {preview.videos.length > 8 && (
                    <p className="muted">
                      And {preview.videos.length - 8} more lessons, in playlist
                      order.
                    </p>
                  )}
                </div>
              )}
              <div className="form-actions">
                {preview && tab === "youtube" && (
                  <Button variant="ghost" onClick={() => setPreview(null)}>
                    Change link
                  </Button>
                )}
                <Button disabled={busy} onClick={create}>
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Add to my courses
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}
          {error && (
            <div className="import-error" role="alert">
              <AlertCircle size={18} />
              <div>
                {error}
                {tab === "youtube" && (
                  <button
                    onClick={() => {
                      setTab("manual");
                      setError("");
                    }}
                  >
                    Create a course manually <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
        <aside>
          <div className="import-guide">
            <span className="eyebrow">A CALMER WAY TO LEARN</span>
            <h2>
              Everything you need.
              <br />
              Nothing in your way.
            </h2>
            {[
              {
                icon: ListVideo,
                title: "A path, not a pile of links",
                text: "Your lessons, organized in the original playlist order.",
              },
              {
                icon: CheckCircle2,
                title: "Progress that stays with you",
                text: "Know what’s done and exactly where to pick up.",
              },
              {
                icon: BookOpen,
                title: "Make the knowledge yours",
                text: "Keep notes, timestamps, and practice with every lesson.",
              },
            ].map((item) => (
              <div key={item.title}>
                <span>
                  <item.icon size={19} />
                </span>
                <section>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </section>
              </div>
            ))}
            <SceneArtwork
              kind="books"
              className="import-guide-art"
              label="A small library of possibilities"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
