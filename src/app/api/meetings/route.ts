import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  let user = null;
  let supabase = null;

  // 1. Try session cookies
  try {
    const client = await createClient();
    const { data: { user: cookieUser }, error } = await client.auth.getUser();
    if (!error && cookieUser) {
      user = cookieUser;
      supabase = client;
    }
  } catch {
    // Session cookies failed, check Authorization header below
  }

  // 2. Try Authorization: Bearer <token>
  if (!user) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const admin = createAdminClient();
        const { data: { user: tokenUser }, error } = await admin.auth.getUser(token);
        if (!error && tokenUser) {
          user = tokenUser;
          supabase = admin;
        }
      }
    }
  }

  if (!user || !supabase) {
    return NextResponse.json(
      { error: "Unauthorized: Authentication required" },
      { status: 401 },
    );
  }

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("*, recordings(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ meetings: meetings || [] });
}
