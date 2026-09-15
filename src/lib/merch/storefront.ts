import { usesMerchBackend } from "./config";
import * as merch from "./catalog";
import * as legacy from "@/lib/shopify";

export async function getProducts() {
  return usesMerchBackend() ? merch.getProducts() : legacy.getProducts();
}

export async function getProductByHandle(handle: string) {
  return usesMerchBackend() ? merch.getProductByHandle(handle) : legacy.getProductByHandle(handle);
}
