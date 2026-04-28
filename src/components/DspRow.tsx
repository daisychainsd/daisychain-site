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

const LABELS: { key: keyof DspLinks; label: string }[] = [
  { key: "spotify", label: "Spotify" },
  { key: "appleMusic", label: "Apple Music" },
  { key: "bandcamp", label: "Bandcamp" },
  { key: "soundcloud", label: "SoundCloud" },
  { key: "youtube", label: "YouTube" },
];

export default function DspRow({ links }: DspRowProps) {
  if (!links) return null;
  const entries = LABELS.filter(({ key }) => !!links[key]);
  if (entries.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-4">
      {entries.map(({ key, label }) => (
        <a
          key={key}
          href={links[key]!}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-blue-300"
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--color-text-secondary)",
            fontSize: 13,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "rgba(124,185,232,0.3)";
            e.currentTarget.style.background = "rgba(124,185,232,0.05)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          {label}
        </a>
      ))}
    </div>
  );
}
