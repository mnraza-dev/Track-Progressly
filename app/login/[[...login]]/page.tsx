import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <Suspense fallback={<div className="flex h-32 items-center justify-center"><span className="text-muted-foreground">Loading…</span></div>}>
        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/signup"
          fallbackRedirectUrl="/dashboard"
        />
      </Suspense>
    </div>
  );
}