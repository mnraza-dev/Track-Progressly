import { format, subDays } from "date-fns";
import {
  emptyWorkspace,
  emptyProgress,
  type Course,
  type Lesson,
} from "@/types";
import { localDay } from "@/lib/utils";

export function chartWorkspace() {
  const data = structuredClone(emptyWorkspace);
  data.profile.display_name = "Alex";
  const today = localDay(new Date(), data.profile.timezone);
  const minutes = [0, 12, 45, 5, 30, 0, 18];
  data.activity = minutes.map((value, i) => ({
    day: format(subDays(new Date(`${today}T12:00:00Z`), 6 - i), "yyyy-MM-dd"),
    active_seconds: value * 60,
    videos_completed: [0, 1, 2, 0, 1, 0, 1][i],
    practice_completed: i === 6 ? 1 : 0,
    courses_completed: 0,
  }));
  const lesson = (
    index: number,
    status: Lesson["progress"]["status"],
  ): Lesson => ({
    id: `lesson-${index}`,
    youtube_video_id: "j942wKiXFu8",
    title: `Lesson ${index}`,
    description: "",
    thumbnail_url: "",
    duration_seconds: 600,
    position: index,
    availability_status: "available",
    progress: {
      ...emptyProgress,
      status,
      is_completed: status === "completed",
    },
    notes: [],
    tasks: [],
    bookmarks: [],
  });
  const course = (
    id: string,
    title: string,
    category: string,
    states: Lesson["progress"]["status"][],
  ): Course => ({
    id,
    title,
    category,
    description: "",
    channel_name: "",
    thumbnail_url: "",
    youtube_playlist_id: null,
    status: "in_progress",
    is_favorite: false,
    target_completion_date: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    videos: states.map((state, index) => lesson(index, state)),
  });
  data.courses = [
    course("react", "React: from ideas to interfaces", "Development", [
      "completed",
      "completed",
      "in_progress",
      "needs_revision",
      "not_started",
      "not_started",
    ]),
    course("python", "Python for curious minds", "Data & Python", [
      "completed",
      "in_progress",
      "not_started",
      "not_started",
    ]),
  ];
  data.courses[0].videos.push({
    ...lesson(7, "completed"),
    availability_status: "unavailable",
  });
  data.courses.push({
    ...course("archive", "Archived course", "Design", ["completed"]),
    status: "archived",
  });
  data.goals = [
    {
      id: "daily",
      goal_type: "daily_minutes",
      target_value: 30,
      start_date: today,
      end_date: null,
    },
    {
      id: "weekly",
      goal_type: "weekly_minutes",
      target_value: 150,
      start_date: today,
      end_date: null,
    },
    {
      id: "lessons",
      goal_type: "daily_videos",
      target_value: 2,
      start_date: today,
      end_date: null,
    },
  ];
  return data;
}
