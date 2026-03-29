import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(supabaseUrl, supabaseKey);
}
