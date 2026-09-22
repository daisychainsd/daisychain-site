// Read-only audit: node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts
// Import missing orders: append --apply. Optional recovery files: --output=/private/path
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { reconcilePhysicalOrders, reconciliationFailed } from "../src/lib/merch/reconcile";
import { pirateShipCsv } from "../src/lib/merch/csv";
import type { MerchOrder } from "../src/lib/merch/types";

async function main() {
  const { report, recovered } = await reconcilePhysicalOrders(process.argv.includes("--apply"));
  const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
  if (output) {
    await mkdir(output, { recursive: true, mode: 0o700 });
    await writeFile(resolve(output, "recovered-orders.json"), JSON.stringify(recovered, null, 2), { mode: 0o600 });
    const rows = recovered.map((p, i) => ({ ...p, order_number: i + 1 })) as MerchOrder[];
    // Recovery references are deliberately distinct from the database's DC numbers.
    const csv = pirateShipCsv(rows).replace(/DC-(\d{5})/g, "RECOVERY-$1");
    await writeFile(resolve(output, "check-pirate-ship-before-shipping.csv"), csv, { mode: 0o600 });
    console.log(`Recovery files saved to ${resolve(output)}. Shipping status is unverified; check Pirate Ship first.`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (reconciliationFailed(report, process.argv.includes("--apply"))) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
