import type { LessonQuiz, QuizAttempt } from "@/lib/quiz";
import type { RewardLedger } from "@/lib/rewards";
export type LessonStatus =
  "not_started" | "in_progress" | "completed" | "needs_revision";
export type Note = {
  id: string;
  content: string;
  timestamp_seconds: number;
  is_revision_required: boolean;
  updated_at: string;
};
export type PracticeTask = {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
};
export type Bookmark = { id: string; timestamp_seconds: number; label: string };
export type Lesson = {
  id: string;
  youtube_video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  duration_seconds: number;
  position: number;
  availability_status: "available" | "unavailable";
  progress: {
    status: LessonStatus;
    last_position_seconds: number;
    watched_seconds: number;
    is_completed: boolean;
    last_watched_at: string | null;
    completed_at: string | null;
  };
  quiz?: LessonQuiz;
  quiz_attempts?: QuizAttempt[];
  notes: Note[];
  tasks: PracticeTask[];
  bookmarks: Bookmark[];
};
export type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  channel_name: string;
  thumbnail_url: string;
  youtube_playlist_id: string | null;
  status: "not_started" | "in_progress" | "completed" | "paused" | "archived";
  is_favorite: boolean;
  target_completion_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  videos: Lesson[];
};
export type Goal = {
  id: string;
  goal_type: "daily_minutes" | "daily_videos" | "weekly_minutes";
  target_value: number;
  start_date: string;
  end_date: string | null;
};
export type Activity = {
  day: string;
  active_seconds: number;
  videos_completed: number;
  practice_completed: number;
  courses_completed: number;
};
export type Profile = {
  display_name: string;
  timezone: string;
  daily_minutes: number;
  auto_complete: boolean;
  weekend_rest?: boolean;
};
export type Workspace = {
  rewards?: RewardLedger;
  courses: Course[];
  goals: Goal[];
  activity: Activity[];
  profile: Profile;
};
export type ImportPreview = {
  title: string;
  description: string;
  channel_name: string;
  thumbnail_url: string;
  youtube_playlist_id: string | null;
  videos: Pick<
    Lesson,
    | "youtube_video_id"
    | "title"
    | "description"
    | "thumbnail_url"
    | "duration_seconds"
    | "position"
    | "availability_status"
  >[];
};
export const emptyProgress: Lesson["progress"] = {
  status: "in_progress",
  last_position_seconds: 0,
  watched_seconds: 0,
  is_completed: false,
  last_watched_at: null,
  completed_at: null,
};
export const emptyWorkspace: Workspace = {
  courses: [],
  goals: [],
  activity: [],
  profile: {
    display_name: "",
    timezone: "Asia/Kolkata",
    daily_minutes: 30,
    auto_complete: false,
  },
};
