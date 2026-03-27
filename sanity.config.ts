import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./src/sanity/schemas";

export default defineConfig({
  name: "daisychain",
  title: "Daisy Chain Records",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  basePath: "/studio",
  plugins: [structureTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
  document: {
    actions: (prev) => {
      // Put Publish first so it's the primary action button
      const publish = prev.find((a) => a.action === "publish");
      const rest = prev.filter((a) => a.action !== "publish");
      return publish ? [publish, ...rest] : prev;
    },
  },
});
