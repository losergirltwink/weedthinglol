"use client";

import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/app/lib/auth-client";

interface Passkey {
  id: string;
  name?: string | null;
  createdAt?: Date | string | null;
  deviceType: string;
  backedUp: boolean;
}

/** Owner-only: register, list, and remove passkeys for the signed-in account. */
export function PasskeyManager() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const res = await authClient.passkey.listUserPasskeys();
    if (res.error) setMessage(res.error.message ?? "Couldn't load passkeys.");
    else setKeys(res.data as Passkey[]);
  }, []);

  useEffect(() => {
    // Initial load from the server; the setState happens after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function add() {
    setMessage("");
    const res = await authClient.passkey.addPasskey({ name: name.trim() || undefined });
    if (res?.error) setMessage(res.error.message ?? "Couldn't add passkey.");
    else {
      setName("");
      await refresh();
    }
  }

  async function remove(id: string) {
    setMessage("");
    const res = await authClient.passkey.deletePasskey({ id });
    if (res.error) setMessage(res.error.message ?? "Couldn't remove passkey.");
    await refresh();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Passkeys</h2>
      <p className="text-sm text-zinc-400">
        Passkeys are the primary sign-in; GitHub is the recovery path. Register one per device.
      </p>
      {keys === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-zinc-500">No passkeys yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg bg-zinc-900">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>
                {k.name || "Unnamed passkey"}
                <span className="ml-2 text-xs text-zinc-500">
                  {k.deviceType === "multiDevice" ? "synced" : "this device"}
                  {k.createdAt ? ` · added ${new Date(k.createdAt).toLocaleDateString()}` : ""}
                </span>
              </span>
              <button onClick={() => remove(k.id)} className="text-xs text-zinc-500 hover:text-red-400">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Laptop)"
          maxLength={64}
          className="flex-1 rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button onClick={add} className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
          Add passkey
        </button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-amber-400">
          {message}
        </p>
      )}
    </section>
  );
}
