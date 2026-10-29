import { NextResponse, type NextRequest } from "next/server";

function redirectToV4(request: NextRequest) {
  const dest = request.nextUrl.clone();
  dest.pathname = request.nextUrl.pathname.replace(/^\/api\/auth/, "/auth");
  return NextResponse.redirect(dest, 307);
}

export function GET(request: NextRequest) {
  return redirectToV4(request);
}

export function POST(request: NextRequest) {
  return redirectToV4(request);
}

export function HEAD(request: NextRequest) {
  return redirectToV4(request);
}
