import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/Markdown";
import { bodyWithoutTitleLine, noteDate } from "@/lib/note-markdown";

// Настоящий компонент Markdown (конспекты и ответы ИИ): безопасность и чек-листы.
const html = (md: string, onToggleTask?: (o: number) => void) => renderToStaticMarkup(createElement(Markdown, { onToggleTask }, md));

describe("Markdown: недоверенный текст", () => {
  it("чужие картинки не загружаются — вместо них ссылка", () => {
    const out = html("![схема](https://evil.example/x.png?leak=1)");
    expect(out).not.toContain("<img");
    expect(out).toContain('href="https://evil.example/x.png?leak=1"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain("схема");
  });

  it("javascript: и data: в картинке — без ссылки и без img", () => {
    const out = html("![a](javascript:alert(1)) ![b](data:image/png;base64,AAAA)");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("href=");
  });

  it("сырой HTML не рендерится", () => {
    const out = html('<img src=x onerror="alert(1)"> ==<b>x</b>==');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<b>");
  });

  it("note-img: — плейсхолдер загрузки, не <img> с адресом", () => {
    const out = html("![](note-img:iabc123)");
    expect(out).not.toContain("note-img:");
    expect(out).toContain("animate-pulse");
  });

  it("чек-лист без обработчика — только чтение; с обработчиком — активный и с большой зоной касания", () => {
    expect(html("- [ ] a")).toContain("disabled");
    const live = html("- [ ] a", () => {});
    expect(live).not.toContain("disabled");
    expect(live).toContain("<label");
  });
});

describe("карточка записи", () => {
  it("bodyWithoutTitleLine убирает первую содержательную строку", () => {
    expect(bodyWithoutTitleLine("Заголовок\nтекст")).toBe("текст");
    expect(bodyWithoutTitleLine("\n![](note-img:iaaaa)\n## Тема\nтекст")).toBe("\n![](note-img:iaaaa)\nтекст");
    expect(bodyWithoutTitleLine("")).toBe("");
  });

  it("noteDate: свои названия месяцев (kk-KZ есть не во всех браузерах)", () => {
    const now = new Date(2026, 9, 2).getTime();
    expect(noteDate(new Date(2026, 9, 2).getTime(), "ru", now)).toBe("2 окт.");
    expect(noteDate(new Date(2026, 9, 2).getTime(), "kk", now)).toBe("2 қазан");
    expect(noteDate(new Date(2025, 0, 15).getTime(), "ru", now)).toBe("15 янв. 2025");
    expect(noteDate(new Date(2025, 0, 15).getTime(), "kk", now)).toBe("2025 ж. 15 қаңтар");
    expect(noteDate(Number.NaN, "ru", now)).toBe("");
  });
});
