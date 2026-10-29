import { type NextRequest } from "next/server";
import { handleAuthLogin } from "@/lib/auth-handlers";

export async function GET(request: NextRequest) {
  return handleAuthLogin(request);
}

export async function HEAD(request: NextRequest) {
  return handleAuthLogin(request);
}
