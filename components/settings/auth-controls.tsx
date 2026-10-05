"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";

interface AuthProviderInfo {
  id: string;
  name: string;
}

export function AuthControls() {
  const [providers, setProviders] = useState<AuthProviderInfo[]>([]);
  const [identity, setIdentity] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/auth/providers", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([providerResult, session]) => {
      if (providerResult && typeof providerResult === "object") {
        setProviders(Object.values(providerResult as Record<string, AuthProviderInfo>));
      }
      if (session?.user?.email && typeof session.user.email === "string") setIdentity(session.user.email);
    }).catch(() => undefined);
  }, []);

  return (
    <article className="panel settings-row">
      <span className="settings-row-icon">◉</span>
      <div>
        <strong>Authentication</strong>
        <p>{identity ? `Signed in as ${identity}` : "Sign in with a configured OAuth provider to access private projects."}</p>
        <div className="diagnostic-action">
          {identity
            ? <button type="button" className="button-quiet" onClick={() => void signOut({ callbackUrl: "/settings" })}>Sign out</button>
            : providers.map((provider) => <button key={provider.id} type="button" className="button-quiet" onClick={() => void signIn(provider.id, { callbackUrl: "/create" })}>Sign in with {provider.name}</button>)}
          {!identity && providers.length === 0 && <span>Configure Google or GitHub OAuth server-side.</span>}
        </div>
      </div>
    </article>
  );
}
