import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";

export default async function AdminHomePage() {
  const session = await requireAdminPage("/admin");

  return (
    <div className="space-y-4">
      <h1 className="display text-section">Admin</h1>
      <p className="meta">
        Signed in as {session.user.email ?? session.user.name}. Admin is the Auth0
        role <code>admin</code> on the claim https://vbpov.com/roles.
      </p>
      <div className="grid gap-3">
        <Link href="/admin/games/new" className="btn btn-primary">
          Create a session
        </Link>
        <Link href="/admin/games" className="well block p-4">
          Manage sessions, pins, and uploads
        </Link>
        <Link href="/admin/venues" className="well block p-4">
          Venues
        </Link>
        <Link href="/admin/tags" className="well block p-4">
          Tags
        </Link>
      </div>
    </div>
  );
}
