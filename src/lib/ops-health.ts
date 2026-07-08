import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { client as sanityClient } from "@/sanity/client";
import { shopifyFetch } from "@/lib/shopify";

/**
 * Shared health checks for the /ops dashboard and the /api/cron/ops-health
 * alert cron. Every check is wrapped so runHealthChecks() never throws —
 * a failing integration becomes { ok: false } with the error as detail.
 */

const TIMEOUT_MS = 5000;

export type HealthCheck = {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
};

/** Shape of dc-email-api GET /api/status (see dc-email-api repo). */
export type EmailApiStatus = {
  ok?: boolean;
  checkedAt?: string;
  redis?: { configured?: boolean; reachable?: boolean };
  cursors?: {
    bandcampLastEndTime?: string | null;
    shotgunLastAfter?: string | null;
  };
  laylo?: { lastWebhookAt?: string | null; daysSince?: number | null };
  beehiiv?: {
    ok?: boolean;
    subscriberCount?: number | null;
    lastPost?: { title: string; publishedAt: string } | null;
  };
};

export type OrderRow = {
  id: string;
  created: number; // unix seconds
  amountCents: number;
  currency: string;
  email: string | null;
  description: string | null;
  /** Stripe payment_status: "paid" | "unpaid" | "no_payment_required" */
  status: string;
};

export type OpsHealth = {
  checks: HealthCheck[];
  /** dc-email-api status payload (Email panel data), when reachable. */
  email: EmailApiStatus | null;
  /** Last 10 Stripe checkout sessions (Orders panel data), when reachable. */
  orders: OrderRow[];
  checkedAt: string;
};

async function timed(
  name: string,
  fn: () => Promise<string>
): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail, ms: Date.now() - start };
  } catch (e) {
    return {
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - start,
    };
  }
}

/** Race a promise against a 5s timeout, for clients without AbortSignal support. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    ),
  ]);
}

export async function runHealthChecks(): Promise<OpsHealth> {
  let email: EmailApiStatus | null = null;
  let orders: OrderRow[] = [];

  const checkNames = ["dc-email-api", "Stripe", "Supabase", "Sanity", "Shopify"];

  const settled = await Promise.allSettled([
    timed("dc-email-api", async () => {
      const secret = process.env.DC_EMAIL_API_INTERNAL_SECRET;
      if (!secret) throw new Error("DC_EMAIL_API_INTERNAL_SECRET not set");
      const base = process.env.DC_EMAIL_API_URL ?? "https://dc-email-api.vercel.app";
      const res = await fetch(`${base}/api/status`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status === 404) throw new Error("status endpoint not deployed");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      email = (await res.json()) as EmailApiStatus;
      if (email.ok === false) {
        // Endpoint reachable but the service reports itself degraded
        // (redis unreachable or beehiiv API failing).
        throw new Error("service reports degraded (redis or beehiiv)");
      }
      const subs = email.beehiiv?.subscriberCount;
      return typeof subs === "number" ? `${subs} subscribers` : "reachable";
    }),

    timed("Stripe", async () => {
      // Completed checkout sessions (not raw charges) — the site's checkout
      // routes put release title/artist in session metadata, so orders are
      // legible, and status: "complete" drops abandoned carts.
      const res = await getStripe().checkout.sessions.list(
        { limit: 10, status: "complete" },
        { timeout: TIMEOUT_MS }
      );
      orders = res.data.map((s) => {
        const m = s.metadata ?? {};
        const description =
          [m.title, m.artist].filter(Boolean).join(" — ") ||
          (m.type === "physical"
            ? "Physical order"
            : m.type === "cart"
              ? "Cart purchase"
              : m.type === "unlimited_pass"
                ? "Unlimited Pass"
                : null);
        return {
          id: s.id,
          created: s.created,
          amountCents: s.amount_total ?? 0,
          currency: s.currency ?? "usd",
          email: s.customer_details?.email ?? s.customer_email ?? null,
          description,
          status: s.payment_status,
        };
      });
      return `${orders.length} recent orders`;
    }),

    timed("Supabase", async () => {
      // Stripe lists every sale; Supabase only records digital entitlements —
      // account purchases + guest purchases. Merch never writes a row here.
      const supabase = createAdminClient();
      const [acct, guest] = await Promise.all([
        supabase
          .from("purchases")
          .select("*", { count: "exact", head: true })
          .abortSignal(AbortSignal.timeout(TIMEOUT_MS)),
        supabase
          .from("guest_purchases")
          .select("*", { count: "exact", head: true })
          .abortSignal(AbortSignal.timeout(TIMEOUT_MS)),
      ]);
      const err = acct.error ?? guest.error;
      if (err) throw new Error(err.message);
      return `${(acct.count ?? 0) + (guest.count ?? 0)} download purchases (${acct.count ?? 0} account + ${guest.count ?? 0} guest)`;
    }),

    timed("Sanity", async () => {
      if (!sanityClient) throw new Error("Sanity not configured");
      const n = await sanityClient.fetch<number>(
        `count(*[_type == "release"])`,
        {},
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      return `${n} releases`;
    }),

    timed("Shopify", async () => {
      const data = await withTimeout(
        shopifyFetch<{ shop: { name: string } }>({ query: "{ shop { name } }" })
      );
      return data.shop.name;
    }),
  ]);

  // timed() never rejects, but allSettled makes that guarantee structural.
  const checks: HealthCheck[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { name: checkNames[i], ok: false, detail: String(s.reason), ms: 0 }
  );

  return { checks, email, orders, checkedAt: new Date().toISOString() };
}

export type Revenue30 = {
  totalCents: number;
  chargeCount: number;
  /** true when there were >100 charges in the window — total shown as "100+". */
  capped: boolean;
};

/** 30-day revenue: sum of succeeded charges, single list call capped at 100. */
export async function get30DayRevenue(): Promise<Revenue30 | null> {
  try {
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    const res = await getStripe().charges.list(
      { limit: 100, created: { gte: since } },
      { timeout: TIMEOUT_MS }
    );
    const succeeded = res.data.filter((c) => c.status === "succeeded");
    return {
      totalCents: succeeded.reduce((sum, c) => sum + c.amount - c.amount_refunded, 0),
      chargeCount: succeeded.length,
      capped: res.has_more,
    };
  } catch {
    return null;
  }
}
