import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import {
  applyMarkers,
  codeBlock,
  imageIds,
  insertBlock,
  insertText,
  isEmptyNote,
  markSyntax,
  noteImageId,
  noteSnippet,
  prefixLines,
  remarkNoteMark,
  taskProgress,
  toggleTaskAt,
  wrapSelection,
  type MdNode,
} from "@/lib/note-markdown";

const text = (value: string): MdNode => ({ type: "text", value });

function render(md: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkNoteMark],
        urlTransform: (u: string, k: string) => (k === "src" && u.startsWith("note-img:") ? u : defaultUrlTransform(u)),
        components: {
          mark: ({ children, ...p }: { children?: ReactNode }) =>
            createElement("mark", { "data-c": (p as Record<string, unknown>)["data-color"] }, children),
        },
      },
      md,
    ),
  );
}

describe("маркер ==текст==", () => {
  it("жёлтый по умолчанию и цветные варианты", () => {
    expect(render("a ==жёлтый== b")).toContain('<mark data-c="y">жёлтый</mark>');
    expect(render("=={g}зелёный==")).toContain('<mark data-c="g">зелёный</mark>');
    expect(render("=={b}голубой== и =={p}розовый==")).toContain('<mark data-c="b">голубой</mark> и <mark data-c="p">розовый</mark>');
  });

  it("работает вокруг жирного и внутри списка", () => {
    expect(render("==важно **очень** тут==")).toContain('<mark data-c="y">важно <strong>очень</strong> тут</mark>');
    expect(render("- ==пункт==")).toContain("<li><mark");
  });

  it("не трогает код", () => {
    const html = render("`a==b==c` и\n\n```\n==x==\n```");
    expect(html).not.toContain("<mark");
    expect(html).toContain("a==b==c");
  });

  it("одиночные и пробельные == остаются текстом", () => {
    expect(render("a == b == c")).not.toContain("<mark");
    expect(render("x ==без закрытия")).toContain("==без закрытия");
    expect(render("а === б")).not.toContain("<mark");
    expect(render("====")).not.toContain("<mark");
  });

  it("сырой HTML не рендерится", () => {
    const html = render("==<script>alert(1)</script>==");
    expect(html).not.toContain("<script");
  });

  it("applyMarkers не меняет детей без разделителей", () => {
    const kids = [text("просто текст")];
    expect(applyMarkers(kids)).toBe(kids);
  });

  it("цветной разделитель не закрывает маркер", () => {
    const out = applyMarkers([text("==a=={g}")]);
    expect(out.some((n) => n.type === "noteMark")).toBe(false);
  });
});

describe("картинки и чек-листы", () => {
  it("noteImageId принимает только note-img: с нормальным id", () => {
    expect(noteImageId("note-img:iabc123")).toBe("iabc123");
    expect(noteImageId("note-img:")).toBeNull();
    expect(noteImageId("note-img:../x")).toBeNull();
    expect(noteImageId("https://x/y.png")).toBeNull();
    expect(noteImageId(undefined)).toBeNull();
  });

  it("imageIds собирает ссылки без повторов", () => {
    expect(imageIds("![](note-img:aaaa1) текст ![рис](note-img:bbbb2) ![](note-img:aaaa1) ![](https://x)")).toEqual(["aaaa1", "bbbb2"]);
  });

  it("toggleTaskAt переключает нужный пункт", () => {
    const src = "- [ ] один\n- [x] два\n  - [ ] вложенный\n1. [ ] номер";
    const second = src.indexOf("- [x]");
    expect(toggleTaskAt(src, second)).toBe("- [ ] один\n- [ ] два\n  - [ ] вложенный\n1. [ ] номер");
    expect(toggleTaskAt(src, 0)).toBe("- [x] один\n- [x] два\n  - [ ] вложенный\n1. [ ] номер");
    expect(toggleTaskAt(src, src.indexOf("1. [")))!.toContain("1. [x] номер");
    expect(toggleTaskAt("- обычный", 0)).toBeNull();
    expect(toggleTaskAt(src, -1)).toBeNull();
    expect(toggleTaskAt(src, 9999)).toBeNull();
  });

  it("позиция пункта из mdast совпадает с тем, что ждёт toggleTaskAt", () => {
    // Через react-markdown li получает position.start.offset — проверяем на чистом remark-парсинге.
    const src = "Список:\n\n- [ ] первый\n- [x] второй\n";
    const html = render(src);
    expect(html).toContain('type="checkbox"');
    expect(toggleTaskAt(src, src.indexOf("- [x]"))).toBe("Список:\n\n- [ ] первый\n- [ ] второй\n");
  });

  it("taskProgress считает выполненные", () => {
    expect(taskProgress("- [x] a\n- [ ] b\n- [X] c\n- d")).toEqual([2, 3]);
    expect(taskProgress("нет")).toEqual([0, 0]);
  });
});

describe("правки для панели оформления", () => {
  it("wrapSelection оборачивает и снимает", () => {
    const e = wrapSelection("мир", 0, 3, "**", "**");
    expect(e).toEqual({ value: "**мир**", start: 2, end: 5 });
    // повторное нажатие снимает
    expect(wrapSelection(e.value, e.start, e.end, "**", "**").value).toBe("мир");
    // выделение вместе со звёздочками
    expect(wrapSelection("**мир**", 0, 7, "**", "**").value).toBe("мир");
  });

  it("wrapSelection без выделения вставляет заготовку и выделяет её", () => {
    const e = wrapSelection("a b", 1, 1, "**", "**", "текст");
    expect(e.value).toBe("a**текст** b");
    expect(e.value.slice(e.start, e.end)).toBe("текст");
  });

  it("маркер: жёлтый и цветные", () => {
    expect(markSyntax("y")).toEqual(["==", "=="]);
    expect(markSyntax("g")).toEqual(["=={g}", "=="]);
    const [b, a] = markSyntax("p");
    expect(wrapSelection("слово", 0, 5, b, a).value).toBe("=={p}слово==");
  });

  it("prefixLines: заголовок, список, нумерация, чек-лист", () => {
    expect(prefixLines("Тема", 0, 0, "h2").value).toBe("## Тема");
    expect(prefixLines("## Тема", 3, 3, "h2").value).toBe("Тема");
    expect(prefixLines("a\nb", 0, 3, "ul").value).toBe("- a\n- b");
    expect(prefixLines("a\nb\nc", 0, 5, "ol").value).toBe("1. a\n2. b\n3. c");
    expect(prefixLines("a", 0, 1, "todo").value).toBe("- [ ] a");
    // смена вида списка заменяет префикс
    expect(prefixLines("- a\n- b", 0, 7, "ol").value).toBe("1. a\n2. b");
    expect(prefixLines("- [ ] a", 0, 0, "ul").value).toBe("- a");
    // только затронутые строки
    expect(prefixLines("x\ny\nz", 2, 2, "ul").value).toBe("x\n- y\nz");
  });

  it("insertText и insertBlock", () => {
    expect(insertText("a b", 1, 2, "₂")).toEqual({ value: "a₂b", start: 2, end: 2 });
    const e = insertBlock("текст", 5, "![](note-img:iaaaa)");
    expect(e.value).toBe("текст\n\n![](note-img:iaaaa)\n");
    expect(insertBlock("", 0, "X").value).toBe("X\n");
    expect(insertBlock("a\n\nb", 3, "X").value).toBe("a\n\nX\n\nb");
  });

  it("codeBlock: пустой — курсор внутри, с выделением — обрамляет", () => {
    const empty = codeBlock("", 0, 0);
    expect(empty.value).toBe("```\n\n```\n");
    expect(empty.value.slice(0, empty.start)).toBe("```\n");
    expect(codeBlock("print(1)", 0, 8).value).toBe("```\nprint(1)\n```");
  });

  it("noteSnippet убирает разметку", () => {
    expect(noteSnippet("## Заголовок\n**жирный** ==маркер== и `код`\n- [ ] пункт\n![](note-img:iaaaa)")).toBe("Заголовок жирный маркер и код пункт");
    expect(noteSnippet("a".repeat(300), 20)).toHaveLength(20);
  });
});

describe("пустые записи", () => {
  it("isEmptyNote: без текста, заголовка и картинок", () => {
    expect(isEmptyNote({ title: "", body: "  \n" })).toBe(true);
    expect(isEmptyNote({ title: "", body: "", images: [] })).toBe(true);
    expect(isEmptyNote({ title: "Тема", body: "" })).toBe(false);
    expect(isEmptyNote({ title: "", body: "a" })).toBe(false);
    expect(isEmptyNote({ title: "", body: "", images: ["iaaaa"] })).toBe(false);
  });
});
