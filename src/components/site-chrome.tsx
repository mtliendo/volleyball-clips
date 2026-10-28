"use client";

import { usePathname } from "next/navigation";

export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const watch =
    pathname.includes("/watch/") ||
    pathname.startsWith("/dev/feed") ||
    pathname.startsWith("/dev/walls");

  if (watch) {
    return <>{children}</>;
  }

  return (
    <>
      {header}
      <div className="relative">{children}</div>
      {footer}
    </>
  );
}
