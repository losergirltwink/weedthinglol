// Content-Security-Policy, built per request with a fresh nonce (proxy.ts).
//
// script-src: nonce + 'strict-dynamic' — only scripts Next stamps with this
//   request's nonce (and what they load) run; no 'unsafe-inline'. Dev adds
//   'unsafe-eval' (React's dev tooling needs it; production never does).
// style-src: 'unsafe-inline' (no nonce). React renders `style={…}` attributes
//   (graph/legend colors), which nonces can't cover, and browsers ignore
//   'unsafe-inline' whenever a nonce is present. Style injection is far lower
//   risk than script injection, which stays strictly locked down.

export function buildCsp(nonce: string, { dev }: { dev: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** 128 bits of randomness, base64. */
export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
