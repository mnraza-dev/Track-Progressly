import { Library } from "@/components/courses/library";
// Workspace data is loaded in the browser; navigation waits for its private state.
export const instant = false;
export default function Page() {
  return <Library />;
}
