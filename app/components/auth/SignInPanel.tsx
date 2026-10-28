"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/app/lib/auth-client";

const button =
  "w-full rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function SignInPanel({ githubEnabled, error }: { githubEnabled: boolean; error?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error ? "Sign-in failed or isn't allowed for this account." : "");

  async function withPasskey() {
    setBusy(true);
    setMessage("");
    const res = await authClient.signIn.passkey();
    setBusy(false);
    if (res?.error) setMessage(res.error.message ?? "Passkey sign-in failed.");
    else router.push("/journal");
  }

  async function withGitHub() {
    setBusy(true);
    setMessage("");
    // Full-page redirect to GitHub; errors come back as ?error= on this page.
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/journal",
      errorCallbackURL: "/sign-in",
    });
  }

  return (
    <div className="max-w-sm space-y-3">
      <p className="text-sm text-zinc-400">
        This is a personal site with a single owner. Visitors can browse everything without
        signing in.
      </p>
      <button onClick={withPasskey} disabled={busy} className={`${button} bg-zinc-100 text-zinc-900 hover:bg-white`}>
        Sign in with a passkey
      </button>
      <button
        onClick={withGitHub}
        disabled={busy || !githubEnabled}
        className={`${button} bg-zinc-800 text-zinc-100 hover:bg-zinc-700`}
        title={githubEnabled ? undefined : "GitHub sign-in isn't configured (see .env.example)"}
      >
        Sign in with GitHub
      </button>
      {message && (
        <p role="alert" className="text-sm text-amber-400">
          {message}
        </p>
      )}
    </div>
  );
}
