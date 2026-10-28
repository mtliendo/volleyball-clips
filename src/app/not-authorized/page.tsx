import Link from "next/link";

export default function NotAuthorizedPage() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="display text-4xl">Not authorized</h1>
      <p className="text-sm text-muted">
        You need the admin role to upload or manage clips.
      </p>
      <Link href="/" className="text-sm text-court">
        Back to the calendar
      </Link>
    </div>
  );
}
