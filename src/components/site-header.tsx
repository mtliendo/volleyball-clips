import Link from "next/link";
import { getSession, isAdmin } from "@/lib/admin";
import { isAuth0Configured } from "@/lib/env";

export async function SiteHeader() {
  const session = await getSession();
  const authReady = isAuth0Configured();
  const admin = isAdmin(session);

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-court text-xs font-bold text-background">
            V
          </span>
          <span className="display text-xl leading-none tracking-wide">
            Focus clips
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm text-muted">
          {admin ? (
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
          ) : null}
          {session ? (
            <a href="/auth/logout" className="hover:text-foreground">
              Sign out
            </a>
          ) : authReady ? (
            <a href="/auth/login?returnTo=/" className="hover:text-foreground">
              Sign in
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-line/80 bg-background/80" />
  );
}
