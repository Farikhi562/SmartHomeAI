import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge auth gate (FR-012). Cookie PRESENCE only — signature verification
 * happens in `requireUser()` inside every route (the edge runtime has no
 * access to the HS256 secret plumbing used by the API layer). This layer
 * exists to keep unauthenticated browsers off protected pages and to short
 * circuit anonymous API calls before they reach a handler.
 */

// Mirrors SESSION_COOKIE in src/lib/auth/index.ts (edge bundle cannot import
// that module — it pulls in jose and the Prisma-backed user check).
const SESSION_COOKIE = "shai_session";

const PUBLIC_API_PREFIXES = ["/api/health", "/api/auth"];

const PROTECTED_PAGES = [
  "/dashboard",
  "/inventory",
  "/labels",
  "/locations",
  "/assistant",
  "/search",
  "/activity",
  "/settings",
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api")) {
    if (isPublicApi(pathname) || hasSession) return NextResponse.next();
    // Same envelope as the API layer (API_SPEC §2).
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 401, headers: { "x-request-id": crypto.randomUUID() } },
    );
  }

  if (isProtectedPage(pathname) && !hasSession) {
    const login = new URL("/login", req.url);
    const next = `${pathname}${req.nextUrl.search}`;
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/labels/:path*",
    "/locations/:path*",
    "/assistant/:path*",
    "/search/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
