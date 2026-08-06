import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  // Protect /ops + /api/ops — HTTP basic auth (any username, OPS_PASSWORD as
  // password). Fail closed: 404 when OPS_PASSWORD is unset. Checked before the
  // Supabase early-return so the gate holds even without Supabase env vars.
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/ops") || pathname.startsWith("/api/ops")) {
    const opsPassword = process.env.OPS_PASSWORD;
    if (!opsPassword) {
      return new NextResponse("Not found", { status: 404 });
    }
    let providedPassword = "";
    const auth = request.headers.get("authorization") ?? "";
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      try {
        providedPassword = atob(encoded).split(":").slice(1).join(":");
      } catch {
        // malformed base64 → treated as wrong password
      }
    }
    if (providedPassword !== opsPassword) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Daisy Chain Ops"' },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  // Protect /studio — HTTP basic auth gate. Runs BEFORE the Supabase early
  // return below (and fails closed like /ops): a deploy missing either the
  // Supabase env vars or STUDIO_PASSWORD used to serve the admin surface to
  // the internet.
  if (pathname.startsWith("/studio")) {
    const studioPassword = process.env.STUDIO_PASSWORD;
    if (!studioPassword) {
      return new NextResponse("Not found", { status: 404 });
    }
    const auth = request.headers.get("authorization");
    const expected = "Basic " + btoa("admin:" + studioPassword);
    if (auth !== expected) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Daisy Chain Studio"' },
      });
    }
  }

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();


  // Protect /account — redirect to /login if not authenticated
  if (!user && request.nextUrl.pathname.startsWith("/account")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from /login and /signup
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // `api(?!/ops)` — API routes bypass the proxy EXCEPT /api/ops/*, which
    // must pass the basic-auth gate above.
    "/((?!_next/static|_next/image|favicon.ico|api(?!/ops)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
