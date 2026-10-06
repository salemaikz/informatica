import "server-only";
import { readJsonBody } from "@/server/body";
import { socialJson } from "@/server/social/route";

// Разбор тела маршрутов соцчасти Ф3: JSON-объект с потолком размера. Ошибка — готовый ответ (400 bad_json / bad_request, 413).

export type ObjBody = { ok: true; value: Record<string, unknown> } | { ok: false; res: Response };

export async function objectBody(req: Request, max: number): Promise<ObjBody> {
  const body = await readJsonBody(req, max);
  if (!body.ok) return { ok: false, res: socialJson({ error: body.error }, body.status) };
  const v = body.value;
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, res: socialJson({ error: "bad_request" }, 400) };
  return { ok: true, value: v as Record<string, unknown> };
}

export const badRequest = () => socialJson({ error: "bad_request" }, 400);
export const rateLimited = () => socialJson({ error: "rate_limited" }, 429);
