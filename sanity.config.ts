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
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Homepage")
              .id("homepageSettings")
              .child(
                S.document()
                  .schemaType("homepageSettings")
                  .documentId("homepageSettings")
              ),
            S.divider(),
            S.listItem()
              .title("Releases")
              .schemaType("release")
              .child(
                S.documentTypeList("release")
                  .title("Releases")
                  .defaultOrdering([{ field: "releaseDate", direction: "desc" }])
              ),
            S.documentTypeListItem("artist").title("Artists"),
            S.documentTypeListItem("event").title("Events"),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
});
