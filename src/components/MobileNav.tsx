"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "Releases" },
  { href: "/artists", label: "Artists" },
  { href: "/shop", label: "Shop" },
  { href: "/events", label: "Events" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoggedIn(false);
      return;
    }
    supabase.auth.getUser().then(
      (res: { data: { user: unknown } }) => {
        setIsLoggedIn(!!res.data.user);
      },
    );
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="sm:hidden w-10 h-10 flex items-center justify-center text-text-secondary hover:text-blue-300 transition-colors"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 top-[60px] z-40 bg-bg-deep/95 backdrop-blur-xl sm:hidden"
          onClick={() => setOpen(false)}
        >
          <nav className="flex flex-col p-6 gap-2" onClick={(e) => e.stopPropagation()}>
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="block px-4 py-4 text-lg font-medium text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 rounded-lg transition-colors"
              >
                {label}
              </Link>
            ))}
            {isLoggedIn !== null && (
              <Link
                href={isLoggedIn ? "/account" : "/login"}
                className="block px-4 py-4 text-lg font-medium text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 rounded-lg transition-colors"
              >
                {isLoggedIn ? "Account" : "Login"}
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
