import { type NextRequest } from "next/server";
import { handleAuthLogin, handleAuthMountedRoute } from "@/lib/auth-handlers";

function handle(request: NextRequest) {
  const action = request.nextUrl.pathname.split("/").pop();
  if (action === "login") {
    return handleAuthLogin(request);
  }
  return handleAuthMountedRoute(request);
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}

export function HEAD(request: NextRequest) {
  return handle(request);
}
