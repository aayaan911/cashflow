import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasConfiguredSupabase } from "@/lib/env";

/** Public paths: decided before any Supabase work, so they never cost an auth round trip. */
function isPublicPath(pathname: string): boolean {
  return pathname === "/robots.txt" || pathname === "/api/health";
}

export async function middleware(request: NextRequest) {
  if (!hasConfiguredSupabase()) return NextResponse.next();
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });

  // Cookies go out TOGETHER (getAll / setAll) on ONE response. Per-cookie handlers rebuilt the response for
  // each cookie, so a session saved in two chunks reached the browser as the last chunk only, and every
  // request then refreshed the token again (and could get the session revoked). Never go back to them.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  // getSession() reads the cookie (network only to refresh an expired token). It only decides redirects:
  // every row a page shows is still gated by RLS on a signature-checked JWT.
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth/");

  // A redirect is a new response: carry the refreshed cookies over, or the browser keeps a stale one.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isAuthRoute) return redirectTo("/login");
  if (user && pathname === "/login") return redirectTo("/");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
