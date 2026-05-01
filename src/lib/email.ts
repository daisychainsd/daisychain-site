import { Resend } from "resend";

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
}: {
  to: string;
  releaseTitle: string;
  artistName: string;
  downloadUrl: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping download email to", to);
    return;
  }

  const { error } = await resend.emails.send({
    from: "Daisy Chain Records <noreply@daisychainsd.com>",
    to,
    subject: `Your download: ${releaseTitle} by ${artistName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #e8e4df;">
        <div style="background: #1a1816; border-radius: 16px; padding: 32px; border: 1px solid rgba(124,185,232,0.12);">
          <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #7cb9e8; margin: 0 0 16px;">
            Daisy Chain Records
          </p>
          <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 4px; color: #e8e4df;">
            ${releaseTitle}
          </h1>
          <p style="font-size: 14px; color: #7cb9e8; margin: 0 0 24px;">
            ${artistName}
          </p>
          <p style="font-size: 14px; color: #a8a299; margin: 0 0 24px; line-height: 1.6;">
            Your purchase is ready. Click below to download in your preferred format (WAV, FLAC, AIFF, or MP3).
          </p>
          <a href="${downloadUrl}" style="display: inline-block; background: #7cb9e8; color: #0f0e0c; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 0 24px 24px 24px; text-decoration: none;">
            Download Your Music
          </a>
          <p style="font-size: 12px; color: #6b6560; margin: 24px 0 0; line-height: 1.5;">
            This link is tied to your Stripe session. Bookmark it to come back later, or create a free account at daisychainsd.com to keep all your purchases in one place.
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send download email:", error);
  }
}
