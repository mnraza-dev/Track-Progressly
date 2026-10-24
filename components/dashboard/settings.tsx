"use client";
import { ExportDialog } from "@/components/exports/export-dialog";
import { WorkspaceDialog } from "@/components/ui/workspace-dialog";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import type { Workspace } from "@/types";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
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
  Upload,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { isConnected } from "@/lib/supabase/client";
import { signOut } from "@/features/auth/sign-out";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { fireConfetti } from "@/lib/confetti";

export function Settings() {
  const router = useRouter();
  const { data, mutate, notify, restore } = useWorkspace();
  const [pendingRestore, setPendingRestore] = useState<Workspace | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [name, setName] = useState(data.profile.display_name);
  const [timezone, setTimezone] = useState(data.profile.timezone);
  const [minutes, setMinutes] = useState(data.profile.daily_minutes);
  const [auto, setAuto] = useState(data.profile.auto_complete);
  const [weekendRest, setWeekendRest] = useState(
    data.profile.weekend_rest ?? false,
  );
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
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
              weekend_rest: weekendRest,
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
                <Input
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
                <Input
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
              <Switch
                checked={auto}
                aria-label="Automatic lesson completion"
                onCheckedChange={setAuto}
              />
            </div>
            <div className="toggle-setting">
              <div>
                <strong>Weekend Rest (Mon–Fri momentum)</strong>
                <p>
                  Preserve your study streak over Saturdays and Sundays without
                  breaking momentum.
                </p>
              </div>
              <Switch
                checked={weekendRest}
                aria-label="Weekend rest"
                onCheckedChange={setWeekendRest}
              />
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
              {isConnected ? "Saved to your account" : "Saved in this browser"}
            </div>
            <p className="settings-help">
              {isConnected
                ? "Your courses, progress, and notes are private and saved to your account."
                : "Your courses, notes, and goals are saved in this browser. Return on this device to pick up where you left off. Use export options below to keep a backup."}
            </p>
            {isConnected ? (
              <Button
                variant="outline"
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
              <Button variant="outline" asChild>
                <Link href="/signup">
                  Account setup
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
            )}
          </section>
          <Card className="settings-panel">
            <h2>Appearance</h2>
            <p className="muted">Choose a theme, or follow your device.</p>
            <Tabs value={theme || "system"} onValueChange={setTheme}>
              <TabsList className="theme-options" aria-label="Color theme">
                {[
                  { key: "light", icon: Sun, label: "Light" },
                  { key: "dark", icon: Moon, label: "Dark" },
                  { key: "system", icon: Monitor, label: "System" },
                ].map((t) => (
                  <TabsTrigger key={t.key} value={t.key}>
                    <t.icon size={21} />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Card>
          <section className="panel settings-panel">
            <span className="eyebrow">TAKE YOUR PROGRESS WITH YOU</span>
            <h2>Your knowledge, yours to keep.</h2>
            <p className="settings-help">
              Export Markdown notes, lesson progress and activity CSVs, a
              complete JSON backup, or a report to print and save as PDF.
            </p>
            <ExportDialog />
          </section>
          <section className="panel settings-panel">
            <h2>Workspace Backup & Restore</h2>
            <p className="settings-help">
              Download a complete JSON snapshot of all your courses, lessons,
              notes, and activity, or restore from a previous backup file.
            </p>
            {isConnected && (
              <p className="settings-help">
                Restore is available in browser workspaces. Account backups can
                be exported; restoring account data is not supported yet.
              </p>
            )}
            {restoreError && (
              <p role="alert" className="export-error">
                {restoreError}
              </p>
            )}
            <div className="backup-actions-row">
              <Button
                variant="outline"
                disabled={isConnected}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} />
                Restore from file
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 25_000_000)
                      throw new Error("Choose a backup smaller than 25 MB.");
                    const workspace = parseWorkspaceBackup(await file.text());
                    setRestoreError("");
                    setPendingRestore(workspace);
                  } catch (err: unknown) {
                    setRestoreError(
                      err instanceof Error
                        ? err.message
                        : "Could not read this backup.",
                    );
                  } finally {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
            </div>
          </section>
        </aside>
      </div>
      <WorkspaceDialog
        open={!!pendingRestore}
        onOpenChange={(open) => {
          if (!open && !restoreBusy) setPendingRestore(null);
        }}
        title="Restore this workspace?"
        description="Restoring replaces the data saved in this browser. Export your current workspace first if you want to keep it."
      >
        <p>
          {pendingRestore?.courses.length ?? 0} courses ·{" "}
          {pendingRestore?.goals.length ?? 0} goals ·{" "}
          {pendingRestore?.activity.length ?? 0} days of activity
        </p>
        {restoreError && (
          <p role="alert" className="export-error">
            {restoreError}
          </p>
        )}
        <div className="backup-actions-row">
          <Button
            variant="outline"
            disabled={restoreBusy}
            onClick={() => setPendingRestore(null)}
          >
            Cancel
          </Button>
          <Button
            disabled={restoreBusy}
            onClick={async () => {
              if (!pendingRestore) return;
              setRestoreBusy(true);
              try {
                await restore(pendingRestore);
                setName(pendingRestore.profile.display_name);
                setTimezone(pendingRestore.profile.timezone);
                setMinutes(pendingRestore.profile.daily_minutes);
                setAuto(pendingRestore.profile.auto_complete);
                setWeekendRest(pendingRestore.profile.weekend_rest ?? false);
                setPendingRestore(null);
                fireConfetti();
                notify("Workspace restored and saved in this browser.");
              } catch (err) {
                setRestoreError(
                  err instanceof Error
                    ? err.message
                    : "Could not restore workspace.",
                );
              } finally {
                setRestoreBusy(false);
              }
            }}
          >
            {restoreBusy ? "Restoring..." : "Replace and restore"}
          </Button>
        </div>
      </WorkspaceDialog>
    </>
  );
}
