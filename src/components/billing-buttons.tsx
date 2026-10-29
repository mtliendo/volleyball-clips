"use client";

import { useState } from "react";
import { AuthLoginAnchor } from "@/components/auth-login-anchor";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

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
      <AuthLoginAnchor
        returnTo="/pricing"
        signup
        event={ANALYTICS_EVENTS.signupClick}
        className="btn btn-spark w-full"
      >
        Make a free account first
      </AuthLoginAnchor>
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
    trackEvent(ANALYTICS_EVENTS.goProClick);
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      setError(data.error ?? "Could not start checkout");
      setPending(false);
      return;
    }
    trackEvent(ANALYTICS_EVENTS.checkoutStarted);
    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-spark w-full" disabled={pending} onClick={() => void start()}>
        {pending ? "Opening Stripe…" : "Pay $5 a month"}
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
