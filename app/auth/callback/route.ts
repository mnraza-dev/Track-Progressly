import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next =
    url.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/dashboard";
  if (code) {
    const db = await serverSupabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
