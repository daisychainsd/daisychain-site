import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireOps } from "@/lib/merch/auth";
import MerchDashboard from "./MerchDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merch Ops", robots: { index: false, follow: false } };
export default async function MerchPage() {
  try { requireOps(new Request("https://ops.internal/ops/merch", { headers: await headers() })); }
  catch { notFound(); }
  return <MerchDashboard />;
}
