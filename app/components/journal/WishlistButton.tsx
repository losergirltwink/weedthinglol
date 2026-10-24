"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setWishlistedAction } from "@/app/lib/journal/actions";

export function WishlistButton({ strainKey, wishlisted }: { strainKey: string; wishlisted: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={wishlisted}
      onClick={() =>
        startTransition(async () => {
          await setWishlistedAction(strainKey, !wishlisted);
          router.refresh();
        })
      }
      className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
    >
      {wishlisted ? "★ On want-to-try list" : "☆ Want to try"}
    </button>
  );
}
