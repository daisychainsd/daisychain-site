import { defineField, defineType, type SanityDocumentLike } from "sanity";

// Helper for the legacy artist fields' `hidden` callback — they auto-collapse
// in Studio once the new `artists` array has at least one entry.
function hasArtistsArray(document: SanityDocumentLike | undefined): boolean {
  const artists = (document as { artists?: unknown[] } | undefined)?.artists;
  return Array.isArray(artists) && artists.length > 0;
}

export const release = defineType({
  name: "release",
  title: "Release",
  type: "document",
  liveEdit: true,
  fields: [
    defineField({
      name: "hidden",
      title: "Hidden",
      type: "boolean",
      description: "Hide this release from the public site",
      initialValue: false,
    }),
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
      name: "artists",
      title: "Artists",
      type: "array",
      of: [{ type: "reference", to: [{ type: "artist" }] }],
      description:
        "All credited artists, in display order. The first artist is the primary credit shown on cards / playlists. Each name renders as a separate clickable link. For remix releases, list the remixer first, then the original artist(s).",
      validation: (rule) =>
        rule.custom((value, ctx) => {
          const doc = ctx.document as { artist?: { _ref?: string } } | undefined;
          if (Array.isArray(value) && value.length > 0) return true;
          if (doc?.artist?._ref) return true;
          return "Add at least one artist";
        }),
    }),
    // Legacy fields — hidden once `artists` is populated. Kept queryable for
    // older releases that haven't been migrated yet. Don't add new releases
    // here; use `artists` above.
    defineField({
      name: "artist",
      title: "Artist (legacy)",
      type: "reference",
      to: [{ type: "artist" }],
      hidden: ({ document }) => hasArtistsArray(document),
      description: "Legacy single-artist field. Use the 'Artists' array above instead.",
    }),
    defineField({
      name: "displayArtist",
      title: "Display Artist (legacy)",
      type: "string",
      hidden: ({ document }) => hasArtistsArray(document),
      description: "Legacy text override for the primary artist. Use the 'Artists' array above instead.",
    }),
    defineField({
      name: "additionalArtists",
      title: "Additional Artists (legacy)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "artist" }] }],
      hidden: ({ document }) => hasArtistsArray(document),
      description: "Legacy collaborator array. Use the 'Artists' array above instead.",
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
              name: "trackArtists",
              title: "Track Artists",
              type: "array",
              of: [{ type: "reference", to: [{ type: "artist" }] }],
              description:
                "Override the release artist on this specific track. Add one or more — each name renders as a separate clickable link. Use this for compilation tracks, features, or collabs. Leave empty to inherit from the release.",
            }),
            defineField({
              name: "trackArtist",
              title: "Track Artist (text fallback)",
              type: "string",
              description:
                "Legacy plain-text credit. Use the 'Track Artists' field above when possible — it renders as clickable links. This string still displays if no Track Artists are set.",
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
            defineField({
              name: "comingSoon",
              title: "Soon (lock streaming)",
              type: "boolean",
              description:
                "If true, this track can't be streamed on the site — shows a 'Soon' pill instead of a play button. Releases with Status = Upcoming are locked automatically; use this for per-track control on partial EPs.",
              initialValue: false,
            }),
          ],
          preview: {
            select: {
              title: "title",
              trackNumber: "trackNumber",
              trackArtist: "trackArtist",
              comingSoon: "comingSoon",
            },
            prepare({ title, trackNumber, trackArtist, comingSoon }) {
              return {
                title: `${trackNumber || "—"}. ${title}${comingSoon ? " (locked)" : ""}`,
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
      name: "links",
      title: "Streaming / DSP Links",
      type: "object",
      description:
        "Public streaming links displayed as a chip row on the release page. Leave any fields blank to hide them.",
      fields: [
        { name: "spotify", title: "Spotify", type: "url" },
        { name: "appleMusic", title: "Apple Music", type: "url" },
        { name: "bandcamp", title: "Bandcamp", type: "url" },
        { name: "soundcloud", title: "SoundCloud", type: "url" },
        { name: "youtube", title: "YouTube", type: "url" },
      ],
      options: { collapsible: true, collapsed: true },
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
