"use client";

import { useState } from "react";
import { authLoginHref } from "@/lib/auth-urls";

export function CheckoutButton({
  signedIn,
  stripeReady,
  alreadyPro,
}: {
  signedIn: boolean;
  stripeReady: boolean;
  alreadyPro: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return (
      <a href={authLoginHref({ returnTo: "/pricing", signup: true })} className="btn btn-spark w-full">
        Create account, then go Pro
      </a>
    );
  }

  if (alreadyPro) {
    return <PortalButton label="Manage billing" />;
  }

  if (!stripeReady) {
    return (
      <p className="meta">
        Pro checkout is not wired on this deploy yet. Stripe test keys still need to be set.
      </p>
    );
  }

  async function start() {
    setPending(true);
    setError("");
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      setError(data.error ?? "Could not start checkout");
      setPending(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-spark w-full" disabled={pending} onClick={() => void start()}>
        {pending ? "Opening Stripe…" : "Get Pro for $5 a month"}
      </button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}

export function PortalButton({ label = "Update card or cancel" }: { label?: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    setError("");
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      setError(data.error ?? "Could not open the billing portal");
      setPending(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-ghost w-full" disabled={pending} onClick={() => void open()}>
        {pending ? "Opening…" : label}
      </button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
