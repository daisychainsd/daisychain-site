"use client";

interface FormatToggleProps {
  formats: string[];
  activeFormat: string;
  onFormatChange?: (format: string) => void;
  size?: "compact" | "default";
  interactive?: boolean;
}

function positionClass(index: number, total: number) {
  if (index === 0) return "toggle-first";
  if (index === total - 1) return "toggle-last";
  return "toggle-middle";
}

function formatLabel(format: string) {
  if (format.toLowerCase() === "digital") return "Digital";
  if (format.toLowerCase() === "vinyl") return "Physical";
  if (format.toLowerCase() === "cassette") return "Physical";
  return format;
}

export default function FormatToggle({
  formats,
  activeFormat,
  onFormatChange,
  size = "default",
  interactive = true,
}: FormatToggleProps) {
  if (!formats || formats.length <= 1) return null;

  const padding = size === "compact" ? "px-3 py-0.5" : "px-5 py-1.5";
  const textSize = size === "compact" ? "text-[10px]" : "text-xs";

  const Tag = interactive ? "button" : "span";

  return (
    <div className="container-toggle">
      {formats.map((format, i) => (
        <Tag
          key={format}
          className={`container-toggle-option ${padding} ${textSize} ${
            positionClass(i, formats.length)
          } ${activeFormat === format ? "toggle-active" : ""}`}
          {...(interactive && onFormatChange
            ? { onClick: () => onFormatChange(format), type: "button" as const }
            : {})}
        >
          {formatLabel(format)}
        </Tag>
      ))}
    </div>
  );
}
