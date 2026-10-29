"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthLoginAnchor } from "@/components/auth-login-anchor";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

const CHECKOUT_PENDING_LABEL = "Opening checkout...";
const PORTAL_PENDING_LABEL = "Opening billing...";

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

  useEffect(() => {
    if (!signedIn || !stripeReady || alreadyPro) return;
    void fetch("/api/stripe/checkout", { method: "GET", cache: "no-store" }).catch(() => {
      /* warmup only */
    });
  }, [signedIn, stripeReady, alreadyPro]);

  if (!signedIn) {
    return (
      <AuthLoginAnchor
        returnTo="/pricing"
        signup
        event={ANALYTICS_EVENTS.signupClick}
        className="btn btn-spark w-full"
        data-billing-control=""
        data-billing-action="signin"
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
    if (pending) return;
    setPending(true);
    setError("");
    trackEvent(ANALYTICS_EVENTS.goProClick);
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start checkout");
        setPending(false);
        return;
      }
      trackEvent(ANALYTICS_EVENTS.checkoutStarted);
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <BillingActionButton
        className="btn btn-spark w-full"
        action="checkout"
        pending={pending}
        pendingLabel={CHECKOUT_PENDING_LABEL}
        error={error}
        onClick={() => void start()}
      >
        Pay $5 a month
      </BillingActionButton>
    </div>
  );
}

export function PortalButton({ label = "Update card or cancel" }: { label?: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/stripe/portal", { method: "GET", cache: "no-store" }).catch(() => {
      /* warmup only */
    });
  }, []);

  async function open() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not open the billing portal");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open the billing portal");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <BillingActionButton
        className="btn btn-ghost w-full"
        action="portal"
        pending={pending}
        pendingLabel={PORTAL_PENDING_LABEL}
        error={error}
        onClick={() => void open()}
      >
        {label}
      </BillingActionButton>
    </div>
  );
}

function BillingActionButton({
  className,
  action,
  pending,
  pendingLabel,
  error,
  onClick,
  children,
}: {
  className: string;
  action: "checkout" | "portal";
  pending: boolean;
  pendingLabel: string;
  error: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        className={[className, pending ? "is-preparing" : ""].filter(Boolean).join(" ")}
        data-billing-control=""
        data-billing-action={action}
        data-billing-pending={pending ? "true" : undefined}
        aria-label={pending ? pendingLabel : undefined}
        aria-busy={pending}
        aria-disabled={pending}
        disabled={pending}
        onClick={onClick}
      >
        {pending ? (
          <>
            <span className="download-spinner" aria-hidden="true" />
            <span className="download-preparing-label keep-motion">{pendingLabel}</span>
          </>
        ) : (
          children
        )}
      </button>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {pending ? pendingLabel : error}
      </p>
      {error ? (
        <p className="text-sm text-error" role="status">
          {error}
        </p>
      ) : null}
    </>
  );
}
