import { Resend } from "resend";

/**
 * Escape values that may originate from buyer-controlled Stripe fields
 * (customer name, email, item titles) before interpolating into email HTML.
 * Prevents link/markup injection into the buyer's confirmation AND into the
 * owner's [ALERT] inbox.
 */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Send a download-link email to a guest buyer after purchase.
 * Falls back silently if Resend is not configured — the buyer still
 * has the Stripe success redirect as their primary download path.
 */
export async function sendDownloadEmail({
  to,
  releaseTitle,
  artistName,
  downloadUrl,
  coverArtUrl,
}: {
  to: string;
  releaseTitle: string;
  artistName: string;
  downloadUrl: string;
  coverArtUrl?: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping download email");
    return;
  }

  const coverHtml = coverArtUrl
    ? `<img src="${esc(coverArtUrl)}" alt="${esc(releaseTitle)}" width="200" height="200" style="display: block; margin: 0 auto 24px; border-radius: 24px 8px 24px 4px; object-fit: cover;" />`
    : "";

  const { error } = await resend.emails.send({
    from: "Daisy Chain Recordings <noreply@daisychainsd.com>",
    to,
    subject: `Your download: ${releaseTitle} by ${artistName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #e8e4df; background: #0f0e0c;">
        <div style="background: #1a1816; border-radius: 16px; padding: 32px; border: 1px solid rgba(124,185,232,0.12);">
          ${coverHtml}
          <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px; color: #e8e4df; text-align: center;">
            Thank you!
          </h1>
          <p style="font-size: 14px; color: #a8a299; margin: 0 0 24px; line-height: 1.6; text-align: center;">
            Your purchase of <strong style="color: #e8e4df;">${esc(releaseTitle)}</strong> by <strong style="color: #e8e4df;">${esc(artistName)}</strong> is complete.
          </p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${downloadUrl}" style="display: inline-block; background: #7cb9e8; color: #0f0e0c; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 0 24px 24px 24px; text-decoration: none;">
              Download Your Music
            </a>
          </div>
          <div style="border-top: 1px solid rgba(124,185,232,0.15); padding-top: 24px; margin-top: 24px;">
            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #7cb9e8; margin: 0 0 12px; text-align: center;">
              KEEP YOUR MUSIC SAFE
            </p>
            <p style="font-size: 13px; color: #a8a299; margin: 0 0 16px; line-height: 1.6; text-align: center;">
              Create a free account to re-download this release anytime, in any format. Your purchases are saved automatically.
            </p>
            <div style="text-align: center;">
              <a href="https://www.daisychainsd.com/signup" style="display: inline-block; border: 1px solid rgba(124,185,232,0.3); color: #7cb9e8; font-weight: 600; font-size: 13px; padding: 10px 24px; border-radius: 0 24px 24px 24px; text-decoration: none;">
                Create Free Account
              </a>
            </div>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send download email:", error);
  }
}

/**
 * Send an order confirmation email after any successful purchase.
 * Covers: digital (logged-in), cart, physical, unlimited pass.
 * Guest digital buyers already receive sendDownloadEmail which serves as their confirmation.
 */
export async function sendOrderConfirmationEmail({
  to,
  customerName,
  type,
  items,
  totalCents,
  accountUrl,
  coverArtUrl,
}: {
  to: string;
  customerName?: string;
  type: "digital" | "cart" | "physical" | "unlimited_pass";
  items: { title: string; artist?: string }[];
  totalCents: number;
  accountUrl?: string;
  coverArtUrl?: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping order confirmation email");
    return;
  }

  const greeting = customerName ? `Hi ${esc(customerName.split(" ")[0])},` : "Hi there,";
  const total = `$${(totalCents / 100).toFixed(2)}`;

  const isPhysical = type === "physical";
  const isPass = type === "unlimited_pass";

  const subject = isPass
    ? "Your Unlimited Pass is active"
    : isPhysical
      ? "Order confirmed — we're packing your order"
      : items.length === 1
        ? `Purchase confirmed: ${items[0].title}`
        : `Purchase confirmed — ${items.length} items`;

  const coverHtml = coverArtUrl
    ? `<img src="${coverArtUrl}" alt="" width="160" height="160" style="display: block; margin: 0 auto 24px; border-radius: 24px 8px 24px 4px; object-fit: cover;" />`
    : "";

  const itemListHtml = items
    .map(
      (item) =>
        `<li style="margin: 0 0 6px; color: #e8e4df;">${esc(item.title)}${item.artist ? ` <span style="color: #a8a299;">by ${esc(item.artist)}</span>` : ""}</li>`,
    )
    .join("");

  let bodyHtml: string;

  if (isPass) {
    bodyHtml = `
      <p style="font-size: 14px; color: #a8a299; margin: 0 0 16px; line-height: 1.6;">
        ${greeting} your Unlimited Pass is now active. You have access to every release in the Daisy Chain catalog — current and future — in any format.
      </p>
      <p style="font-size: 13px; color: #a8a299; margin: 0 0 24px; line-height: 1.6;">
        <strong style="color: #e8e4df;">Total: ${total}</strong>
      </p>
    `;
  } else if (isPhysical) {
    bodyHtml = `
      <p style="font-size: 14px; color: #a8a299; margin: 0 0 16px; line-height: 1.6;">
        ${greeting} your order has been confirmed and we're getting it ready to ship. You'll receive a shipping notification with tracking info once it's on its way.
      </p>
      ${items.length > 0 ? `<ul style="font-size: 13px; padding-left: 18px; margin: 0 0 16px; line-height: 1.8;">${itemListHtml}</ul>` : ""}
      <p style="font-size: 13px; color: #a8a299; margin: 0 0 24px; line-height: 1.6;">
        <strong style="color: #e8e4df;">Total: ${total}</strong>
      </p>
    `;
  } else {
    bodyHtml = `
      <p style="font-size: 14px; color: #a8a299; margin: 0 0 16px; line-height: 1.6;">
        ${greeting} your purchase is confirmed. Your music is ready to download from your account.
      </p>
      ${items.length > 0 ? `<ul style="font-size: 13px; padding-left: 18px; margin: 0 0 16px; line-height: 1.8;">${itemListHtml}</ul>` : ""}
      <p style="font-size: 13px; color: #a8a299; margin: 0 0 24px; line-height: 1.6;">
        <strong style="color: #e8e4df;">Total: ${total}</strong>
      </p>
    `;
  }

  const ctaLabel = isPhysical ? "View Your Order" : "Go to Your Account";
  const ctaUrl = accountUrl || "https://www.daisychainsd.com/account";

  const { error } = await resend.emails.send({
    from: "Daisy Chain Recordings <noreply@daisychainsd.com>",
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #e8e4df; background: #0f0e0c;">
        <div style="background: #1a1816; border-radius: 16px; padding: 32px; border: 1px solid rgba(124,185,232,0.12);">
          ${coverHtml}
          <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 16px; color: #e8e4df; text-align: center;">
            ${isPass ? "Unlimited Pass Active" : isPhysical ? "Order Confirmed" : "Purchase Confirmed"}
          </h1>
          ${bodyHtml}
          <div style="text-align: center;">
            <a href="${ctaUrl}" style="display: inline-block; background: #7cb9e8; color: #0f0e0c; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 0 24px 24px 24px; text-decoration: none;">
              ${ctaLabel}
            </a>
          </div>
          <div style="border-top: 1px solid rgba(124,185,232,0.15); padding-top: 20px; margin-top: 24px;">
            <p style="font-size: 11px; color: #6b6560; margin: 0; text-align: center; line-height: 1.6;">
              Questions? Reply to this email or reach us at playerdave@daisychainsd.com
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send order confirmation email:", error);
    // Try to alert the label owner so they can follow up manually
    const alertTo = process.env.ALERT_EMAIL || "playerdave@daisychainsd.com";
    try {
      await resend.emails.send({
        from: "Daisy Chain Recordings <noreply@daisychainsd.com>",
        to: alertTo,
        subject: `[ALERT] Confirmation email failed to send to ${to}`,
        html: `
          <div style="font-family: monospace; padding: 24px; color: #e8e4df; background: #0f0e0c;">
            <h2 style="color: #e85c5c; margin: 0 0 16px;">Confirmation Email Failed</h2>
            <p><strong>Customer:</strong> ${esc(to)}</p>
            <p><strong>Type:</strong> ${esc(type)}</p>
            <p><strong>Items:</strong> ${esc(items.map((i) => i.title).join(", "))}</p>
            <p><strong>Error:</strong> ${esc(JSON.stringify(error))}</p>
            <p style="margin-top: 24px; color: #a8a299;">
              The customer was charged but did NOT receive a confirmation email.
              Consider reaching out to them directly.
            </p>
          </div>
        `,
      });
    } catch {
      // If even the alert fails, it's already in the logs
    }
  }
}

/**
 * Alert the label owner when the ops-health cron finds failing systems.
 * One email per cron run, listing every failure. Best-effort — if Resend
 * is not configured, falls back to console.error only.
 */
export async function sendOpsHealthAlert(
  failures: { name: string; detail: string }[]
) {
  const alertTo = process.env.ALERT_EMAIL || "playerdave@daisychainsd.com";
  console.error(
    `OPS HEALTH ALERT — ${failures.map((f) => `${f.name}: ${f.detail}`).join("; ")}`
  );

  const resend = getResend();
  if (!resend) return;

  const rows = failures
    .map(
      (f) =>
        `<p style="margin: 0 0 12px;"><strong style="color: #e85c5c;">${esc(f.name)}</strong><br /><span style="color: #a8a299;">${esc(f.detail)}</span></p>`
    )
    .join("");

  try {
    await resend.emails.send({
      from: "Daisy Chain Recordings <noreply@daisychainsd.com>",
      to: alertTo,
      subject: `[OPS] ${failures.length} system(s) failing`,
      html: `
        <div style="font-family: monospace; padding: 24px; color: #e8e4df; background: #0f0e0c;">
          <h2 style="color: #e85c5c; margin: 0 0 16px;">Ops Health Check Failed</h2>
          ${rows}
          <p style="margin-top: 24px; color: #a8a299;">
            Full detail on the dashboard: https://www.daisychainsd.com/ops
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send ops health alert email:", err);
  }
}

/**
 * Alert the label owner when a purchase fails to record.
 * Best-effort — if Resend is not configured, falls back to console.error only.
 */
export async function sendPurchaseFailureAlert({
  email,
  slug,
  sessionId,
  error,
}: {
  email: string;
  slug: string;
  sessionId: string;
  error: string;
}) {
  const alertTo = process.env.ALERT_EMAIL || "playerdave@daisychainsd.com";
  console.error(`PURCHASE FAILURE ALERT — customer: ${email}, slug: ${slug}, session: ${sessionId}, error: ${error}`);

  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Daisy Chain Recordings <noreply@daisychainsd.com>",
      to: alertTo,
      subject: `[ALERT] Purchase failed to record — ${slug}`,
      html: `
        <div style="font-family: monospace; padding: 24px; color: #e8e4df; background: #0f0e0c;">
          <h2 style="color: #e85c5c; margin: 0 0 16px;">Purchase Recording Failed</h2>
          <p><strong>Customer email:</strong> ${esc(email)}</p>
          <p><strong>Release:</strong> ${esc(slug)}</p>
          <p><strong>Stripe session:</strong> ${esc(sessionId)}</p>
          <p><strong>Error:</strong> ${esc(error)}</p>
          <p style="margin-top: 24px; color: #a8a299;">
            The customer was charged but their purchase was NOT saved.
            Check Stripe dashboard and manually add the purchase to Supabase.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send purchase failure alert email:", err);
  }
}
