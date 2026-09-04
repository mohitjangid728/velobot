import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Accessible without a session. /onboarding is intentionally excluded — it
// requires auth (POST /api/orgs checks for a user), so an unauthenticated
// visitor should be sent to /login first, not shown the empty form.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/pricing",
  "/legal",
  // Next.js metadata route conventions (favicon.ico/icon.svg are already
  // excluded by the matcher below since they have file extensions, but
  // opengraph-image/twitter-image don't — social-media crawlers fetching
  // them never carry a session, so without this they'd get redirected to
  // /login instead of the image).
  "/opengraph-image",
  "/twitter-image",
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/") || // API routes do their own auth checks
    pathname === "/";

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes except static assets and Next internals. API routes
     * are matched too (so the session cookie stays fresh) but are exempted
     * from the auth redirect above.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
