/** Pass holders can download an upcoming release once it's within this many days of releaseDate. */
export const EARLY_ACCESS_DAYS = 7;

/** YYYY-MM-DD cutoff: an upcoming release with releaseDate <= this is unlocked for pass holders. */
export function earlyAccessCutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + EARLY_ACCESS_DAYS);
  return d.toISOString().split("T")[0];
}

export function isInEarlyAccessWindow(releaseDate?: string | null): boolean {
  return !!releaseDate && releaseDate <= earlyAccessCutoffDate();
}
