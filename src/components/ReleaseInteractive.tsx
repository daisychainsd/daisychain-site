"use client";

import { Fragment, useState, useEffect } from "react";
import LayloModal from "./LayloModal";
import { useRouter } from "next/navigation";
import FormatToggle from "./FormatToggle";
import TrackList from "./TrackList";
import { useCart } from "./CartProvider";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "@/lib/types";
import type { ShopifyProduct } from "@/lib/shopify";

interface ReleaseInteractiveProps {
  formats?: string[];
  price?: number;
  physicalPrice?: number;
  tracks: Track[];
  releaseArtist: string;
  releaseTitle: string;
  releaseId?: string;
  releaseSlug?: string;
  artistSlug?: string;
  primaryArtistName?: string;
  additionalArtists?: { name: string; slug: string }[];
  remixerSlug?: string;
  catalogNumber?: string;
  releaseType?: string;
  releaseDate?: string;
  coverUrl?: string;
  shopifyHandle?: string;
  status?: string;
  presaveUrl?: string;
  embedUrl?: string;
}

function isPhysical(format: string) {
  const f = format.toLowerCase();
  return f === "vinyl" || f === "cd" || f === "cassette";
}

export default function ReleaseInteractive({
  formats,
  price,
  physicalPrice,
  tracks,
  releaseArtist,
  releaseTitle,
  releaseId,
  releaseSlug,
  artistSlug,
  primaryArtistName,
  additionalArtists,
  remixerSlug,
  catalogNumber,
  releaseType,
  releaseDate,
  coverUrl,
  shopifyHandle,
  status,
  presaveUrl,
  embedUrl,
}: ReleaseInteractiveProps) {
  const isUpcoming = status === "upcoming";
  const router = useRouter();
  const { addItem } = useCart();

  const [activeFormat, setActiveFormat] = useState(
    formats?.[0] || "digital"
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shopifyProduct, setShopifyProduct] = useState<ShopifyProduct | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(
      (res: { data: { user: unknown } }) => {
        setIsLoggedIn(!!res.data.user);
      },
    );
  }, []);

  useEffect(() => {
    if (!shopifyHandle) return;
    fetch(`/api/shopify-product?handle=${shopifyHandle}`)
      .then((r) => r.json())
      .then((data) => { if (data.product) setShopifyProduct(data.product); })
      .catch(() => {});
  }, [shopifyHandle]);

  const [buying, setBuying] = useState(false);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [activeFormat]);

  const physical = isPhysical(activeFormat);
  const activePrice = physical ? physicalPrice : price;
  const hasToggle = formats && formats.length > 1;
  const displayTitle = releaseType && ["ep", "album"].includes(releaseType)
    ? releaseTitle.replace(/\s+(EP|Album)$/i, "")
    : releaseTitle;

  async function handleBuy() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/releases/${releaseSlug}`);
      return;
    }

    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId,
          title: releaseTitle,
          artist: releaseArtist,
          price: activePrice,
          slug: releaseSlug,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBuying(false);
    }
  }

  function handleAddPhysicalToCart() {
    if (!shopifyProduct) return;
    const variant = shopifyProduct.variants.edges[0]?.node;
    if (!variant) return;
    const image = shopifyProduct.images.edges[0]?.node;
    addItem({
      variantId: variant.id,
      productId: shopifyProduct.id,
      handle: shopifyProduct.handle,
      title: shopifyProduct.title,
      variantTitle: variant.title,
      price: parseFloat(variant.price.amount),
      currency: variant.price.currencyCode,
      imageUrl: image?.url || coverUrl || "",
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  return (
    <div>
      {/* Cover + Metadata in one organic container */}
      <div className="container-organic p-3 sm:p-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Cover Art / Product Photos */}
          <div className="container-inset aspect-square relative overflow-hidden">
            {physical && shopifyProduct && shopifyProduct.images.edges.length > 0 ? (
              <>
                <img
                  key={selectedImageIndex}
                  src={shopifyProduct.images.edges[selectedImageIndex]?.node.url}
                  alt={`${shopifyProduct.title} — photo ${selectedImageIndex + 1}`}
                  className="w-full h-full object-cover animate-fade-in"
                />
                {shopifyProduct.images.edges.length > 1 && (
                  <>
                    {selectedImageIndex > 0 && (
                      <button
                        onClick={() => setSelectedImageIndex((prev) => prev - 1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white flex items-center justify-center transition-colors"
                        aria-label="Previous photo"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    )}
                    {selectedImageIndex < shopifyProduct.images.edges.length - 1 && (
                      <button
                        onClick={() => setSelectedImageIndex((prev) => prev + 1)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white flex items-center justify-center transition-colors"
                        aria-label="Next photo"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {shopifyProduct.images.edges.map((_, i) => (
                        <span
                          key={i}
                          className={`block w-1.5 h-1.5 rounded-full transition-colors ${
                            i === selectedImageIndex ? "bg-white" : "bg-white/40"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : coverUrl ? (
              <img
                src={coverUrl}
                alt={releaseTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl bg-bg-raised">
                {catalogNumber}
              </div>
            )}
            {isUpcoming && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-950/50">
                {presaveUrl ? (
                  <a
                    href={presaveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-blue-300 text-bg-deep px-6 py-2.5 text-sm font-semibold hover:bg-blue-200 transition-colors flex items-center gap-2"
                  >
                    Pre-save
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
                    </svg>
                  </a>
                ) : (
                  <span className="rounded-full bg-blue-300/10 border border-blue-300/30 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-blue-300">
                    Coming Soon
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between p-4 sm:p-6">
            <div>
            <p className="text-label mb-3 flex items-center gap-3">
              {catalogNumber}
              {releaseType && (
                <span className="text-blue-300/70">{releaseType}</span>
              )}
              {isUpcoming && (
                <span className="inline-block rounded-full bg-blue-300/10 border border-blue-300/20 px-2.5 py-0.5 text-[11px] text-blue-300 uppercase tracking-wider">
                  Coming Soon
                </span>
              )}
            </p>
            <h1 className="text-headline mb-2">{displayTitle}</h1>
            <div className="text-xl mb-4 flex flex-wrap items-baseline gap-x-1">
              {releaseType === "remix" && remixerSlug ? (
                <>
                  <a
                    href={`/artists/${remixerSlug}`}
                    className="text-blue-300 hover:underline"
                  >
                    {releaseArtist}
                  </a>
                  {artistSlug && primaryArtistName && (
                    <>
                      <span className="text-text-muted">,</span>
                      <a
                        href={`/artists/${artistSlug}`}
                        className="text-blue-300 hover:underline"
                      >
                        {primaryArtistName}
                      </a>
                    </>
                  )}
                </>
              ) : artistSlug ? (
                <a
                  href={`/artists/${artistSlug}`}
                  className="text-blue-300 hover:underline"
                >
                  {releaseArtist}
                </a>
              ) : (
                <span className="text-blue-300">{releaseArtist}</span>
              )}
              {additionalArtists?.map((a) => (
                <Fragment key={a.slug}>
                  <span className="text-text-muted">,</span>
                  <a
                    href={`/artists/${a.slug}`}
                    className="text-blue-300 hover:underline"
                  >
                    {a.name}
                  </a>
                </Fragment>
              ))}
            </div>

            </div>

            <p className={`text-blue-300/60 text-xs tracking-wide transition-opacity ease-in-out ${
              physical && shopifyHandle ? "opacity-100" : "opacity-0 invisible"
            }`}>
              All physical purchases include downloadable digital files
            </p>

            <div className="pt-6 border-t border-blue-300/10 space-y-5">
              {hasToggle && (
                <FormatToggle
                  formats={formats}
                  activeFormat={activeFormat}
                  onFormatChange={setActiveFormat}
                />
              )}

              {releaseDate && (
                <p className="text-text-muted text-sm">
                  Released{" "}
                  {new Date(releaseDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pre-save (upcoming) or Buy (live) */}
      {isUpcoming ? (
        <div className="mt-8 flex items-center justify-between">
          <div>
            <p className="text-label mb-1">Tracks</p>
            <h2 className="text-title text-text-primary">Tracklist</h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            {presaveUrl ? (
              <a
                href={presaveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-full bg-blue-300 text-bg-deep text-sm font-semibold hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-[background-color,box-shadow]"
              >
                Pre-save
              </a>
            ) : (
              <p className="text-text-muted text-sm uppercase tracking-wider">Coming Soon</p>
            )}
            <LayloModal />
          </div>
        </div>
      ) : physical && !physicalPrice && !shopifyProduct ? (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-label mb-1">Tracks</p>
          <p className="text-text-muted text-sm uppercase tracking-wider">Coming Soon</p>
        </div>
      ) : physical && shopifyProduct ? (
        <div className="mt-8 flex items-center justify-between">
          <div>
            <p className="text-label mb-1">Tracks</p>
            <h2 className="text-title text-text-primary">Tracklist</h2>
          </div>
          <button
            onClick={handleAddPhysicalToCart}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              addedToCart
                ? "bg-green-500/20 text-green-400 border border-green-400/30"
                : "bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)]"
            }`}
          >
            {addedToCart ? "Added to Cart" : `Buy ${activeFormat.charAt(0).toUpperCase() + activeFormat.slice(1)} — $${parseFloat(shopifyProduct.variants.edges[0]?.node.price.amount || "0").toFixed(2)}`}
          </button>
        </div>
      ) : activePrice && activePrice > 0 ? (
        <div className="mt-8 flex items-center justify-between">
          <div>
            <p className="text-label mb-1">Tracks</p>
            <h2 className="text-title text-text-primary">Tracklist</h2>
          </div>
          <button
            onClick={handleBuy}
            disabled={buying}
            className="px-5 py-2.5 rounded-full bg-blue-300 text-bg-deep text-sm font-semibold hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
          >
            {buying ? "Redirecting..." : `Buy ${activeFormat.charAt(0).toUpperCase() + activeFormat.slice(1)} — $${activePrice.toFixed(2)}`}
          </button>
        </div>
      ) : (
        <div className="mt-8 mb-4">
          <p className="text-label mb-1">Tracks</p>
          <h2 className="text-title text-text-primary">Tracklist</h2>
        </div>
      )}

      {/* Track List */}
      {tracks.length > 0 && (
        <section className="mt-4">
          <TrackList tracks={tracks} releaseArtist={releaseArtist} />
        </section>
      )}

      {/* Embedded Player fallback */}
      {embedUrl && (
        <section className="mt-12">
          <iframe
            src={embedUrl}
            className="w-full h-[120px] rounded-sm"
            allow="autoplay"
            title={`Listen to ${releaseTitle}`}
          />
        </section>
      )}
    </div>
  );
}
