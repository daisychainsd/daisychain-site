// Shared GROQ queries — single source of truth for all Sanity fetches

const releaseCardFields = `
  title,
  "slug": slug.current,
  displayArtist,
  "artist": coalesce(artists[0]->name, displayArtist, artist->name),
  coverArt,
  catalogNumber,
  format,
  releaseDate,
  status
`;

export const RELEASES_LIST = `
  *[_type == "release" && hidden != true] | order(releaseDate desc) {
    ${releaseCardFields}
  }
`;

export const RELEASE_DETAIL = `
  *[_type == "release" && slug.current == $slug][0] {
    title,
    "slug": slug.current,
    displayArtist,
    "artist": coalesce(artists[0]->name, displayArtist, artist->name),
    "artistSlug": coalesce(artists[0]->slug.current, artist->slug.current),
    "primaryArtistName": artist->name,
    "artists": artists[]->{ name, "slug": slug.current, rosterTier },
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
    status,
    presaveUrl,
    embedUrl,
    links,
    description,
    tracks[] {
      title,
      trackArtist,
      "trackArtists": trackArtists[]->{ name, "slug": slug.current, rosterTier },
      duration,
      trackNumber,
      youtubeUrl,
      comingSoon,
      "audioUrl": select(
        ^.status == "upcoming" || comingSoon == true => null,
        audioFile.asset->url
      ),
      "previewUrl": select(
        ^.status == "upcoming" || comingSoon == true => null,
        previewFile.asset->url
      )
    }
  }
`;

export const RELEASE_DOWNLOAD = `
  *[_type == "release" && slug.current == $slug][0] {
    title,
    "slug": slug.current,
    displayArtist,
    "artist": coalesce(artists[0]->name, displayArtist, artist->name),
    coverArt,
    catalogNumber,
    tracks[] {
      title,
      trackArtist,
      "trackArtists": trackArtists[]->{ name, "slug": slug.current, rosterTier },
      trackNumber,
      "audioUrl": audioFile.asset->url,
      "previewUrl": previewFile.asset->url
    }
  }
`;

export const ARTISTS_LIST = `
  *[_type == "artist" && rosterTier != "side"] | order(name asc) {
    name,
    "slug": slug.current,
    photo,
    role,
    hometown,
    "releaseCount": count(*[_type == "release" && hidden != true && references(^._id)]),
    "recentReleases": *[_type == "release" && hidden != true && references(^._id)] | order(releaseDate desc)[0...2] {
      title,
      "slug": slug.current,
      catalogNumber
    }
  }
`;

export const ARTIST_DETAIL = `
  *[_type == "artist" && slug.current == $slug][0] {
    name,
    "slug": slug.current,
    photo,
    bio,
    links,
    "releases": *[_type == "release" && references(^._id) && hidden != true] | order(releaseDate desc) {
      ${releaseCardFields}
    }
  }
`;

export const RELEASES_BY_SLUGS = `
  *[_type == "release" && slug.current in $slugs] | order(releaseDate desc) {
    title,
    "slug": slug.current,
    "artist": coalesce(artists[0]->name, displayArtist, artist->name),
    coverArt,
    catalogNumber,
    tracks[] {
      title,
      trackArtist,
      "trackArtists": trackArtists[]->{ name, "slug": slug.current, rosterTier },
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
    "artist": coalesce(artists[0]->name, displayArtist, artist->name),
    coverArt,
    catalogNumber,
    tracks[] {
      title,
      trackArtist,
      "trackArtists": trackArtists[]->{ name, "slug": slug.current, rosterTier },
      trackNumber,
      "audioUrl": audioFile.asset->url,
      "previewUrl": previewFile.asset->url
    }
  }
`;

export const LATEST_RELEASE = `
  *[_type == "release" && hidden != true && status != "upcoming"] | order(releaseDate desc)[0] {
    title,
    "slug": slug.current,
    "artist": coalesce(artists[0]->name, displayArtist, artist->name),
    "artistSlug": artist->slug.current,
    coverArt,
    catalogNumber,
    releaseType,
    releaseDate,
    price,
    description,
    status,
    tracks[0...4] {
      title,
      trackArtist,
      "trackArtists": trackArtists[]->{ name, "slug": slug.current, rosterTier },
      trackNumber,
      duration,
      comingSoon,
      youtubeUrl,
      "audioUrl": select(
        ^.status == "upcoming" || comingSoon == true => null,
        audioFile.asset->url
      ),
      "previewUrl": select(
        ^.status == "upcoming" || comingSoon == true => null,
        previewFile.asset->url
      )
    }
  }
`;

export const NEXT_EVENT = `
  *[_type == "event" && date > now() && hidden != true] | order(date asc)[0] {
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

export const HOMEPAGE_SETTINGS = `
  *[_type == "homepageSettings"][0] {
    upcoming[] {
      itemType,
      show->{ title, "slug": slug.current, date, venue, flyer, ticketUrl, lineup[]{ name, "artistSlug": artist->slug.current } },
      release->{ title, "slug": slug.current, "artist": coalesce(artists[0]->name, displayArtist, artist->name), coverArt, presaveUrl, catalogNumber, status }
    }
  }
`;

export const ABOUT_STATS = `
  {
    "releases": count(*[_type == "release" && hidden != true]),
    "events": count(*[_type == "event" && hidden != true]),
    "artists": count(*[_type == "artist"])
  }
`;

export const EVENTS_LIST = `
  *[_type == "event" && hidden != true] | order(date desc) {
    title,
    "slug": slug.current,
    date,
    venue,
    flyer,
    ticketUrl,
    recapUrl,
    description,
    lineup[] {
      name,
      "artistSlug": artist->slug.current
    }
  }
`;
