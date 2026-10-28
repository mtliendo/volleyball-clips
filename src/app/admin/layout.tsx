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
    <div className="container space-y-5 py-6">
      <nav className="-mx-1 flex gap-2 overflow-x-auto text-sm">
        <Link href="/admin" className="chip">
          Overview
        </Link>
        <Link href="/admin/games" className="chip">
          Sessions
        </Link>
        <Link href="/admin/venues" className="chip">
          Venues
        </Link>
        <Link href="/admin/tags" className="chip">
          Tags
        </Link>
      </nav>
      {children}
    </div>
  );
}
