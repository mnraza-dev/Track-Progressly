"use client";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  MoreHorizontal,
  Star,
  Check,
  Clock,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { completion, duration, cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import { SceneArtwork } from "@/components/three/scene-provider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Course } from "@/types";
export function CourseArtwork({
  category,
  title,
  thumbnail,
  className,
}: {
  category: string;
  title?: string;
  thumbnail?: string;
  className?: string;
}) {
  const slug = category.toLowerCase();
  return (
    <div
      className={cn(
        "course-artwork",
        slug.includes("design")
          ? "art-design"
          : slug.includes("data") || slug.includes("python")
            ? "art-data"
            : "art-code",
        className,
      )}
    >
      {thumbnail &&
      /^https:\/\/i(?:\.ytimg|mg\.youtube)\.com\//.test(thumbnail) ? (
        <Image
          unoptimized
          width={640}
          height={360}
          src={thumbnail}
          alt={title || category}
        />
      ) : (
        <>
          <SceneArtwork
            kind={
              slug.includes("design")
                ? "design"
                : slug.includes("data") || slug.includes("python")
                  ? "data"
                  : "code"
            }
            label={`A sculptural study in ${category.toLowerCase()}`}
          />
          <span className="art-topline">
            {category.toUpperCase()}
            <span>↗</span>
          </span>
          <span className="art-bottomline">KEEP MAKING.</span>
        </>
      )}
    </div>
  );
}
export function CourseCard({ course }: { course: Course }) {
  const percent = completion(course);
  const [menu, setMenu] = useState(false);
  const { mutate, notify } = useWorkspace();
  const completed = course.videos.filter(
    (v) => v.availability_status === "available" && v.progress.is_completed,
  ).length;
  const next =
    course.videos.find(
      (v) => v.availability_status === "available" && !v.progress.is_completed,
    ) || course.videos[0];
  return (
    <article className="course-card">
      <Link href={`/courses/${course.id}`}>
        <CourseArtwork
          category={course.category}
          title={course.title}
          thumbnail={course.thumbnail_url}
        />
        <Badge
          variant="outline"
          className={cn("course-status", percent === 100 && "complete")}
        >
          {percent === 100 ? <Check size={11} /> : <span />}
          {percent === 100
            ? "Completed"
            : course.status === "paused"
              ? "Paused"
              : percent > 0
                ? "In progress"
                : "Ready to start"}
        </Badge>
      </Link>
      <div className="course-card-body">
        <div className="course-meta">
          <span>{course.category}</span>
          <div className="course-menu">
            <button
              className="icon-button"
              onClick={() => setMenu(!menu)}
              aria-label={`Actions for ${course.title}`}
            >
              <MoreHorizontal size={19} />
            </button>
            {menu && (
              <div className="dropdown-menu">
                <button
                  onClick={() => {
                    void mutate({
                      op: "update_course",
                      id: course.id,
                      patch: { is_favorite: !course.is_favorite },
                    }).then(() =>
                      notify(
                        course.is_favorite
                          ? "Removed from favorites"
                          : "Added to favorites",
                      ),
                    );
                    setMenu(false);
                  }}
                >
                  <Star size={14} />
                  {course.is_favorite ? "Unfavorite" : "Favorite"}
                </button>
                <button
                  onClick={() => {
                    void mutate({
                      op: "update_course",
                      id: course.id,
                      patch: {
                        status:
                          course.status === "archived"
                            ? "in_progress"
                            : "archived",
                      },
                    });
                    setMenu(false);
                  }}
                >
                  <BookOpen size={14} />
                  {course.status === "archived"
                    ? "Restore course"
                    : "Archive course"}
                </button>
                <Link href={`/courses/${course.id}`}>
                  <ArrowRight size={14} />
                  Course details
                </Link>
              </div>
            )}
          </div>
        </div>
        <Link href={`/courses/${course.id}`} className="course-card-title">
          {course.title}
          {course.is_favorite && <Star size={14} className="favorite-icon" />}
        </Link>
        <p className="course-channel">
          {course.channel_name || "Your personal course"}
        </p>
        <div className="course-progress-label">
          <span>
            {completed} of{" "}
            {
              course.videos.filter((v) => v.availability_status === "available")
                .length
            }{" "}
            lessons
          </span>
          <strong>{percent}%</strong>
        </div>
        <Progress value={percent} />
        <div className="course-card-bottom">
          <span>
            <Clock size={13} />
            {course.videos.some((v) => v.duration_seconds > 0)
              ? duration(
                  course.videos.reduce((sum, v) => sum + v.duration_seconds, 0),
                )
              : "Duration unavailable"}
          </span>
          <Link href={`/courses/${course.id}/learn/${next?.id}`}>
            <Play size={13} fill="currentColor" />
            {percent === 100
              ? "Revisit course"
              : completed
                ? "Continue"
                : "Start learning"}
          </Link>
        </div>
      </div>
    </article>
  );
}
