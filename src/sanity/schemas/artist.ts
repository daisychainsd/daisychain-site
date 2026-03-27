import { defineField, defineType } from "sanity";

export const artist = defineType({
  name: "artist",
  title: "Artist",
  type: "document",
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
      name: "links",
      title: "Links",
      type: "object",
      fields: [
        defineField({ name: "website", type: "url", title: "Website" }),
        defineField({ name: "instagram", type: "url", title: "Instagram" }),
        defineField({ name: "bandcamp", type: "url", title: "Bandcamp" }),
        defineField({ name: "soundcloud", type: "url", title: "SoundCloud" }),
      ],
    }),
  ],
});
