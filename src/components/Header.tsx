import Link from "next/link";
import MobileNav from "./MobileNav";
import AuthNavLink from "./AuthNavLink";
import CartButton from "./CartButton";

const navLinkClass =
  "px-3 py-1.5 rounded-lg text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50";

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-bg-deep pt-[max(0.5rem,env(safe-area-inset-top))]">
      <nav className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Daisy Chain Records home"
          className="flex items-center justify-center min-h-11 min-w-11 rounded-lg text-text-primary group shrink-0"
        >
          <img
            src="/flower-white.png"
            alt=""
            className="w-8 h-8 transition-[filter] logo-hover-glow"
          />
        </Link>
        <div className="hidden sm:flex items-center gap-1 text-sm tracking-wide">
          <Link href="/music" className={navLinkClass}>
            Music
          </Link>
          <Link href="/artists" className={navLinkClass}>
            Artists
          </Link>
          <Link href="/shop" className={navLinkClass}>
            Shop
          </Link>
          <Link href="/events" className={navLinkClass}>
            Events
          </Link>
          <AuthNavLink className={navLinkClass} />
          <CartButton />
        </div>
        <div className="flex items-center gap-2 sm:hidden">
          <CartButton />
          <MobileNav />
        </div>
      </nav>
    </header>
  );
}
