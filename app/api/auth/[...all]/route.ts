import { getAuth } from "@/app/lib/auth";

// Better Auth's catch-all endpoint (/api/auth/*). Resolved per request so the
// lazily-created instance (and env validation) never runs at build time.
const handler = async (req: Request) => (await getAuth()).handler(req);

export { handler as GET, handler as POST };
