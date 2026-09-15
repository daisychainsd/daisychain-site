export function usesMerchBackend() {
  return process.env.MERCH_BACKEND === "supabase";
}
