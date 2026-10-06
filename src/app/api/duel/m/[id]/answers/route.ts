import { matchAction } from "@/server/duel/actions";

// Ответы пачкой до 5 (HSETNX {s}:{i}; проверка plausible.ts по серверному времени): POST {answers:AnswerIn[]} → {view, accepted}.

export const maxDuration = 10;

export async function POST(req: Request, ctx: RouteContext<"/api/duel/m/[id]/answers">) {
  return matchAction(req, (await ctx.params).id, "answers");
}
