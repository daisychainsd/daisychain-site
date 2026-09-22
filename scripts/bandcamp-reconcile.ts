// Read-only by default. --apply imports physical orders; no emails or Bandcamp writes.
import { reconcileBandcampOrders } from "../src/lib/merch/bandcamp";
async function main() {
  const apply = process.argv.includes("--apply");
  const { report } = await reconcileBandcampOrders(apply);
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length || (!apply && report.missing.length)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Bandcamp reconciliation failed"); process.exitCode = 1; });
