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
      description: "Full artist credit as shown on release (e.g. 'Player Dave & sumthin sumthin'). Overrides the artist reference for display.",
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
          { title: "Vinyl", value: "vinyl" },
          { title: "Digital", value: "digital" },
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
              name: "trackNumber",
              title: "Track Number",
              type: "number",
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
      description: "Price in dollars. Leave blank or 0 for free download.",
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
