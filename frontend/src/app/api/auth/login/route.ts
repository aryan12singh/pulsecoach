import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  passwordsMatch,
} from "@/lib/auth";

// Small in-memory brute-force brake (single-instance app).
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isLimited(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { detail: "Login is disabled — no APP_PASSWORD configured" },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  if (isLimited(ip)) {
    return NextResponse.json(
      { detail: "Too many attempts — try again in a few minutes" },
      { status: 429 },
    );
  }

  let supplied = "";
  try {
    const body = (await req.json()) as { password?: string };
    supplied = body.password ?? "";
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  if (!(await passwordsMatch(supplied, password))) {
    recordFailure(ip);
    return NextResponse.json({ detail: "Wrong password" }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await createSessionToken(password);
  const secure =
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return res;
}
