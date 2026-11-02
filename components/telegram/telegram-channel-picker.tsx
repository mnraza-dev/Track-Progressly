"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Users,
  Megaphone,
  LoaderCircle,
  Video,
  LogOut,
  RefreshCw,
  FolderDown,
  AlertCircle,
} from "lucide-react";
import {
  getTelegramDialogs,
  importDialogAsCourse,
  clearStoredTelegramSession,
  type TelegramDialogItem,
  type TelegramUserInfo,
} from "@/lib/telegram/mtproto";
import type { ImportPreview } from "@/types";

interface TelegramChannelPickerProps {
  user: TelegramUserInfo;
  onSelectCourse: (preview: ImportPreview) => void;
  onDisconnected: () => void;
}

export function TelegramChannelPicker({
  user,
  onSelectCourse,
  onDisconnected,
}: TelegramChannelPickerProps) {
  const [dialogs, setDialogs] = useState<TelegramDialogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState({ found: 0, scanned: 0 });

  async function loadDialogs() {
    setLoading(true);
    setError("");
    try {
      const items = await getTelegramDialogs();
      setDialogs(items);
    } catch (err: any) {
      setError(
        err?.errorMessage ||
          err?.message ||
          "Could not load your Telegram chats. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDialogs();
  }, []);

  async function handleImport(dialog: TelegramDialogItem) {
    setImportingId(dialog.id);
    setScanProgress({ found: 0, scanned: 0 });
    setError("");

    try {
      const targetIdentifier = dialog.username || dialog.id;
      const preview = await importDialogAsCourse(
        targetIdentifier,
        (found, scanned) => {
          setScanProgress({ found, scanned });
        },
      );
      onSelectCourse(preview);
    } catch (err: any) {
      setError(
        err?.errorMessage ||
          err?.message ||
          "Failed to scan lessons from this chat.",
      );
    } finally {
      setImportingId(null);
    }
  }

  function handleLogout() {
    clearStoredTelegramSession();
    onDisconnected();
  }

  const filtered = dialogs.filter((d) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.username && d.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {user.firstName[0]}
          </div>
          <div>
            <p className="text-xs font-medium">
              Connected as {user.firstName}{" "}
              {user.username && (
                <span className="text-muted-foreground">(@{user.username})</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Select any joined channel or group to import video lessons
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadDialogs()}
            disabled={loading || Boolean(importingId)}
            title="Refresh chat list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={Boolean(importingId)}
            title="Disconnect Telegram account"
          >
            <LogOut size={14} />
          </Button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative">
        <Search
          size={15}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search your channels and groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-sm"
          disabled={loading || Boolean(importingId)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <LoaderCircle size={18} className="mr-2 animate-spin" />
          Loading your Telegram groups & channels…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {search ? "No matching channels or groups found." : "No channels or groups found in your account."}
        </div>
      ) : (
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((dialog) => {
            const isSelected = importingId === dialog.id;
            return (
              <div
                key={dialog.id}
                className="flex items-center justify-between rounded-md border p-2.5 transition hover:bg-muted/50"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5">
                    {dialog.isChannel ? (
                      <Megaphone size={14} className="shrink-0 text-blue-500" />
                    ) : (
                      <Users size={14} className="shrink-0 text-purple-500" />
                    )}
                    <span className="truncate text-sm font-medium">
                      {dialog.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{dialog.isChannel ? "Channel" : "Group"}</span>
                    {dialog.username && <span>@{dialog.username}</span>}
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "secondary" : "outline"}
                  onClick={() => void handleImport(dialog)}
                  disabled={Boolean(importingId)}
                  className="shrink-0 gap-1.5"
                >
                  {isSelected ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      <span>
                        {scanProgress.found > 0
                          ? `${scanProgress.found} videos found…`
                          : "Scanning…"}
                      </span>
                    </>
                  ) : (
                    <>
                      <FolderDown size={14} />
                      Import
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

