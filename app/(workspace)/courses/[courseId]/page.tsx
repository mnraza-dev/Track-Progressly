import { CourseWorkspace } from "@/components/courses/course-workspace";
// Workspace data is loaded in the browser; navigation waits for its private state.
export const instant = false;
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseWorkspace courseId={courseId} />;
}
