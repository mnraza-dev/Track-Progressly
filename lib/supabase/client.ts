import { createBrowserClient } from "@supabase/ssr";
export const isConnected = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export function browserSupabase() {
  if (!isConnected)
    throw new Error("Connect Supabase in .env.local to use account features.");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
