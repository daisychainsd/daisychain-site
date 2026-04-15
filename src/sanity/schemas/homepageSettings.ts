import { defineField, defineType } from "sanity";

export const homepageSettings = defineType({
  name: "homepageSettings",
  title: "Homepage",
  type: "document",
  fields: [
    defineField({
      name: "upcoming",
      title: "Upcoming — Shows & Releases",
      description:
        "Add shows and releases here in the order you want them displayed on the homepage. Drag to reorder.",
      type: "array",
      of: [
        {
          type: "object",
          name: "upcomingItem",
          title: "Upcoming Item",
          fields: [
            defineField({
              name: "itemType",
              title: "Type",
              type: "string",
              options: {
                list: [
                  { title: "Show / Event", value: "show" },
                  { title: "Music Release", value: "release" },
                ],
                layout: "radio",
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "show",
              title: "Show",
              type: "reference",
              to: [{ type: "event" }],
              hidden: ({ parent }) => parent?.itemType !== "show",
            }),
            defineField({
              name: "release",
              title: "Release",
              type: "reference",
              to: [{ type: "release" }],
              hidden: ({ parent }) => parent?.itemType !== "release",
            }),
          ],
          preview: {
            select: {
              itemType: "itemType",
              showTitle: "show.title",
              releaseTitle: "release.title",
              releaseArtist: "release.artist.name",
              showDate: "show.date",
            },
            prepare({ itemType, showTitle, releaseTitle, releaseArtist, showDate }) {
              if (itemType === "show") {
                const date = showDate
                  ? new Date(showDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "";
                return { title: showTitle || "Untitled Show", subtitle: `Show${date ? ` — ${date}` : ""}` };
              }
              return {
                title: releaseTitle || "Untitled Release",
                subtitle: `Release${releaseArtist ? ` — ${releaseArtist}` : ""}`,
              };
            },
          },
        },
      ],
    }),
  ],
  preview: {
    prepare() {
      return { title: "Homepage Settings" };
    },
  },
});
