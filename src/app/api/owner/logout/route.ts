import { sameOrigin } from "@/server/context";
import { ownerLogoutHeader, ownerSecret } from "@/server/owner-auth";

// Выход владельца: cookie `inf_owner` сразу истекает, редирект на /owner (форма входа). Нет OWNER_SECRET — 404.

export const maxDuration = 10;

export async function POST(req: Request) {
  if (!ownerSecret()) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const headers = new Headers({ Location: "/owner", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", ownerLogoutHeader());
  return new Response(null, { status: 303, headers });
}
