"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthNavLink({ className }: { className?: string }) {
  const [user, setUser] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setUser(false);
      return;
    }
    supabase.auth.getUser().then(
      (res: { data: { user: unknown } }) => {
        setUser(!!res.data.user);
      },
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: unknown } | null) => {
        setUser(!!session?.user);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  if (user === null) return null;

  return (
    <Link href={user ? "/account" : "/login"} className={className}>
      {user ? "Account" : "Login"}
    </Link>
  );
}
