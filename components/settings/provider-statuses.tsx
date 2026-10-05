"use client";

import { useEffect, useState } from "react";
import type { ProviderHealth } from "@/lib/providers/registry";

export function ProviderStatuses() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/providers", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { providers?: ProviderHealth[]; authConfigured?: boolean }) => {
        setProviders(result.providers ?? []);
        setAuthConfigured(result.authConfigured === true);
      })
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {providers.map((provider) => (
        <article className="panel settings-row" key={provider.id}>
          <span className="settings-row-icon">✳</span>
          <div><strong>{provider.displayName}</strong><p>{provider.error ?? (provider.available === true ? "Provider health check succeeded." : "Provider capability or connectivity is not verified.")}</p></div>
          <span className={`connection-state provider-${provider.status.toLowerCase().replaceAll(" ", "-")}`}>{provider.status}</span>
        </article>
      ))}
      <article className="panel settings-row">
        <span className="settings-row-icon">◉</span>
        <div><strong>Authentication</strong><p>{authConfigured ? "OAuth configured; private data still requires an active session." : "Configure NEXTAUTH_SECRET and Google or GitHub OAuth credentials."}</p></div>
        <span className="connection-state">{authConfigured ? "CONFIGURED" : "NOT CONFIGURED"}</span>
      </article>
      {loading && <p className="storage-footnote">Checking configured provider status…</p>}
      {!loading && providers.length === 0 && <p className="storage-footnote">Provider status is unavailable.</p>}
    </>
  );
}
