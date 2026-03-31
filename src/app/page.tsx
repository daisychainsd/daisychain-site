import { client, sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { RELEASES_LIST, LATEST_RELEASE, NEXT_EVENT } from "@/lib/queries";
import { getProducts } from "@/lib/shopify";
import type { ReleaseCard as ReleaseCardType } from "@/lib/types";
import CatalogGrid from "@/components/CatalogGrid";
import HeroSlideshow from "@/components/HeroSlideshow";
import NewsletterSignup from "@/components/NewsletterSignup";

interface HeroRelease {
  title: string;
  slug: string;
  artist: string;
  coverArt?: any;
  releaseType?: string;
}

interface HeroEvent {
  title: string;
  slug: string;
  date: string;
  venue?: string;
  flyer?: any;
  ticketUrl?: string;
}

async function getShopHeroImage(): Promise<string> {
  try {
    const products = await getProducts();
    const img = products[0]?.images.edges[0]?.node.url;
    return img || "";
  } catch {
    return "";
  }
}

export default async function HomePage() {
  const [releases, latestRelease, nextEvent, shopImageUrl] = await Promise.all([
    sanityFetch<ReleaseCardType>(RELEASES_LIST),
    client?.fetch<HeroRelease | null>(LATEST_RELEASE) ?? null,
    client?.fetch<HeroEvent | null>(NEXT_EVENT) ?? null,
    getShopHeroImage(),
  ]);

  const catalogReleases = releases.map((release) => ({
    title: release.title,
    slug: release.slug,
    artist: release.artist,
    coverUrl: release.coverArt ? urlFor(release.coverArt).width(600).url() : "",
    catalogNumber: release.catalogNumber,
    format: release.format,
  }));

  const heroRelease = latestRelease
    ? {
        title: latestRelease.title,
        slug: latestRelease.slug,
        artist: latestRelease.artist,
        coverUrl: latestRelease.coverArt
          ? urlFor(latestRelease.coverArt).width(1200).url()
          : "",
        releaseType: latestRelease.releaseType,
      }
    : undefined;

  const heroEvent = nextEvent
    ? {
        title: nextEvent.title,
        slug: nextEvent.slug,
        date: nextEvent.date,
        venue: nextEvent.venue,
        flyerUrl: nextEvent.flyer
          ? urlFor(nextEvent.flyer).width(1200).url()
          : "",
        ticketUrl: nextEvent.ticketUrl,
      }
    : undefined;

  return (
    <>
      <HeroSlideshow
        latestRelease={heroRelease}
        nextEvent={heroEvent}
        shopImageUrl={shopImageUrl}
      />

      <div className="divider-glow" />

      <NewsletterSignup />

      <section className="zone-deep relative py-16 sm:py-20">
        <div className="blob w-[400px] h-[400px] bg-blue-300 bottom-[-50px] left-[-100px] animate-drift" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <CatalogGrid releases={catalogReleases} />
        </div>
      </section>
    </>
  );
}
