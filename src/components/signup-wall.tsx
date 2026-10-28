import { authLoginHref } from "@/lib/auth-urls";

export function SignupWall({ returnTo }: { returnTo: string }) {
  return (
    <div className="flex min-h-full flex-col justify-end bg-paper/92 p-5">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <h2 className="display text-section">Guest pass is used up</h2>
        <p className="lead">
          Seven clips a day without an account. A free login keeps the night going and saves favorites.
        </p>
        <div className="flex flex-col gap-2">
          <a href={authLoginHref({ returnTo, signup: true })} className="btn btn-primary">
            Create a free account
          </a>
          <a href={authLoginHref({ returnTo })} className="btn btn-ghost">
            Sign in
          </a>
          <a href={returnTo.replace(/\/watch\/[^/?]+/, "")} className="btn btn-ghost">
            Back to the session
          </a>
        </div>
      </div>
    </div>
  );
}
