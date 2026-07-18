import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Auth 페이지 (로그인/회원가입) — 로그인 상태면 /chat으로
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // 보호된 라우트 — 비로그인 시 /login으로
  const isProtectedRoute =
    pathname.startsWith("/chat") ||
    pathname.startsWith("/archive") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/admin");

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 온보딩 체크 — 로그인했지만 온보딩 미완료 시 /onboarding으로
  if (user && isProtectedRoute && !pathname.startsWith("/onboarding") && pathname !== "/api") {
    // 쿠키 캐시 확인 (DB 조회 최소화)
    const cachedRole = request.cookies.get("x-user-role")?.value;
    const cachedOnboarding = request.cookies.get("x-user-onboarded")?.value;

    let role = cachedRole;
    let onboarded = cachedOnboarding;

    if (!cachedRole || !cachedOnboarding) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, role")
        .eq("id", user.id)
        .single();

      role = profile?.role ?? "user";
      onboarded = profile?.onboarding_completed ? "1" : "0";

      // 쿠키에 캐싱 (1시간)
      const roleTTL = role === "admin" ? 300 : 3600;
      supabaseResponse.cookies.set("x-user-role", role as string, { maxAge: roleTTL, httpOnly: true, sameSite: "lax" });
      supabaseResponse.cookies.set("x-user-onboarded", onboarded as string, { maxAge: 3600, httpOnly: true, sameSite: "lax" });
    }

    if (onboarded === "0") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // 관리자 페이지 — role='admin'만 접근
    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
  }

  // 온보딩 완료된 사용자가 /onboarding 접근 시 /chat으로
  if (user && pathname.startsWith("/onboarding")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed) {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
  }

  // 루트 리다이렉트
  if (pathname === "/") {
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}
