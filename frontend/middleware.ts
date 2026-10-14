import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate: without a session cookie, send page requests to /login.
 * The backend still validates every API call; this only avoids rendering
 * an app shell that would immediately bounce.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = !!req.cookies.get("ATS_SESSION")?.value;
  const isPublic = pathname === "/login";

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : "?next=" + encodeURIComponent(pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only — not the API proxy, Next internals or static files.
  matcher: ["/((?!api/|_next/|brand/|icon.png|favicon.ico).*)"],
};
