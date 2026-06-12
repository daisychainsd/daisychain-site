import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function generateDownloadToken(
  slug: string,
  email: string,
): Promise<string> {
  const supabase = createAdminClient();
  const token = crypto.randomUUID();

  const { error } = await supabase.from("download_tokens").insert({
    token,
    slug,
    email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    console.error("Failed to create download token:", error);
    throw error;
  }

  return token;
}

export async function validateDownloadToken(
  token: string,
  slug: string,
): Promise<{ valid: boolean }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("download_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !data) {
    return { valid: false };
  }

  // Check slug matches
  if (data.slug !== slug) {
    return { valid: false };
  }

  // Validity is bounded by expires_at only (7 days). The previous 1-hour
  // post-first-use window meant a guest returning the next day got "could not
  // verify purchase" — a support-ticket generator for a guest-first product.
  // We still stamp used_at on first use for analytics, but no longer reject on it.
  if (new Date(data.expires_at) < new Date()) {
    return { valid: false };
  }

  if (!data.used_at) {
    await supabase
      .from("download_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);
  }

  return { valid: true };
}
