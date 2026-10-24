import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="display text-4xl">Not on the court</h1>
      <p className="text-sm text-muted">That page does not exist.</p>
      <Link href="/" className="text-sm text-court">
        Back to the calendar
      </Link>
    </div>
  );
}
