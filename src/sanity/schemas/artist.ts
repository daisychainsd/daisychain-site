import { defineField, defineType } from "sanity";

export const artist = defineType({
  name: "artist",
  title: "Artist",
  type: "document",
  liveEdit: true,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "photo",
      title: "Photo",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
    }),
    defineField({
      name: "rosterTier",
      title: "Roster Tier",
      type: "string",
      initialValue: "main",
      options: {
        list: [
          { title: "Main — shows on the /artists roster grid", value: "main" },
          { title: "Side — only credited on tracks / features, hidden from roster", value: "side" },
        ],
        layout: "radio",
      },
      description:
        "'Main' artists appear in the /artists roster grid. 'Side' artists still get credited on individual tracks and releases (and have working /artists/[slug] profile pages), but don't take up a slot on the main roster page.",
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      description:
        "Short descriptor — e.g. 'Producer · DJ', 'Vocalist', 'Live act'. Shown on the roster card.",
    }),
    defineField({
      name: "hometown",
      title: "Hometown",
      type: "string",
      description: "e.g. 'San Diego, CA'. Shown on the roster card.",
    }),
    defineField({
      name: "links",
      title: "Links",
      type: "object",
      fields: [
        defineField({ name: "website", type: "url", title: "Website" }),
        defineField({ name: "instagram", type: "url", title: "Instagram" }),
        defineField({ name: "spotify", type: "url", title: "Spotify" }),
        defineField({ name: "youtube", type: "url", title: "YouTube" }),
        defineField({ name: "soundcloud", type: "url", title: "SoundCloud" }),
      ],
    }),
  ],
});
