import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/admin");

  return (
    <div className="space-y-5">
      <nav className="-mx-1 flex gap-2 overflow-x-auto text-sm">
        <Link href="/admin" className="rounded-full bg-panel-2 px-3 py-1.5 text-muted">
          Overview
        </Link>
        <Link href="/admin/games" className="rounded-full bg-panel-2 px-3 py-1.5 text-muted">
          Games
        </Link>
        <Link href="/admin/venues" className="rounded-full bg-panel-2 px-3 py-1.5 text-muted">
          Venues
        </Link>
        <Link href="/admin/tags" className="rounded-full bg-panel-2 px-3 py-1.5 text-muted">
          Tags
        </Link>
      </nav>
      {children}
    </div>
  );
}
