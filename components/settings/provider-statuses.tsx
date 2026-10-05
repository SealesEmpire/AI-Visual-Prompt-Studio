"use client";

import { useEffect, useState } from "react";
import type { ProviderHealth } from "@/lib/providers/registry";

type DiagnosticTarget = "openai" | "runpod" | "storage" | "database";
type DiagnosticResult = { status: "PASS" | "FAIL" | "NOT CONFIGURED"; message: string };

export function ProviderStatuses() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [databaseConfigured, setDatabaseConfigured] = useState(false);
  const [assetStorageConfigured, setAssetStorageConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configuration, setConfiguration] = useState<Record<string, { state: string; missing: string[]; error?: string }> | null>(null);
  const [endpointId, setEndpointId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Partial<Record<DiagnosticTarget, DiagnosticResult>>>({});
  const [testing, setTesting] = useState<DiagnosticTarget | null>(null);

  useEffect(() => {
    void fetch("/api/providers", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { providers?: ProviderHealth[]; authConfigured?: boolean; databaseConfigured?: boolean; assetStorageConfigured?: boolean; configuration?: typeof configuration; runpodEndpointId?: string | null }) => {
        setProviders(result.providers ?? []);
        setAuthConfigured(result.authConfigured === true);
        setDatabaseConfigured(result.databaseConfigured === true);
        setAssetStorageConfigured(result.assetStorageConfigured === true);
        setConfiguration(result.configuration ?? null);
        setEndpointId(result.runpodEndpointId ?? null);
      })
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  async function testConnection(target: DiagnosticTarget) {
    setTesting(target);
    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const result = await response.json() as DiagnosticResult;
      setDiagnostics((current) => ({ ...current, [target]: result }));
    } catch {
      setDiagnostics((current) => ({ ...current, [target]: { status: "FAIL", message: "Diagnostic request failed." } }));
    } finally {
      setTesting(null);
    }
  }

  function configurationLine(key: string) {
    const status = configuration?.[key];
    if (!status) return "Configuration status unavailable.";
    return status.error ?? `${status.state}${status.missing.length ? ` · missing ${status.missing.join(", ")}` : ""}`;
  }

  return (
    <>
      {providers.map((provider) => (
        <article className="panel settings-row" key={provider.id}>
          <span className="settings-row-icon">✳</span>
          <div>
            <strong>{provider.displayName}</strong>
            <p>{provider.error ?? (provider.available === true ? "Connectivity verified." : "Connectivity is not verified.")}</p>
            <small>{provider.id === "runpod-wan" ? `Endpoint: ${endpointId ?? "not configured"} · ` : ""}Capabilities: {provider.capabilities ? Object.entries(provider.capabilities).filter(([, enabled]) => enabled === true).map(([name]) => name).join(", ") || "none reported" : "unknown"}{provider.checkedAt ? ` · Checked ${new Date(provider.checkedAt).toLocaleString()}` : ""}</small>
            <p>{configurationLine(provider.id === "openai" ? "openai" : "runpod")}</p>
            <Diagnostic target={provider.id === "openai" ? "openai" : "runpod"} value={diagnostics[provider.id === "openai" ? "openai" : "runpod"]} testing={testing} onTest={testConnection} />
          </div>
          <span className={`connection-state provider-${provider.status.toLowerCase().replaceAll(" ", "-")}`}>{provider.status}</span>
        </article>
      ))}
      <article className="panel settings-row">
        <span className="settings-row-icon">◉</span>
        <div><strong>Authentication</strong><p>{authConfigured ? "OAuth configured; private data still requires an active session." : "Configure NEXTAUTH_SECRET and Google or GitHub OAuth credentials."}</p></div>
        <span className="connection-state">{authConfigured ? "CONFIGURED" : "NOT CONFIGURED"}</span>
      </article>
      <article className="panel settings-row">
        <span className="settings-row-icon">▤</span>
        <div><strong>Project database</strong><p>{databaseConfigured ? "PostgreSQL is configured; access still requires OAuth." : "Configure DATABASE_URL for private project and job persistence."}</p><p>{configurationLine("database")}</p><Diagnostic target="database" value={diagnostics.database} testing={testing} onTest={testConnection} /></div>
        <span className="connection-state">{databaseConfigured ? "CONFIGURED" : "NOT CONFIGURED"}</span>
      </article>
      <article className="panel settings-row">
        <span className="settings-row-icon">⌁</span>
        <div><strong>Asset storage</strong><p>{assetStorageConfigured ? "Private S3-compatible storage is configured." : "Configure S3-compatible storage to persist generated assets."}</p><p>{configurationLine("objectStorage")}</p><Diagnostic target="storage" value={diagnostics.storage} testing={testing} onTest={testConnection} /></div>
        <span className="connection-state">{assetStorageConfigured ? "CONFIGURED" : "NOT CONFIGURED"}</span>
      </article>
      {loading && <p className="storage-footnote">Checking configured provider status…</p>}
      {!loading && providers.length === 0 && <p className="storage-footnote">Provider status is unavailable.</p>}
    </>
  );
}

function Diagnostic({ target, value, testing, onTest }: {
  target: DiagnosticTarget;
  value?: DiagnosticResult;
  testing: DiagnosticTarget | null;
  onTest: (target: DiagnosticTarget) => void;
}) {
  return (
    <div className="diagnostic-action">
      <button type="button" className="button-quiet" disabled={testing !== null} onClick={() => onTest(target)}>
        {testing === target ? "Testing…" : `Test ${target}`}
      </button>
      {value && <span className={`diagnostic-${value.status.toLowerCase()}`} role="status">{value.status}: {value.message}</span>}
    </div>
  );
}
