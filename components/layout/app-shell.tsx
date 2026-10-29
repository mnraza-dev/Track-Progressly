"use client";

import { subscribeWorkspaceStorage } from "@/lib/workspace-storage";
import { ExportDialog } from "@/components/exports/export-dialog";
import { RewardFeedback } from "@/components/gamification/reward-feedback";
import { AppLoader } from "@/components/ui/app-loader";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  BookOpen,
  StickyNote,
  Target,
  Settings,
  Plus,
  Search,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  SunMoon,
  LogOut,
  Command,
  CheckCircle2,
  Bell,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
  Keyboard,
} from "lucide-react";
import {
  useWorkspace,
  currentWorkspaceCacheKey,
  resetWorkspaceSession,
} from "@/stores/workspace";
import { useAuth, useUser } from "@clerk/nextjs";
import { profileName } from "@/lib/profile-name";
import { emptyWorkspace } from "@/types";
import { isConnected } from "@/lib/supabase/client";
import { useWorkspaceSignOut } from "@/features/auth/sign-out";
import { WorkspaceDialog as Dialog } from "@/components/ui/workspace-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/tour/tour-context";
import { useGamification } from "@/components/gamification/use-gamification";
import { AchievementsDialog } from "@/components/gamification/achievements-dialog";
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog";
import { WorkspaceSyncReminder } from "@/components/layout/workspace-sync-reminder";
const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My courses", href: "/courses", icon: BookOpen },
  { label: "My notes", href: "/notes", icon: StickyNote },
  { label: "Learning goals", href: "/goals", icon: Target },
];
export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      Progressly<span className="brand-dot">.</span>
    </span>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, signingOut, isSignedIn } = useWorkspaceSignOut();
  const { isLoaded: authLoaded, userId } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const defaultName = profileName(user);
  const {
    data: storedData,
    accountId,
    load,
    sync,
    refreshCache,
    toast,
    loaded,
    error,
    syncError,
    dirty,
    syncing,
    syncConflict,
  } = useWorkspace();
  const accountReady = !isConnected || accountId === userId;
  const data = accountReady ? storedData : emptyWorkspace;
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const { resolvedTheme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { startTour } = useTour();
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const stats = useGamification(data);

  useEffect(() => {
    if (isConnected && (!authLoaded || !userLoaded)) return;
    if (isConnected && !userId) {
      resetWorkspaceSession();
      return;
    }
    void load(userId || undefined, defaultName);
  }, [load, userId, authLoaded, userLoaded, defaultName]);

  useEffect(() => {
    if (!isConnected || !authLoaded || !userId) return;
    const tick = () => {
      if (!document.hidden) void sync(false);
    };
    const unsubscribe = subscribeWorkspaceStorage((key) => {
      if (key === currentWorkspaceCacheKey()) void refreshCache();
    });
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
      unsubscribe();
    };
  }, [authLoaded, userId, sync, refreshCache]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isEditing = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (e.target as HTMLElement)?.tagName || "",
      );
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      } else if (
        !isEditing &&
        (e.key === "?" || (e.shiftKey && e.key === "/"))
      ) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (!isEditing && e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDesktopCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const title =
    navigation.find((n) => pathname.startsWith(n.href))?.label ||
    (pathname === "/"
      ? "Dashboard"
      : pathname.startsWith("/settings")
        ? "Settings"
        : "Workspace");
  const name = data.profile.display_name || "Your workspace";
  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }
  async function syncBeforeClosing() {
    await sync();
    const current = useWorkspace.getState();
    if (
      current.accountId === userId &&
      !current.dirty &&
      !current.syncing &&
      !current.syncError
    )
      current.notify("Cloud sync complete. You can close this tab.");
  }
  return (
    <div className={cn("app-shell", desktopCollapsed && "sidebar-collapsed")}>
      <aside className={cn("sidebar", mobile && "sidebar-open")}>
        <div className="sidebar-brand">
          <Link href="/dashboard" aria-label="Progressly dashboard">
            <Logo />
          </Link>
          <div className="sidebar-brand-actions">
            <button
              className="icon-button desktop-collapse"
              onClick={() => setDesktopCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
            <button
              className="icon-button mobile-close"
              onClick={() => setMobile(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <button
          className="workspace-selector"
          onClick={() => router.push("/settings")}
        >
          <span className="workspace-avatar">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{name}</strong>
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">YOUR LEARNING STUDIO</div>
        <nav data-tour="sidebar-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobile(false)}
              className={cn(
                "nav-item",
                ((pathname === "/" && item.href === "/dashboard") ||
                  pathname.startsWith(item.href)) &&
                  "active",
              )}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.href === "/courses" && data.courses.length > 0 && (
                <span className="nav-count">{data.courses.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href="/settings"
            className={cn("nav-item", pathname === "/settings" && "active")}
          >
            <Settings size={19} strokeWidth={1.7} />
            Settings
          </Link>
          <div className="sidebar-footer">
            <span className="free-plan">
              <span />
              {isConnected ? "Local · daily cloud sync" : "Browser workspace"}
            </span>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              <SunMoon size={17} />
            </button>
            {isSignedIn && (
              <button
                className="icon-button"
                title="Sign out"
                aria-label="Sign out"
                disabled={signingOut}
                onClick={() => void signOut()}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button sidebar-toggle-btn"
              aria-label={
                desktopCollapsed ? "Open sidebar" : "Toggle sidebar menu"
              }
              title={desktopCollapsed ? "Open sidebar" : "Collapse sidebar"}
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth <= 760) {
                  setMobile(true);
                } else {
                  setDesktopCollapsed((prev) => !prev);
                }
              }}
            >
              {desktopCollapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <>
                  <PanelLeftClose size={18} className="desktop-toggle-icon" />
                  <Menu size={20} className="mobile-toggle-icon" />
                </>
              )}
            </button>
            <span className="breadcrumb-home">My workspace</span>
            <span className="breadcrumb-divider">/</span>
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <ExportDialog compact />
            <button
              className="global-search"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Find a course or note</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="level-badge-button"
              onClick={() => setAchievementsOpen(true)}
              aria-label={`Level ${stats.levelInfo.level}: ${stats.levelInfo.title}, ${stats.levelInfo.totalXP} XP`}
              title={`Level ${stats.levelInfo.level}: ${stats.levelInfo.title} (${stats.levelInfo.totalXP} XP)`}
            >
              <span className="level-badge-trophy">
                <Trophy size={13} />
              </span>
              <span className="level-badge-pill">
                Lv. {stats.levelInfo.level}
              </span>
              <span className="level-badge-xp">
                {stats.levelInfo.totalXP} XP
              </span>
            </button>
            <button
              className="tour-topbar-button"
              onClick={startTour}
              aria-label="Take interactive product tour"
              title="Explore Progressly with an interactive tour"
            >
              <Sparkles size={14} className="tour-sparkle-icon" />
              <span>Tour</span>
            </button>
            <Separator orientation="vertical" className="topbar-separator" />
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
            </button>
            <Link
              href="/settings"
              className="profile-avatar"
              aria-label="Profile settings"
            >
              {(data.profile.display_name || "L").slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="page-content">
          {error ? (
            <div className="error-card">
              <h2>Your workspace couldn’t load</h2>
              <p>{error}</p>
              <Button disabled={signingOut} onClick={() => void load()}>
                Try again
              </Button>
              {isSignedIn && (
                <Button
                  variant="outline"
                  disabled={signingOut}
                  onClick={() => void signOut()}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              )}
            </div>
          ) : !loaded || !accountReady ? (
            <AppLoader message="Opening your learning studio..." />
          ) : (
            <>
              {isConnected && !!userId && (
                <WorkspaceSyncReminder
                  dirty={dirty}
                  syncing={syncing}
                  syncError={syncError}
                  syncConflict={syncConflict}
                  onSync={syncBeforeClosing}
                  onOpenSettings={() => router.push("/settings")}
                  shouldWarnOnClose={() => {
                    const current = useWorkspace.getState();
                    return (
                      current.accountId === userId &&
                      (current.dirty || current.syncing)
                    );
                  }}
                />
              )}
              {children}
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>PROGRESSLY / YOUR LEARNING STUDIO</span>
          <div className="footer-links-group">
            <button
              type="button"
              className="shortcuts-footer-btn"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Open keyboard shortcuts cheat sheet (?)"
            >
              <Keyboard size={13} />
              <span>Shortcuts</span>
              <kbd>?</kbd>
            </button>
            <span>
              Keep making. <Sparkles size={13} />
            </span>
          </div>
        </footer>
      </div>
      <RewardFeedback onViewCollection={() => setAchievementsOpen(true)} />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => useWorkspace.setState({ toast: null })}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Dialog
        open={search}
        onOpenChange={setSearch}
        title="Find your next step"
        description="Search your courses, lessons, and notes."
      >
        <div className="search-input">
          <Search size={19} />
          <Input
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your workspace..."
          />
        </div>
        <div className="search-results">
          {data.courses
            .filter((c) =>
              `${c.title} ${c.category} ${c.videos.map((v) => `${v.title} ${v.notes.map((n) => n.content).join(" ")}`).join(" ")}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                onClick={() => setSearch(false)}
              >
                <BookOpen size={19} />
                <div>
                  <strong>{c.title}</strong>
                  <small>
                    {c.category} · {c.videos.length} lessons
                  </small>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          {data.courses.length === 0 && (
            <div className="small-empty">
              <Command size={25} />
              <p>Your courses and notes will appear here.</p>
              <Button
                onClick={() => {
                  setSearch(false);
                  router.push("/courses/new");
                }}
              >
                <Plus size={16} />
                Add your first course
              </Button>
            </div>
          )}
        </div>
      </Dialog>
      <Dialog
        open={notifications}
        onOpenChange={setNotifications}
        title="You’re all caught up"
        description="A little focus goes a long way."
      >
        <div className="small-empty">
          <Bell size={30} />
          <p>No new notifications. Your next lesson is waiting.</p>
          <Button
            onClick={() => {
              setNotifications(false);
              router.push("/courses");
            }}
          >
            Explore courses <ArrowRight size={16} />
          </Button>
        </div>
      </Dialog>
      <AchievementsDialog
        open={achievementsOpen}
        onOpenChange={setAchievementsOpen}
        stats={stats}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
