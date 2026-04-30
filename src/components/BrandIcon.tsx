import type { SimpleIcon } from "simple-icons";

export function BrandIcon({
  icon,
  size = 20,
  className,
}: {
  icon: SimpleIcon;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <path fill="currentColor" d={icon.path} />
    </svg>
  );
}

/** Circular icon-only outbound link; accessible via aria-label + title. */
export function IconSocialLink({
  href,
  label,
  icon,
  className,
}: {
  href: string;
  label: string;
  icon: SimpleIcon;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={
        className ??
        "inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full border border-white/10 text-text-secondary hover:text-blue-300 hover:border-blue-300/40 hover:bg-blue-300/5 transition-colors"
      }
    >
      <BrandIcon icon={icon} size={20} />
    </a>
  );
}
