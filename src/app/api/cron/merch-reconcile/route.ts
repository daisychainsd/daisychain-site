import { runReconciliationCron } from "@/lib/merch/reconcile-cron";

export const maxDuration = 300;
export async function GET(req: Request) {
  return runReconciliationCron(req);
}
