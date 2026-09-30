import { NextResponse } from "next/server";
import { verifyClientMagicLink } from "@/server/services/client-auth";

/**
 * Where a magic-link email actually lands. Consumes the token (single use)
 * and, on success, the session cookie is already set by
 * verifyClientMagicLink before this redirects into the portal.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/client/login?error=invalid", url.origin));
  }

  const session = await verifyClientMagicLink(token);
  if (!session) {
    return NextResponse.redirect(new URL("/client/login?error=invalid", url.origin));
  }

  return NextResponse.redirect(new URL("/client", url.origin));
}
