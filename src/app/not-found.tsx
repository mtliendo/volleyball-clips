import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container space-y-3 py-16">
      <h1 className="display text-display-s">Not on the court</h1>
      <p className="lead">That page does not exist.</p>
      <Link href="/" className="btn btn-primary">
        Back to the nights
      </Link>
    </div>
  );
}
