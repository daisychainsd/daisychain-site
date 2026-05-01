export interface Track {
  title: string;
  trackArtist?: string;
  trackArtists?: { name: string; slug: string; rosterTier?: string }[];
  duration?: string;
  trackNumber?: number;
  audioUrl?: string;
  previewUrl?: string;
  youtubeUrl?: string;
  comingSoon?: boolean;
}

export interface Release {
  title: string;
  slug: string;
  artist: string;
  displayArtist?: string;
  artistSlug?: string;
  primaryArtistName?: string;
  artists?: { name: string; slug: string; rosterTier?: string }[];
  additionalArtists?: { name: string; slug: string }[];
  remixerSlug?: string;
  coverArt?: any;
  catalogNumber?: string;
  releaseType?: string;
  format?: string[];
  releaseDate?: string;
  _id?: string;
  price?: number;
  physicalPrice?: number;
  shopifyHandle?: string;
  status?: string;
  presaveUrl?: string;
  embedUrl?: string;
  links?: {
    spotify?: string;
    appleMusic?: string;
    bandcamp?: string;
    soundcloud?: string;
    youtube?: string;
  };
  description?: any;
  tracks?: Track[];
}

export interface ReleaseCard {
  title: string;
  slug: string;
  artist: string;
  coverArt?: any;
  catalogNumber?: string;
  format?: string[];
  releaseDate?: string;
  status?: string;
}

export interface Artist {
  name: string;
  slug: string;
  photo?: any;
  bio?: string;
  role?: string;
  hometown?: string;
  links?: {
    website?: string;
    instagram?: string;
    spotify?: string;
    youtube?: string;
    soundcloud?: string;
  };
  releases?: ReleaseCard[];
}

export interface EventLineup {
  name: string;
  artistSlug?: string;
}

export interface Event {
  title: string;
  slug: string;
  date: string;
  venue?: string;
  flyer?: any;
  /** 0–100: object-position Y for square (and strip) flyer framing; omit → site default. */
  flyerVerticalAlign?: number;
  ticketUrl?: string;
  recapUrl?: string;
  description?: any;
  lineup?: EventLineup[];
}
