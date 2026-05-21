// One-time script to recover lost logged-in purchases from Stripe into Supabase.
// The purchases table was empty due to a broken upsert (onConflict referenced a dropped constraint).
// Run: node scripts/recover-purchases.mjs

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sessions = await stripe.checkout.sessions.list({ limit: 100, status: "complete" });

const purchases = [];
for (const s of sessions.data) {
  const meta = s.metadata || {};
  if (!meta.userId || meta.isGuest === "true") continue;

  if (meta.type === "cart") {
    try {
      const items = JSON.parse(meta.cartTracks);
      for (const item of items) {
        purchases.push({
          user_id: meta.userId,
          release_slug: item.slug,
          stripe_session_id: s.id,
          ...(item.trackKey ? { track_key: item.trackKey } : {}),
          _email: s.customer_details?.email,
          _created: new Date(s.created * 1000).toISOString(),
        });
      }
    } catch {
      console.log("Failed to parse cart for", s.id);
    }
  } else if (meta.type === "unlimited_pass") {
    console.log("Unlimited pass:", s.id, s.customer_details?.email);
  } else if (meta.slug) {
    purchases.push({
      user_id: meta.userId,
      release_slug: meta.slug,
      stripe_session_id: s.id,
      ...(meta.trackKey ? { track_key: meta.trackKey } : {}),
      _email: s.customer_details?.email,
      _created: new Date(s.created * 1000).toISOString(),
    });
  }
}

console.log(`Found ${purchases.length} logged-in purchase(s) to recover:`);
for (const p of purchases) {
  console.log(`  - ${p._email} → ${p.release_slug} (${p._created})`);
}

for (const p of purchases) {
  const { _email, _created, ...row } = p;
  const { error } = await supabase.from("purchases").insert(row);
  if (error) {
    if (error.code === "23505") console.log(`  Already exists: ${row.release_slug}`);
    else console.error(`  FAILED: ${row.release_slug}`, error);
  } else {
    console.log(`  RECOVERED: ${_email} → ${row.release_slug}`);
  }
}
