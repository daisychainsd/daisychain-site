// Shared GROQ queries — single source of truth for all Sanity fetches

const releaseCardFields = `
  title,
  "slug": slug.current,
  displayArtist,
  "artist": coalesce(displayArtist, artist->name),
  coverArt,
  catalogNumber,
  format,
  releaseDate
`;

export const RELEASES_LIST = `
  *[_type == "release"] | order(releaseDate desc) {
    ${releaseCardFields}
  }
`;

export const RELEASE_DETAIL = `
  *[_type == "release" && slug.current == $slug][0] {
    title,
    "slug": slug.current,
    displayArtist,
    "artist": coalesce(displayArtist, artist->name),
    "artistSlug": artist->slug.current,
    "primaryArtistName": artist->name,
    "additionalArtists": additionalArtists[]->{ name, "slug": slug.current },
    "remixerSlug": select(
      releaseType == "remix" => *[_type == "artist" && name == ^.displayArtist][0].slug.current,
      null
    ),
    coverArt,
    catalogNumber,
    releaseType,
    format,
    releaseDate,
    _id,
    price,
    physicalPrice,
    shopifyHandle,
    embedUrl,
    description,
    tracks[] {
      title,
      trackArtist,
      duration,
      trackNumber,
      youtubeUrl,
      "audioUrl": audioFile.asset->url,
      "previewUrl": previewFile.asset->url
    }
  }
`;

export const RELEASE_DOWNLOAD = `
  *[_type == "release" && slug.current == $slug][0] {
    title,
    "slug": slug.current,
    displayArtist,
    "artist": coalesce(displayArtist, artist->name),
    coverArt,
    catalogNumber,
    tracks[] {
      title,
      trackArtist,
      trackNumber,
      "audioUrl": audioFile.asset->url,
      "previewUrl": previewFile.asset->url
    }
  }
`;

export const ARTISTS_LIST = `
  *[_type == "artist"] | order(name asc) {
    name,
    "slug": slug.current,
    photo,
    "releaseCount": count(*[_type == "release" && references(^._id)])
  }
`;

export const ARTIST_DETAIL = `
  *[_type == "artist" && slug.current == $slug][0] {
    name,
    "slug": slug.current,
    photo,
    bio,
    links,
    "releases": *[_type == "release" && references(^._id)] | order(releaseDate desc) {
      ${releaseCardFields}
    }
  }
`;

export const RELEASES_BY_SLUGS = `
  *[_type == "release" && slug.current in $slugs] | order(releaseDate desc) {
    title,
    "slug": slug.current,
    "artist": coalesce(displayArtist, artist->name),
    coverArt,
    catalogNumber,
    tracks[] {
      title,
      trackArtist,
      trackNumber,
      "audioUrl": audioFile.asset->url,
      "previewUrl": previewFile.asset->url
    }
  }
`;

export const ALL_RELEASES_DOWNLOAD = `
  *[_type == "release"] | order(releaseDate desc) {
    title,
    "slug": slug.current,
    "artist": coalesce(displayArtist, artist->name),
    coverArt,
    catalogNumber,
    tracks[] {
      title,
      trackArtist,
      trackNumber,
      "audioUrl": audioFile.asset->url,
      "previewUrl": previewFile.asset->url
    }
  }
`;

export const LATEST_RELEASE = `
  *[_type == "release"] | order(releaseDate desc)[0] {
    title,
    "slug": slug.current,
    "artist": coalesce(displayArtist, artist->name),
    coverArt,
    releaseType
  }
`;

export const NEXT_EVENT = `
  *[_type == "event" && date > now()] | order(date asc)[0] {
    title,
    "slug": slug.current,
    date,
    venue,
    flyer,
    ticketUrl,
    lineup[] {
      name,
      "artistSlug": artist->slug.current
    }
  }
`;

export const EVENTS_LIST = `
  *[_type == "event"] | order(date desc) {
    title,
    "slug": slug.current,
    date,
    venue,
    flyer,
    ticketUrl,
    description,
    lineup[] {
      name,
      "artistSlug": artist->slug.current
    }
  }
`;
