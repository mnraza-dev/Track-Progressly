"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ArrowRight,
  Star,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { completion } from "@/lib/utils";
import { CourseCard } from "./course-card";
import { SceneArtwork } from "@/components/three/scene-provider";
import { Button } from "@/components/ui/button";
export function Library({ resume = false }: { resume?: boolean }) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [list, setList] = useState(false);
  const courses = data.courses
    .filter(
      (c) =>
        (!resume || !["completed", "archived"].includes(c.status)) &&
        (status === "all"
          ? c.status !== "archived"
          : status === "favorites"
            ? c.is_favorite
            : status === "completed"
              ? completion(c) === 100
              : status === "in_progress"
                ? c.status === "in_progress"
                : c.status === status) &&
        (category === "all" || c.category === category) &&
        `${c.title} ${c.channel_name} ${c.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "progress"
        ? completion(b) - completion(a)
        : sort === "added"
          ? b.created_at.localeCompare(a.created_at)
          : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {resume ? "KEEP YOUR MOMENTUM" : "YOUR PERSONAL LEARNING LIBRARY"}
          </div>
          <h1>
            {resume ? "Continue learning" : "My courses"}
            <span className="heading-count">{courses.length}</span>
          </h1>
          <p>
            {resume
              ? "Your next lesson is waiting. Let’s make a little progress."
              : "Less collecting. More completing. All your courses, in one place."}
          </p>
        </div>
        <Button asChild>
          <Link href="/courses/new">
            <Plus size={17} />
            Add course
          </Link>
        </Button>
      </div>
      <div className="library-toolbar">
        <div className="search-input">
          <Search size={18} />
          <Input
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses..."
            aria-label="Search courses"
          />
        </div>
        <div className="filter-controls">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Filter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {Array.from(new Set(data.courses.map((c) => c.category))).map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
          <select
            aria-label="Sort courses"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently active</option>
            <option value="progress">Most progress</option>
            <option value="added">Recently added</option>
          </select>
          <button
            className="icon-button"
            aria-label={list ? "Grid view" : "List view"}
            onClick={() => setList(!list)}
          >
            {list ? <LayoutGrid size={18} /> : <List size={18} />}
          </button>
        </div>
      </div>
      <div className="tabs">
        {[
          "all",
          "in_progress",
          "not_started",
          "completed",
          "paused",
          "favorites",
          "archived",
        ].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={status === s ? "selected" : ""}
          >
            {s === "favorites" && <Star size={13} />}
            {s === "all"
              ? "All courses"
              : s.replaceAll("_", " ").replace(/^./, (v) => v.toUpperCase())}
          </button>
        ))}
      </div>
      {courses.length ? (
        <div
          className={
            list ? "course-grid course-list" : "course-grid library-grid"
          }
        >
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <div className="large-empty">
          <SceneArtwork
            kind="books"
            className="empty-scene"
            label="A stack of books ready for your next learning project"
          />
          <span className="eyebrow">MAKE SPACE FOR SOMETHING NEW</span>
          <h2>
            {data.courses.length
              ? "No courses found"
              : "A library full of possibilities."}
          </h2>
          <p>
            {data.courses.length
              ? "Try a different search or filter to find your course."
              : "Add a YouTube playlist, a single video, or build your own course. Your learning journey starts with one link."}
          </p>
          <Button asChild>
            <Link href="/courses/new">
              <Plus size={17} />
              Add your first course
              <ArrowRight size={16} />
            </Link>
          </Button>
          <small>Free forever. Made for your pace.</small>
        </div>
      )}
    </>
  );
}
