"use client";

import { useEffect, useState } from "react";

type BasketProvider = "s3_compatible" | "cloudflare_r2" | "digitalocean_spaces" | "backblaze_b2";

export function MyBasketSettings() {
  const [provider, setProvider] = useState<BasketProvider>("s3_compatible");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/storage/my-basket", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { configured?: boolean; connection?: { provider: BasketProvider; endpoint: string; region: string; bucket: string } };
        if (!response.ok) return;
        setConnected(result.configured === true);
        if (result.connection) {
          setProvider(result.connection.provider);
          setEndpoint(result.connection.endpoint);
          setRegion(result.connection.region);
          setBucket(result.connection.bucket);
        }
      })
      .catch(() => undefined);
  }, []);

  async function saveConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/storage/my-basket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, endpoint, region, bucket, accessKeyId, secretAccessKey }),
      });
      const result = await response.json() as { status?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "MY_BASKET_CONNECTION_FAILED");
      setConnected(true);
      setMessage(result.message ?? "Connection verified.");
      setAccessKeyId("");
      setSecretAccessKey("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MY_BASKET_CONNECTION_FAILED");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel basket-settings" onSubmit={saveConnection}>
      <div><strong>My Basket · {connected ? "CONNECTED" : "NOT CONNECTED"}</strong><p>Connect a user-owned S3-compatible bucket. Credentials are tested server-side and encrypted before persistence.</p></div>
      <label className="form-label" htmlFor="basket-provider">PROVIDER</label>
      <select id="basket-provider" className="text-input" value={provider} onChange={(event) => setProvider(event.target.value as BasketProvider)}>
        <option value="s3_compatible">S3 / S3-compatible</option>
        <option value="cloudflare_r2">Cloudflare R2</option>
        <option value="digitalocean_spaces">DigitalOcean Spaces</option>
        <option value="backblaze_b2">Backblaze B2</option>
      </select>
      <label className="form-label" htmlFor="basket-endpoint">HTTPS ENDPOINT</label>
      <input id="basket-endpoint" className="text-input" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} required placeholder="https://account.r2.cloudflarestorage.com" />
      <label className="form-label" htmlFor="basket-region">REGION</label>
      <input id="basket-region" className="text-input" value={region} onChange={(event) => setRegion(event.target.value)} required />
      <label className="form-label" htmlFor="basket-bucket">BUCKET</label>
      <input id="basket-bucket" className="text-input" value={bucket} onChange={(event) => setBucket(event.target.value)} required />
      <label className="form-label" htmlFor="basket-access">ACCESS KEY ID</label>
      <input id="basket-access" className="text-input" autoComplete="off" value={accessKeyId} onChange={(event) => setAccessKeyId(event.target.value)} required />
      <label className="form-label" htmlFor="basket-secret">SECRET ACCESS KEY</label>
      <input id="basket-secret" className="text-input" type="password" autoComplete="new-password" value={secretAccessKey} onChange={(event) => setSecretAccessKey(event.target.value)} required />
      <button className="button-secondary" type="submit" disabled={saving}>{saving ? "Testing and saving…" : "Test and save connection"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
