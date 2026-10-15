"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { isConnected } from "@/lib/supabase/client";
import { signOut } from "@/features/auth/sign-out";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      learntrack<span className="brand-dot">.</span>
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
  const [dark, setDark] = useState(false);
  const [notifications, setNotifications] = useState(false);
  useEffect(() => {
    void load();
    const theme = localStorage.getItem("learntrack-theme") === "dark";
    document.documentElement.dataset.theme = theme ? "dark" : "light";
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
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
    const value = document.documentElement.dataset.theme !== "dark";
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
    localStorage.setItem("learntrack-theme", value ? "dark" : "light");
  }
  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobile && "sidebar-open")}>
        <div className="sidebar-brand">
          <Link href="/dashboard" aria-label="LearnTrack dashboard">
            <Logo />
          </Link>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
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
        <nav>
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
              Free plan
            </span>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
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
              className="icon-button mobile-toggle"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">My workspace</span>
            <span className="breadcrumb-divider">/</span>
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <button className="global-search" onClick={() => setSearch(true)}>
              <Search size={16} />
              <span>Find a course or note</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="topbar-separator" />
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
          <span>LEARNTRACK / YOUR LEARNING STUDIO</span>
          <span>
            Keep making. <Sparkles size={13} />
          </span>
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
          <input
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
    </div>
  );
}
