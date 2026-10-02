import type { Skill } from "@/lib/types";

const NUMBER_SYSTEMS = { ru: "Системы счисления", kk: "Санау жүйелері" };

export const SKILLS: Skill[] = [
  {
    id: "ns.base",
    title: { ru: "Основание и цифры систем", kk: "Жүйе негізі мен цифрлары" },
    topic: NUMBER_SYSTEMS,
  },
  {
    id: "ns.bin2dec",
    title: { ru: "Перевод 2 → 10", kk: "2 → 10 аудару" },
    topic: NUMBER_SYSTEMS,
  },
  {
    id: "ns.dec2bin",
    title: { ru: "Перевод 10 → 2", kk: "10 → 2 аудару" },
    topic: NUMBER_SYSTEMS,
  },
  {
    id: "ns.props",
    title: { ru: "Свойства двоичных чисел", kk: "Екілік сандардың қасиеттері" },
    topic: NUMBER_SYSTEMS,
  },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
