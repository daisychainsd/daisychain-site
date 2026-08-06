import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

// Read-only (viewer) token. The dataset is PRIVATE, so every query needs one —
// without it the API returns 401 and the site renders empty. Deliberately a
// separate read-only credential rather than SANITY_API_TOKEN (editor-level):
// this module is imported by page renders, so it must never carry write
// rights. Server-only — no NEXT_PUBLIC_ prefix, so it never reaches the
// browser, and every consumer of this client runs on the server.
const readToken = process.env.SANITY_READ_TOKEN;

const isConfigured = projectId && projectId !== "your_project_id";

export const client = isConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      token: readToken,
      // A token disables the CDN unless we opt in explicitly. Keep CDN caching
      // in production for speed; stay live in dev so Studio edits show up.
      useCdn: process.env.NODE_ENV === "production",
    })
  : null;

export async function sanityFetch<T>(query: string, params?: Record<string, unknown>): Promise<T[]> {
  if (!client) return [] as unknown as T[];
  return client.fetch(query, params);
}
