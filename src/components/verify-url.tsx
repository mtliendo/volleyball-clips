"use client";

import { useEffect, useState } from "react";

export function VerifyUrl() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const sync = () => {
      setUrl(`${window.location.pathname}${window.location.search}`);
    };
    sync();
    window.addEventListener("popstate", sync);
    const previous = window.history.replaceState;
    window.history.replaceState = function (...args) {
      previous.apply(this, args);
      sync();
    };
    return () => {
      window.removeEventListener("popstate", sync);
      window.history.replaceState = previous;
    };
  }, []);

  if (!url) return null;

  return (
    <p className="verify-url" data-verify-url={url}>
      {url}
    </p>
  );
}
