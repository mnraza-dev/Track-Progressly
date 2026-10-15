import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="large-empty">
      <span className="eyebrow">404 · A LITTLE OFF THE PATH</span>
      <h1>Let’s find your way back.</h1>
      <p>The page you’re looking for isn’t here.</p>
      <Button asChild>
        <Link href="/dashboard">Back to my workspace →</Link>
      </Button>
    </div>
  );
}
