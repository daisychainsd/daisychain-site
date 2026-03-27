import { defineField, defineType } from "sanity";

export const event = defineType({
  name: "event",
  title: "Event",
  type: "document",
  liveEdit: true,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
    }),
    defineField({
      name: "date",
      title: "Date",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "venue",
      title: "Venue",
      type: "string",
    }),
    defineField({
      name: "flyer",
      title: "Flyer",
      type: "image",
    }),
    defineField({
      name: "ticketUrl",
      title: "Ticket Link",
      type: "url",
    }),
    defineField({
      name: "lineup",
      title: "Lineup",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "name", type: "string", title: "Artist Name" }),
            defineField({
              name: "artist",
              type: "reference",
              title: "DCR Artist (optional)",
              to: [{ type: "artist" }],
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
    }),
  ],
  orderings: [
    {
      title: "Date, Upcoming",
      name: "dateAsc",
      by: [{ field: "date", direction: "asc" }],
    },
  ],
});
