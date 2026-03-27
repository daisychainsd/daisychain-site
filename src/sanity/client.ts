import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

const isConfigured = projectId && projectId !== "your_project_id";

export const client = isConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: true,
    })
  : null;

export async function sanityFetch<T>(query: string, params?: Record<string, unknown>): Promise<T[]> {
  if (!client) return [] as unknown as T[];
  return client.fetch(query, params);
}
