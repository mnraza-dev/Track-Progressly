"use client";
import { browserSupabase } from "@/lib/supabase/client";
import { useWorkspace } from "@/stores/workspace";
import { emptyWorkspace } from "@/types";
export async function signOut() {
  const { error } = await browserSupabase().auth.signOut();
  if (error) throw error;
  useWorkspace.setState({
    data: structuredClone(emptyWorkspace),
    loaded: false,
    error: null,
    toast: null,
  });
}
