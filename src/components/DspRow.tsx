import type { SimpleIcon } from "simple-icons";
import {
  siSpotify,
  siApple,
  siSoundcloud,
  siYoutube,
} from "simple-icons";
import { IconSocialLink } from "@/components/BrandIcon";

interface DspLinks {
  spotify?: string;
  appleMusic?: string;
  bandcamp?: string;
  soundcloud?: string;
  youtube?: string;
}

interface DspRowProps {
  links?: DspLinks;
}

const DSP_ORDER: { key: keyof DspLinks; icon: SimpleIcon; label: string }[] = [
  { key: "spotify", icon: siSpotify, label: "Spotify" },
  { key: "appleMusic", icon: siApple, label: "Apple Music" },
  { key: "soundcloud", icon: siSoundcloud, label: "SoundCloud" },
  { key: "youtube", icon: siYoutube, label: "YouTube" },
];

export default function DspRow({ links }: DspRowProps) {
  if (!links) return null;
  const entries = DSP_ORDER.filter(({ key }) => !!links[key]);
  if (entries.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-4 items-center">
      {entries.map(({ key, icon, label }) => (
        <IconSocialLink
          key={key}
          href={links[key]!}
          label={label}
          icon={icon}
          className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full border border-white/10 text-text-secondary hover:text-blue-300 hover:border-blue-300/40 hover:bg-blue-300/5 transition-colors"
        />
      ))}
    </div>
  );
}
