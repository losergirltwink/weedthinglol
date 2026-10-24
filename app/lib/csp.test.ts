import { describe, expect, it } from "vitest";

import { buildCsp, makeNonce } from "./csp";

describe("buildCsp", () => {
  it("locks scripts to the nonce with no inline/eval escape hatch in production", () => {
    const csp = buildCsp("abc", { dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    expect(buildCsp("abc", { dev: true })).toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it("never mixes a nonce into style-src (it would disable 'unsafe-inline')", () => {
    expect(buildCsp("abc", { dev: false })).toMatch(/style-src 'self' 'unsafe-inline'(;|$)/);
  });
});

it("makeNonce is random and base64", () => {
  const a = makeNonce();
  expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  expect(makeNonce()).not.toBe(a);
});
