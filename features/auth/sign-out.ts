"use client";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { useWorkspace } from "@/stores/workspace";
import { emptyWorkspace } from "@/types";
export async function signOut(
  clerkSignOut: ReturnType<typeof useClerk>["signOut"],
) {
  await clerkSignOut(() => {
    useWorkspace.setState({
      data: structuredClone(emptyWorkspace),
      loaded: false,
      error: null,
      toast: null,
      celebration: null,
    });
    // Leave the protected router tree after Clerk clears the session.
    window.location.replace("/login");
  });
}

export function useWorkspaceSignOut() {
  const { signOut: clerkSignOut } = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (!isLoaded || signingOut) return;
    setSigningOut(true);
    try {
      await signOut(clerkSignOut);
    } catch (error) {
      useWorkspace
        .getState()
        .notify(
          error instanceof Error
            ? error.message
            : "Could not sign out. Please try again.",
        );
    } finally {
      setSigningOut(false);
    }
  }

  return { signOut: handleSignOut, signingOut, isSignedIn, isLoaded };
}
