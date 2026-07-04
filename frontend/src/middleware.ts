import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Auth is opt-in: with no APP_PASSWORD set (local use), everything passes
// through. With one set, every page and every /api call requires the session
// cookie — the backend itself is only reachable through this proxy.

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/logout", "/api/auth/status"]);
// Device push endpoints authenticate with WEBHOOK_SECRET instead of a cookie.
// Exact matches only — /api/ingest/apple-health/import stays protected.
const WEBHOOK_PATHS = new Set(["/api/ingest/apple-health", "/api/ingest/hevy/webhook"]);

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API.has(pathname) || WEBHOOK_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, password)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip static assets and PWA files (iOS fetches the manifest/icons outside
  // the authenticated session).
  matcher: ["/((?!_next/|icons/|manifest\\.webmanifest|favicon\\.ico).*)"],
};
