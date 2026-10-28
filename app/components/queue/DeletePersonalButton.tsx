"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePersonalStrainAction } from "@/app/lib/personal/actions";

export function DeletePersonalButton({ strainKey }: { strainKey: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await deletePersonalStrainAction(strainKey);
            if (!res.ok) setError(res.errors.form ?? "Couldn't delete");
            else router.refresh();
          })
        }
        className="text-zinc-400 hover:text-red-400 disabled:opacity-50"
      >
        Delete personal copy
      </button>
      {error && <span className="ml-2 text-amber-400">{error}</span>}
    </span>
  );
}
