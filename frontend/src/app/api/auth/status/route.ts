import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.json({ enabled: false, authenticated: true });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return NextResponse.json({
    enabled: true,
    authenticated: await verifySessionToken(token, password),
  });
}
