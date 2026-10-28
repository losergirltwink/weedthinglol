import { buildOverlay } from "@/app/lib/overlay";
import { getViewer } from "@/app/lib/owner";
import { getDb } from "@/db";

// Per-viewer (owner sees private sessions), so never shared-cached.
export async function GET() {
  const { isOwner } = await getViewer();
  const overlay = await buildOverlay(await getDb(), { includePrivate: isOwner });
  return Response.json(overlay, { headers: { "Cache-Control": "private, no-store" } });
}
