import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const privatePaths = ["/my-calls", "/team-calls", "/playlists", "/insights", "/settings", "/search", "/meeting", "/pricing", "/faqs", "/privacy-policy", "/terms-of-service", "/security-compliance", "/onboarding"];

function redirectWithCookies(source: NextResponse, destination: URL) {
  const response = NextResponse.redirect(destination);
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const signedIn = !error && !!data?.claims.sub;
  const path = request.nextUrl.pathname;

  if (!signedIn && privatePaths.some((base) => path === base || path.startsWith(base + "/"))) {
    return redirectWithCookies(response, new URL("/login", request.url));
  }
  if (signedIn && (path === "/login" || path === "/")) {
    let destination = "/onboarding";
    const { error: bootstrapError } = await supabase.rpc("ensure_profile");
    if (!bootstrapError) {
      const { data: profile } = await supabase.from("profiles")
        .select("onboarding_completed")
        .eq("id", data.claims.sub)
        .maybeSingle();
      if (profile?.onboarding_completed) destination = "/my-calls";
    }
    return redirectWithCookies(response, new URL(destination, request.url));
  }
  return response;
}
