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
    ? `<img src="${coverArtUrl}" alt="${releaseTitle}" width="200" height="200" style="display: block; margin: 0 auto 24px; border-radius: 24px 8px 24px 4px; object-fit: cover;" />`
    : "";

  const { error } = await resend.emails.send({
    from: "Daisy Chain Records <noreply@daisychainsd.com>",
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
            Your purchase of <strong style="color: #e8e4df;">${releaseTitle}</strong> by <strong style="color: #e8e4df;">${artistName}</strong> is complete.
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
