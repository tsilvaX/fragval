import { NextResponse, type NextRequest } from "next/server";
import { validPassword } from "./lib/access";
export function proxy(request: NextRequest) {
  const password = process.env.COURT_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production")
      return new NextResponse(
        "FRAG COURT is private. Set COURT_PASSWORD on the server to admit your friends.",
        { status: 503 },
      );
    return NextResponse.next();
  }
  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      if (validPassword(decoded.slice(decoded.indexOf(":") + 1), password))
        return NextResponse.next();
    } catch {
      /* Return the same challenge for malformed credentials. */
    }
  }
  return new NextResponse(
    "The court is friends only. Enter the shared court password (any username).",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="FRAG COURT", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    },
  );
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
