import type { SimpleIcon } from "simple-icons";
import { siSpotify, siApplemusic, siDeezer, siTidal, siSoundcloud, siAudiomack } from "simple-icons";
import { BrandIcon } from "@/components/BrandIcon";
import { ArrowIcon } from "@/components/icons";
import LayloModal from "./LayloModal";

export interface PresaveLinks {
  spotify?: string;
  appleMusic?: string;
  deezer?: string;
  amazonMusic?: string;
  tidal?: string;
  soundcloud?: string;
  audiomack?: string;
}

// Display order. `icon` is omitted where simple-icons has no mark (Amazon Music).
const SERVICES: { key: keyof PresaveLinks; label: string; action: string; icon?: SimpleIcon }[] = [
  { key: "spotify", label: "Spotify", action: "Pre-save", icon: siSpotify },
  { key: "appleMusic", label: "Apple Music", action: "Pre-add", icon: siApplemusic },
  { key: "soundcloud", label: "SoundCloud", action: "Pre-save", icon: siSoundcloud },
  { key: "amazonMusic", label: "Amazon Music", action: "Pre-save" },
  { key: "tidal", label: "Tidal", action: "Pre-save", icon: siTidal },
  { key: "deezer", label: "Deezer", action: "Pre-save", icon: siDeezer },
  { key: "audiomack", label: "Audiomack", action: "Pre-save", icon: siAudiomack },
];

// Only absolute web links count, so a malformed CMS value can never hide the single Pre-save URL fallback.
const usable = (url?: string) => !!url && /^https?:\/\//i.test(url);

export function hasPresaveLinks(links?: PresaveLinks | null): boolean {
  return SERVICES.some(({ key }) => usable(links?.[key]));
}

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

export default function PresaveList({
  links,
  releaseDate,
}: {
  links: PresaveLinks;
  releaseDate?: string;
}) {
  const services = SERVICES.filter(({ key }) => usable(links[key]));
  if (services.length === 0) return null;

  return (
    <section id="presave" className="mt-8 scroll-mt-28 container-organic p-5 sm:p-6">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-label mb-1">Pre-save</p>
          <h2 className="text-title text-text-primary">Pick your service</h2>
        </div>
        {releaseDate && (
          <p className="shrink-0 font-mono text-xs uppercase tracking-wider text-blue-300">
            Out{" "}
            {/* T12:00:00 keeps a date-only string on the same calendar day in every timezone. */}
            {new Date(releaseDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {services.map(({ key, label, action, icon }) => (
          <li key={key} className="min-w-0">
            <a
              href={links[key]}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-3 rounded-[var(--radius-organic-sm)] border border-white/[0.06] bg-bg-raised hover:border-blue-300/40 hover:bg-blue-300/5 transition-colors"
            >
              <span className="shrink-0 text-text-secondary group-hover:text-blue-300 transition-colors">
                {icon ? <BrandIcon icon={icon} size={20} /> : <NoteIcon />}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text-primary">{label}</span>
              <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
                {action}
                <ArrowIcon />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-white/[0.06] pt-4 text-xs text-text-secondary">
        <LayloModal />
      </div>
    </section>
  );
}
