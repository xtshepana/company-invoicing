import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env-public";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/customers",
  "/products",
  "/quotes",
  "/invoices",
  "/recurring-invoices",
  "/payments",
  "/banking",
  "/statements",
  "/credit-notes",
  "/reports",
  "/settings",
  "/users",
  "/audit-log",
];

/**
 * Next.js 16's renamed middleware. Redirects unauthenticated requests away
 * from app routes. This is the outer layer only — each route group's
 * layout.tsx re-checks the session server-side, and every server
 * action/route handler independently verifies the caller. `/api/*` is
 * excluded (see matcher below); webhook/cron routes do their own auth.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
