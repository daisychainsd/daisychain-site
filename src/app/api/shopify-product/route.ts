import { NextRequest, NextResponse } from "next/server";
import { getProductByHandle } from "@/lib/shopify";

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  const product = await getProductByHandle(handle);
  return NextResponse.json({ product });
}
