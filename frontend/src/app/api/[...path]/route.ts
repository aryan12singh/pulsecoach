import type { NextRequest } from "next/server";

// Same-origin proxy: the browser calls /api/* on the frontend, and this route
// forwards to the FastAPI backend (BACKEND_URL, read at runtime). This means
// one frontend build works on localhost, LAN (phone), or a public host —
// no CORS, no per-environment rebuild for NEXT_PUBLIC_API_URL.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8010";

// Hop-by-hop headers must not be forwarded either direction.
const HOP_BY_HOP = [
  "connection", "keep-alive", "transfer-encoding", "upgrade",
  "proxy-authenticate", "proxy-authorization", "te", "trailer",
];

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const search = req.nextUrl.search;
  const dest = `${BACKEND_URL.replace(/\/$/, "")}/${path.join("/")}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  for (const h of HOP_BY_HOP) headers.delete(h);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(dest, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // Streams request bodies (large import uploads) instead of buffering.
    // @ts-expect-error duplex is required by undici for streaming bodies
    duplex: hasBody ? "half" : undefined,
    // Pass redirects (e.g. Strava OAuth) back to the browser untouched.
    redirect: "manual",
    cache: "no-store",
  });

  const respHeaders = new Headers(upstream.headers);
  for (const h of HOP_BY_HOP) respHeaders.delete(h);
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as HEAD,
};

export const dynamic = "force-dynamic";
