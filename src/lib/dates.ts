// Date formatting helpers locked to Daisy Chain's home timezone (Pacific).
//
// Why this exists:
// - Sanity datetime fields like `event.date` are stored with explicit offsets
//   (e.g. "2026-05-08T21:00:00-07:00").
// - When rendered server-side on Vercel (which runs in UTC),
//   `Date.toLocaleDateString("en-US", { ...no timeZone... })` formats in UTC.
//   For a 9pm PT event, the UTC moment lands the next calendar day, so cards
//   showed "MAY 9" instead of "MAY 8".
// - Pinning the timezone to Pacific keeps the displayed date consistent with
//   how the date was entered in Studio, regardless of where the server runs
//   or which browser the user has.
//
// All event-related date rendering should use these helpers. Release dates
// (Sanity `date` type, no time component) are anchored at noon by appending
// `T12:00:00` and don't need this timezone treatment.

export const DC_TIMEZONE = "America/Los_Angeles";

export function fmtEventDate(
  date: string | Date | undefined | null,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { timeZone: DC_TIMEZONE, ...opts });
}

export function fmtEventYear(date: string | Date | undefined | null): string {
  return fmtEventDate(date, { year: "numeric" });
}
