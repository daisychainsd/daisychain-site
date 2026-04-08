import { defineField, defineType } from "sanity";

export const release = defineType({
  name: "release",
  title: "Release",
  type: "document",
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
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "artist",
      title: "Artist",
      type: "reference",
      to: [{ type: "artist" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "displayArtist",
      title: "Display Artist",
      type: "string",
      description: "Overrides the primary artist name for display (e.g. remixer name). Use Additional Artists for collabs instead.",
    }),
    defineField({
      name: "additionalArtists",
      title: "Additional Artists",
      type: "array",
      of: [{ type: "reference", to: [{ type: "artist" }] }],
      description: "Other credited artists (collaborators, featured artists, etc.)",
    }),
    defineField({
      name: "coverArt",
      title: "Cover Art",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "releaseDate",
      title: "Release Date",
      type: "date",
    }),
    defineField({
      name: "catalogNumber",
      title: "Catalog Number",
      type: "string",
    }),
    defineField({
      name: "releaseType",
      title: "Release Type",
      type: "string",
      options: {
        list: [
          { title: "Single", value: "single" },
          { title: "EP", value: "ep" },
          { title: "Album", value: "album" },
          { title: "Compilation", value: "compilation" },
          { title: "Remix", value: "remix" },
        ],
      },
    }),
    defineField({
      name: "format",
      title: "Format",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Digital", value: "digital" },
          { title: "Vinyl", value: "vinyl" },
          { title: "CD", value: "cd" },
          { title: "Cassette", value: "cassette" },
        ],
      },
    }),
    defineField({
      name: "tracks",
      title: "Tracks",
      type: "array",
      of: [
        {
          type: "object",
          name: "track",
          fields: [
            defineField({
              name: "title",
              title: "Track Title",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "trackArtist",
              title: "Track Artist (if different from release)",
              type: "string",
            }),
            defineField({
              name: "duration",
              title: "Duration (e.g. 4:32)",
              type: "string",
            }),
            defineField({
              name: "audioFile",
              title: "Audio File (WAV/MP3)",
              type: "file",
              options: {
                accept: "audio/*",
              },
            }),
            defineField({
              name: "previewFile",
              title: "Preview File (MP3 for streaming)",
              type: "file",
              options: { accept: "audio/mpeg" },
            }),
            defineField({
              name: "trackNumber",
              title: "Track Number",
              type: "number",
            }),
            defineField({
              name: "youtubeUrl",
              title: "YouTube URL",
              type: "url",
              description: "Link to the visualizer or music video on YouTube",
            }),
          ],
          preview: {
            select: {
              title: "title",
              trackNumber: "trackNumber",
              trackArtist: "trackArtist",
            },
            prepare({ title, trackNumber, trackArtist }) {
              return {
                title: `${trackNumber || "—"}. ${title}`,
                subtitle: trackArtist || "",
              };
            },
          },
        },
      ],
    }),
    defineField({
      name: "price",
      title: "Price (USD)",
      type: "number",
      description: "Digital price in dollars. Leave blank or 0 for free download.",
    }),
    defineField({
      name: "physicalPrice",
      title: "Physical Price (USD)",
      type: "number",
      description: "Price for vinyl/cassette. Leave blank if not yet available for purchase.",
    }),
    defineField({
      name: "shopifyHandle",
      title: "Shopify Product Handle",
      type: "string",
      description: "Handle of the linked Shopify product (e.g. 'dream-disc-cd'). Used for physical format purchases.",
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      initialValue: "live",
      options: {
        list: [
          { title: "Live — available to buy/stream", value: "live" },
          { title: "Upcoming — pre-save only", value: "upcoming" },
        ],
        layout: "radio",
      },
      description: "Set to 'Upcoming' to show a Pre-save button instead of Buy.",
    }),
    defineField({
      name: "presaveUrl",
      title: "Pre-save URL",
      type: "url",
      description: "Link to pre-save on Spotify, Apple Music, etc. Only shown when Status is Upcoming.",
    }),
    defineField({
      name: "embedUrl",
      title: "Embed URL (Bandcamp/Soundcloud/Spotify)",
      type: "url",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "blockContent",
    }),
  ],
  orderings: [
    {
      title: "Release Date, New",
      name: "releaseDateDesc",
      by: [{ field: "releaseDate", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      artist: "artist.name",
      media: "coverArt",
    },
    prepare({ title, artist, media }) {
      return {
        title,
        subtitle: artist,
        media,
      };
    },
  },
});
