import { defineField, defineType } from "sanity";

export const listenPage = defineType({
  name: "listenPage",
  title: "Listen Page",
  type: "document",
  liveEdit: true,
  fields: [
    defineField({
      name: "spotifyUrl",
      title: "Spotify Playlist URL",
      type: "url",
    }),
    defineField({
      name: "soundcloudUrl",
      title: "SoundCloud Playlist URL",
      type: "url",
    }),
    defineField({
      name: "youtubeUrl",
      title: "YouTube Playlist URL",
      type: "url",
    }),
  ],
  preview: {
    prepare() {
      return { title: "Listen Page" };
    },
  },
});
