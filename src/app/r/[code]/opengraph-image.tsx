import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_FONT, OG_SIZE, ogImageTree } from "@/components/share/og-image";
import { parseShare } from "@/lib/share-code";
import { biText } from "@/lib/site-meta";
import { shareDict } from "@/i18n/parts/share";

// Превью ссылки /r/<код> (WhatsApp, Telegram): картинка с числами результата, чистая функция кода — поэтому кэшируется навсегда
// (смена дизайна — новый префикс кода x2/c2/s2). Шрифты — статичные TTF с казахскими буквами (assets/fonts); читаются один раз.
export const alt = biText(shareDict["share.og.alt"]);
export const size = OG_SIZE;
export const contentType = "image/png";

const black = await readFile(join(process.cwd(), "assets/fonts/Nunito-Black.ttf"));
const extraBold = await readFile(join(process.cwd(), "assets/fonts/Nunito-ExtraBold.ttf"));

export default async function Image(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  // Код разбираем до любой тяжёлой работы; битый — брендовая заглушка, не ошибка.
  const result = parseShare(code);
  return new ImageResponse(ogImageTree(result), {
    ...OG_SIZE,
    fonts: [
      { name: OG_FONT, data: black, weight: 900, style: "normal" },
      { name: OG_FONT, data: extraBold, weight: 800, style: "normal" },
    ],
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
