// Per-request CSP nonce (Next 16 "proxy", formerly middleware). Next reads the
// request's Content-Security-Policy header during SSR and stamps the nonce onto
// its own scripts. This is NOT an auth boundary — see app/lib/owner.ts.

import { NextResponse, type NextRequest } from "next/server";

import { buildCsp, makeNonce } from "@/app/lib/csp";

export function proxy(request: NextRequest) {
  const nonce = makeNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, static assets, baked graph JSON, and
      // generated metadata files.
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|graph\\.|sitemap.xml|robots.txt|.*opengraph-image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
