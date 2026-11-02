"use client";
import { importTelegramChannel } from "@/lib/telegram/client";
import { parseTelegram } from "@/lib/telegram/parse";
import { lessonKey } from "@/lib/media";
import { TelegramAuthModal } from "@/components/telegram/telegram-auth-modal";
import { TelegramChannelPicker } from "@/components/telegram/telegram-channel-picker";
import {
  getTelegramAuthStatus,
  type TelegramUserInfo,
} from "@/lib/telegram/mtproto";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SceneArtwork } from "@/components/three/scene-provider";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  SquarePlay as Youtube,
  Send,
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
  const [tgUser, setTgUser] = useState<TelegramUserInfo | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    getTelegramAuthStatus().then((user) => {
      if (user) setTgUser(user);
    });
  }, []);
  const [telegramInput, setTelegramInput] = useState(
    "https://t.me/telusko_courses",
  );
  const [scan, setScan] = useState({ videos: 0, pages: 0, message: "" });
  const importController = useRef<AbortController | null>(null);
  useEffect(() => () => importController.current?.abort(), []);
  async function getTelegramPreview() {
    setError("");
    try {
      parseTelegram(telegramInput);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const controller = new AbortController();
    importController.current = controller;
    setBusy(true);
    setScan({ videos: 0, pages: 0, message: "" });
    try {
      const result = await importTelegramChannel(telegramInput, {
        signal: controller.signal,
        onProgress: (videos, pages, message = "") =>
          setScan({ videos, pages, message }),
      });
      setPreview(result);
      setTitle(result.title);
      setDescription(result.description);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not import this channel.",
        );
    } finally {
      if (importController.current === controller) {
        importController.current = null;
        setBusy(false);
      }
    }
  }
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
          videos: source.videos.map((v) => ({
            ...v,
            duration_seconds: Math.max(
              0,
              Math.min(Math.round(Number(v.duration_seconds) || 0), 604800),
            ),
          })),
        },
      });
      const added = useWorkspace
        .getState()
        .data.courses.find((c) => !existing.has(c.id));
      // Cache Components preserves this page when navigating to the course.
      // Clear a completed import so Add course starts a new transaction.
      form.reset({ input: "" });
      setTab("youtube");
      setPreview(null);
      setTitle("");
      setCategory(params.get("category") || "Development");
      setDescription("");
      setDeadline("");
      setLinks([{ url: "", title: "" }]);
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
            Turn a YouTube playlist or Telegram channel into your learning path.
          </p>
        </div>
      </div>
      <div className="import-layout">
        <section className="panel import-panel">
          <div className="tabs">
            <button
              disabled={busy}
              className={tab === "youtube" ? "selected" : ""}
              onClick={() => {
                setTab("youtube");
                setPreview(null);
                setError("");
              }}
            >
              <Youtube size={17} />
              Import from YouTube
            </button>
            <button
              disabled={busy}
              className={tab === "telegram" ? "selected" : ""}
              onClick={() => {
                setTab("telegram");
                setPreview(null);
                setError("");
              }}
            >
              <Send size={17} /> Import from Telegram
            </button>
            <button
              disabled={busy}
              className={tab === "manual" ? "selected" : ""}
              onClick={() => {
                setTab("manual");
                setPreview(null);
                setError("");
              }}
            >
              <BookOpen size={17} />
              Create manually
            </button>
          </div>
          {tab === "telegram" && !preview ? (
            <div className="space-y-6">
              {tgUser ? (
                <TelegramChannelPicker
                  user={tgUser}
                  onSelectCourse={(imported) => {
                    setPreview(imported);
                    setTitle(imported.title);
                    setDescription(imported.description);
                  }}
                  onDisconnected={() => setTgUser(null)}
                />
              ) : (
                <div className="rounded-xl border bg-muted/20 p-5 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Send size={22} />
                  </div>
                  <h3 className="text-base font-semibold">Connect as Telegram User</h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    Log in with your phone number to access private channels, study groups, and select courses directly from your chat list.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <Send size={15} />
                    Connect Telegram Account
                  </Button>
                </div>
              )}

              <TelegramAuthModal
                open={authModalOpen}
                onOpenChange={setAuthModalOpen}
                onAuthenticated={(u) => setTgUser(u)}
              />

              <div className="relative my-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <span className="relative bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Or import public channel link
                </span>
              </div>

              <form
                className="form-stack"
                aria-busy={busy}
                onSubmit={(e) => {
                  e.preventDefault();
                  void getTelegramPreview();
                }}
              >
                <h2>Your channel. One learning path.</h2>
                <p className="muted">
                  We’ll discover video posts through the channel’s public web
                  history, oldest first. Videos stay on Telegram.
                </p>
                <label>
                  Telegram channel link or username
                  <Input
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    disabled={busy}
                    placeholder="https://t.me/telusko_courses"
                    maxLength={500}
                    required
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <ListVideo size={17} />
                  )}
                  {busy ? "Finding channel videos…" : "Preview channel"}
                </Button>
                {busy && (
                  <>
                    <p role="status">
                      {scan.message || (
                        <>
                          {scan.videos} video posts found · {scan.pages} history
                          pages checked. Large channels can take several minutes.
                        </>
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => importController.current?.abort()}
                    >
                      Cancel import
                    </Button>
                  </>
                )}
                <span className="secure-hint">
                  <ShieldCheck size={14} />
                  Public channels only. No downloads or video hosting.
                </span>
                <p className="muted">
                  Some attachments only play inside Telegram. Embedded lessons use
                  manual completion; automatic playback tracking isn’t available.
                </p>
              </form>
            </div>
          ) : tab === "youtube" && !preview ? (
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
              {preview && tab !== "manual" && (
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
              {preview && tab !== "manual" && (
                <div className="preview-lessons">
                  {preview.videos.slice(0, 8).map((v, i) => (
                    <div key={lessonKey(v)}>
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
                      And {preview.videos.length - 8} more lessons, in source
                      order.
                    </p>
                  )}
                </div>
              )}
              <div className="form-actions">
                {preview && tab !== "manual" && (
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
                {tab === "telegram" && (
                  <p className="mt-1 text-xs opacity-80">
                    If Telegram is blocked on your network or ISP, try enabling a
                    VPN or setting your DNS to 1.1.1.1.
                  </p>
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
