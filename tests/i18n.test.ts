import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dict } from "@/i18n/dict";

// Словарь собран из нескольких файлов: ключ, повторённый в двух файлах, молча перезапишется — ловим это.
describe("словарь интерфейса", () => {
  it("у каждого ключа есть ru и kk", () => {
    for (const [key, v] of Object.entries(dict)) {
      expect(v.ru?.trim(), key).toBeTruthy();
      expect(v.kk?.trim(), key).toBeTruthy();
    }
  });

  it("ключи не повторяются между файлами", () => {
    const dir = join(__dirname, "../src/i18n");
    const files = [join(dir, "dict.ts"), ...readdirSync(join(dir, "parts")).map((f) => join(dir, "parts", f))];
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/^\s*"([a-zA-Z0-9_.:-]+)":\s*\{/gm)) {
        if (seen.has(m[1])) dups.push(`${m[1]} (${seen.get(m[1])} и ${f})`);
        else seen.set(m[1], f);
      }
    }
    expect(dups).toEqual([]);
  });
});
