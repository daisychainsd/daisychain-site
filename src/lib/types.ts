export interface Track {
  title: string;
  trackArtist?: string;
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
  links?: {
    website?: string;
    instagram?: string;
    bandcamp?: string;
    soundcloud?: string;
  };
  releases?: ReleaseCard[];
  releaseCount?: number;
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
  ticketUrl?: string;
  description?: any;
  lineup?: EventLineup[];
}
