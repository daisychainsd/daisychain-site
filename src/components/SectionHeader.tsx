import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowIcon } from "@/components/icons";

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  size?: "default" | "xl";
  right?: ReactNode;
  seeAllHref?: string;
  seeAllLabel?: string;
  as?: "h1" | "h2" | "h3";
}

export default function SectionHeader({
  kicker,
  title,
  size = "default",
  right,
  seeAllHref,
  seeAllLabel,
  as: TitleTag = "h2",
}: SectionHeaderProps) {
  const titleFontSize =
    size === "xl"
      ? "clamp(3rem, 8vw, 7rem)"
      : "clamp(2.25rem, 4.5vw, 4.5rem)";

  return (
    <div className="flex justify-between items-end gap-6 mb-9 flex-wrap">
      <div className="min-w-0">
        {kicker && (
          <div
            className="text-blue-300 uppercase mb-2.5"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: "0.12em",
            }}
          >
            — {kicker}
          </div>
        )}
        <TitleTag
          className="uppercase text-text-primary m-0"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 0.92,
            fontSize: titleFontSize,
          }}
        >
          {title}
        </TitleTag>
      </div>
      {(right || seeAllHref) && (
        <div className="flex items-center gap-3">
          {right}
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="text-blue-300 hover:text-blue-200 transition-colors inline-flex items-center gap-1.5 uppercase"
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.06em",
              }}
            >
              {seeAllLabel || "See all"}
              <ArrowIcon />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
