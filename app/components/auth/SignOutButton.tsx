"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/app/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/journal");
        router.refresh();
      }}
      className="text-zinc-400 hover:text-zinc-100"
    >
      Sign out
    </button>
  );
}
