import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <Suspense fallback={<div className="flex h-32 items-center justify-center"><span className="text-muted-foreground">Loading…</span></div>}>
        <SignUp
          path="/signup"
          routing="path"
          signInUrl="/login"
          fallbackRedirectUrl="/dashboard"
        />
      </Suspense>
    </div>
  );
}