import { defineField, defineType } from "sanity";

export const SOP_AREA_ORDER = [
  "Label",
  "Site / Store / Data",
  "Marketing / Content",
  "Email / SMS",
  "Merch",
  "Events",
];

export const sop = defineType({
  name: "sop",
  title: "SOP",
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
      name: "area",
      title: "Area",
      type: "string",
      options: { list: SOP_AREA_ORDER },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Live", value: "live" },
          { title: "Draft", value: "draft" },
          { title: "To build", value: "todo" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      initialValue: "todo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "owner",
      title: "Owner",
      type: "string",
      description: "Who runs this — e.g. “Niko runs, Charlie gates”",
    }),
    defineField({
      name: "note",
      title: "Note",
      type: "text",
      rows: 2,
      description: "One-liner shown on the ops dashboard row",
    }),
    defineField({
      name: "links",
      title: "Reference links",
      type: "array",
      description:
        "Tools, sheets, trackers — anything used alongside this SOP. Shows on the dashboard row.",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "url",
              title: "URL",
              type: "url",
              validation: (rule) =>
                rule.required().uri({ scheme: ["http", "https"] }),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "url" },
          },
        },
      ],
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      description: "Only needed when a Google Doc is attached below",
    }),
    defineField({
      name: "docId",
      title: "Google Doc ID",
      type: "string",
      description:
        "The SOP document — from its URL: docs.google.com/document/d/<THIS PART>/edit. Adds a “View SOP” page.",
    }),
    defineField({
      name: "order",
      title: "Sort order",
      type: "number",
      description: "Lower numbers show first within the area",
      initialValue: 0,
    }),
  ],
  preview: {
    select: { title: "name", area: "area", status: "status" },
    prepare({ title, area, status }) {
      return { title, subtitle: `${area} · ${status}` };
    },
  },
});
