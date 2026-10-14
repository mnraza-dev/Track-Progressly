"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  Globe,
  Save,
  Cloud,
  CheckCircle2,
  Monitor,
  Moon,
  Sun,
  ArrowUpRight,
  LogOut,
  Play,
  Download,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { isConnected } from "@/lib/supabase/client";
import { signOut } from "@/features/auth/sign-out";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/utils";
export function Settings() {
  const router = useRouter();
  const { data, mutate, notify } = useWorkspace();
  const [name, setName] = useState(data.profile.display_name);
  const [timezone, setTimezone] = useState(data.profile.timezone);
  const [minutes, setMinutes] = useState(data.profile.daily_minutes);
  const [auto, setAuto] = useState(data.profile.auto_complete);
  const [busy, setBusy] = useState(false);
  function theme(value: string) {
    const chosen =
      value === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : value;
    document.documentElement.setAttribute("data-theme", chosen);
    localStorage.setItem("learntrack-theme", chosen);
    notify("Your workspace appearance is updated.");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A WORKSPACE THAT FEELS LIKE YOU</span>
          <h1>Make yourself at home.</h1>
          <p>Your profile, your preferences, your pace.</p>
        </div>
      </div>
      <div className="settings-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void mutate({
              op: "profile",
              display_name: name,
              timezone,
              daily_minutes: minutes,
              auto_complete: auto,
            })
              .then(() => notify("Your preferences are saved."))
              .finally(() => setBusy(false));
          }}
        >
          <section className="panel settings-panel">
            <div className="settings-section-heading">
              <span className="goal-icon">
                <User size={20} />
              </span>
              <div>
                <h2>The person behind the progress</h2>
                <p>A little introduction for your workspace.</p>
              </div>
            </div>
            <div className="settings-profile-avatar">
              {(name || "L").slice(0, 1).toUpperCase()}
            </div>
            <div className="form-stack">
              <label>
                Display name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={100}
                />
              </label>
              <label>
                <span className="label-with-icon">
                  <Globe size={14} />
                  Your timezone
                </span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {Array.from(
                    new Set([
                      timezone,
                      "UTC",
                      "Asia/Kolkata",
                      "America/New_York",
                      "America/Chicago",
                      "America/Los_Angeles",
                      "Europe/London",
                      "Europe/Paris",
                      "Asia/Tokyo",
                      "Asia/Singapore",
                      "Australia/Sydney",
                      ...Intl.supportedValuesOf("timeZone"),
                    ]),
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <small>Streaks and daily activity follow your timezone.</small>
              </label>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-heading">
              <span className="goal-icon">
                <Play size={20} />
              </span>
              <div>
                <h2>Learn your way</h2>
                <p>Make the app work with your learning habits.</p>
              </div>
            </div>
            <label className="setting-number">
              Daily learning intention{" "}
              <span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  required
                />{" "}
                minutes
              </span>
            </label>
            <div className="toggle-setting">
              <div>
                <strong>Automatic lesson completion</strong>
                <p>
                  Mark a lesson complete when playback reaches 90%.
                  <br />
                  Practice is always tracked separately.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={auto}
                aria-label="Automatic lesson completion"
                className={`toggle-switch ${auto ? "on" : ""}`}
                onClick={() => setAuto(!auto)}
              >
                <span />
              </button>
            </div>
          </section>
          <Button type="submit" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving..." : "Save my preferences"}
          </Button>
        </form>
        <aside>
          <section className="panel settings-panel">
            <div className="settings-section-heading">
              <span className="goal-icon">
                <Cloud size={20} />
              </span>
              <div>
                <h2>Your workspace</h2>
                <p>
                  {isConnected
                    ? "Securely connected"
                    : "Local, and ready to explore"}
                </p>
              </div>
            </div>
            <div
              className={`connection-status ${isConnected ? "connected" : ""}`}
            >
              {isConnected ? <CheckCircle2 size={17} /> : <Monitor size={17} />}{" "}
              {isConnected ? "Supabase connected" : "Saved in this browser"}
            </div>
            <p className="settings-help">
              {isConnected
                ? "Your courses, progress, and notes are private and securely saved to your account."
                : "Your changes persist on this device. To enable private accounts and cloud sync, add your Supabase project credentials and run the SQL migration in the setup guide."}
            </p>
            {!isConnected && (
              <div className="setup-file-list">
                <code>.env.example</code>
                <code>supabase/migrations/001_learntrack.sql</code>
                <code>README.md</code>
              </div>
            )}
            {isConnected ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                  router.refresh();
                }}
              >
                <LogOut size={16} />
                Sign out
              </Button>
            ) : (
              <Button variant="secondary" asChild>
                <Link href="/signup">
                  Account setup
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
            )}
          </section>
          <section className="panel settings-panel">
            <h2>Set the mood</h2>
            <p className="muted">A little light, or a little focus.</p>
            <div className="theme-options">
              {[
                { key: "light", icon: Sun, label: "Light" },
                { key: "dark", icon: Moon, label: "Dark" },
                { key: "system", icon: Monitor, label: "System" },
              ].map((t) => (
                <button key={t.key} onClick={() => theme(t.key)}>
                  <t.icon size={21} />
                  {t.label}
                </button>
              ))}
            </div>
          </section>
          <section className="panel settings-panel">
            <h2>Your knowledge, yours to keep.</h2>
            <p className="settings-help">
              Export your notes as Markdown, ready to take anywhere.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                downloadText(
                  `# My LearnTrack notes\n\n${data.courses.flatMap((c) => c.videos.flatMap((v) => v.notes.map((n) => `## ${c.title} / ${v.title}\n\n${n.content}`))).join("\n\n")}`,
                  "learntrack-notes.md",
                );
                notify("Notes exported.");
              }}
            >
              <Download size={15} />
              Export all notes
            </Button>
            <span className="secure-hint">
              <Shield size={13} />
              No paid tools. No AI required.
            </span>
          </section>
        </aside>
      </div>
    </>
  );
}
