// Shared Open Graph card renderer (next/og). Pseudonymous: site name only.
import { ImageResponse } from "next/og";

import { SITE_NAME } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ title, subtitle, accent }: { title: string; subtitle: string; accent?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, color: "#a1a1aa", display: "flex" }}>🌿 {SITE_NAME}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {accent && <div style={{ width: 28, height: 28, borderRadius: 14, background: accent }} />}
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa" }}>{subtitle}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
