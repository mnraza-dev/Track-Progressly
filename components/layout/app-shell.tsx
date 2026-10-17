"use client";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  BookOpen,
  Play,
  StickyNote,
  ChartNoAxesCombined,
  Target,
  Settings,
  ArrowUpRight,
  Plus,
  Search,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Sun,
  Moon,
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
import { useWorkspace } from "@/stores/workspace";
import { isConnected } from "@/lib/supabase/client";
import { signOut } from "@/features/auth/sign-out";
import { WorkspaceDialog as Dialog } from "@/components/ui/workspace-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/tour/tour-context";
import { getGamificationStats } from "@/lib/gamification";
import { AchievementsDialog } from "@/components/gamification/achievements-dialog";
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog";
import { fireConfetti } from "@/lib/confetti";
const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My courses", href: "/courses", icon: BookOpen },
  { label: "Continue learning", href: "/continue", icon: Play },
  { label: "My notes", href: "/notes", icon: StickyNote },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
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
  const { data, load, toast, loaded, error } = useWorkspace();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const { resolvedTheme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { startTour } = useTour();
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const prevLevelRef = useRef<number | null>(null);
  const stats = useMemo(() => getGamificationStats(data), [data]);

  // Celebratory Toast & Confetti on Level Up
  useEffect(() => {
    if (
      loaded &&
      prevLevelRef.current !== null &&
      stats.levelInfo.level > prevLevelRef.current
    ) {
      fireConfetti();
      useWorkspace.setState({
        toast: `🎉 Level Up! You reached Level ${stats.levelInfo.level}: ${stats.levelInfo.title}!`,
      });
    }
    if (loaded) {
      prevLevelRef.current = stats.levelInfo.level;
    }
  }, [stats.levelInfo.level, stats.levelInfo.title, loaded]);

  useEffect(() => {
    void load();
    const handler = (e: KeyboardEvent) => {
      const isEditing = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (e.target as HTMLElement)?.tagName || "",
      );
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      } else if (!isEditing && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (!isEditing && e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDesktopCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [load]);
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
          <div className="sidebar-inspiration">
            <span className="inspiration-icon">
              <Sparkles size={19} />
            </span>
            <strong>
              A daily practice.
              <br />A different perspective.
            </strong>
            <p>Make time for one good lesson.</p>
            <Link href="/goals">
              Set a learning goal <ArrowUpRight size={15} />
            </Link>
          </div>
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
              {isConnected ? "Connected workspace" : "Browser workspace"}
            </span>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </button>
            {isConnected && (
              <button
                className="icon-button"
                title="Sign out"
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                  router.refresh();
                }}
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
              <span className="level-badge-pill">Lv. {stats.levelInfo.level}</span>
              <span className="level-badge-xp">{stats.levelInfo.totalXP} XP</span>
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
              <Button onClick={() => void load()}>Try again</Button>
            </div>
          ) : !loaded ? (
            <div className="page-skeleton">
              <div />
              <div />
              <section>
                <div />
                <div />
                <div />
                <div />
              </section>
              <div />
            </div>
          ) : (
            children
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
              router.push("/continue");
            }}
          >
            Continue learning <ArrowRight size={16} />
          </Button>
        </div>
      </Dialog>
      <AchievementsDialog
        open={achievementsOpen}
        onOpenChange={setAchievementsOpen}
        stats={stats}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  );
}
