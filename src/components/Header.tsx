import Link from "next/link";
import MobileNav from "./MobileNav";

export default function Header() {
  return (
    <header className="fixed top-0 w-full z-50 px-4 pt-3">
      <nav className="container-organic-md max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between bg-bg-surface/90 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-text-primary group">
          <img src="/flower-white.png" alt="" className="w-7 h-7 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(124,185,232,0.5)]" />
          DAISY CHAIN
        </Link>
        <div className="hidden sm:flex gap-1 text-sm tracking-wide">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 transition-all"
          >
            Releases
          </Link>
          <Link
            href="/artists"
            className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 transition-all"
          >
            Artists
          </Link>
          <Link
            href="/shop"
            className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 transition-all"
          >
            Shop
          </Link>
          <Link
            href="/events"
            className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 transition-all"
          >
            Events
          </Link>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
