import { runBandcampCron } from "@/lib/merch/bandcamp-cron";
export const maxDuration = 300;
export async function GET(request: Request) { return runBandcampCron(request); }
