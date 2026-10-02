import { describe, expect, it } from "vitest";
import {
  MAX_SCRATCH_PAGES,
  addPage,
  blankPages,
  nextPageId,
  pageHasContent,
  removePage,
  sanitizePages,
  type ScratchPage,
} from "@/lib/scratch";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const stroke = { tool: "pen", color: "red", size: 4, points: [[1, 1], [20, 20]] };

describe("черновик: санитизация листов", () => {
  it("мусор → пустой список", () => {
    expect(sanitizePages(null)).toEqual([]);
    expect(sanitizePages("x")).toEqual([]);
    expect(sanitizePages([1, null, {}, { id: 1, text: "" }, { id: "a" }])).toEqual([]);
  });

  it("старый формат (только PNG-подложка) сохраняется как есть", () => {
    const out = sanitizePages([{ id: "p1", text: "дано", image: PNG, updatedAt: 5 }]);
    expect(out).toEqual([{ id: "p1", text: "дано", image: PNG, updatedAt: 5 }]);
  });

  it("чужие/опасные картинки отбрасываются, лист остаётся", () => {
    const out = sanitizePages([{ id: "p1", text: "", image: "javascript:alert(1)" }, { id: "p2", text: "", image: "data:text/html;base64,AA==" }]);
    expect(out.map((p) => p.image)).toEqual([undefined, undefined]);
    expect(out).toHaveLength(2);
  });

  it("штрихи листа санитизируются, мусорные пропадают", () => {
    const out = sanitizePages([
      { id: "p1", text: "", strokes: [stroke, { tool: "x" }, 5] },
      { id: "p2", text: "", strokes: "oops" },
    ]);
    expect(out[0].strokes).toEqual([{ tool: "pen", color: "red", size: 4, points: [[1, 1], [20, 20]] }]);
    expect(out[1].strokes).toBeUndefined();
  });

  it("штрихи и подложка уживаются на одном листе", () => {
    const out = sanitizePages([{ id: "p1", text: "t", image: PNG, strokes: [stroke] }]);
    expect(out[0].image).toBe(PNG);
    expect(out[0].strokes).toHaveLength(1);
  });

  it("не больше MAX_SCRATCH_PAGES листов, повторяющиеся id пропускаются", () => {
    const many = Array.from({ length: MAX_SCRATCH_PAGES + 5 }, (_, i) => ({ id: `p${i}`, text: "" }));
    expect(sanitizePages(many)).toHaveLength(MAX_SCRATCH_PAGES);
    expect(sanitizePages([{ id: "a", text: "1" }, { id: "a", text: "2" }])).toHaveLength(1);
  });

  it("старые данные с тремя листами читаются без изменений", () => {
    const three = [1, 2, 3].map((i) => ({ id: `p${i}`, text: `t${i}`, updatedAt: i }));
    expect(sanitizePages(three)).toEqual(three);
  });
});

describe("черновик: листы", () => {
  it("по умолчанию три пустых листа", () => {
    expect(blankPages().map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("добавление листа — до предела", () => {
    let pages = blankPages();
    for (let i = 0; i < 20; i++) pages = addPage(pages);
    expect(pages).toHaveLength(MAX_SCRATCH_PAGES);
    expect(new Set(pages.map((p) => p.id)).size).toBe(MAX_SCRATCH_PAGES);
    expect(addPage(pages)).toBe(pages);
  });

  it("id нового листа не совпадает с существующими после удаления", () => {
    const pages = removePage(blankPages(), 0);
    expect(pages.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(nextPageId(pages)).toBe("p1");
    expect(addPage(pages).map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
  });

  it("последний лист не удаляется; неверный индекс игнорируется", () => {
    const one = blankPages(1);
    expect(removePage(one, 0)).toBe(one);
    const three = blankPages();
    expect(removePage(three, 7)).toBe(three);
    expect(removePage(three, 1).map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("pageHasContent: текст, подложка или штрихи; пробелы и ластик не в счёт", () => {
    const base: ScratchPage = { id: "p1", text: "", updatedAt: 0 };
    expect(pageHasContent(base)).toBe(false);
    expect(pageHasContent({ ...base, text: "  \n" })).toBe(false);
    expect(pageHasContent({ ...base, text: "2+2" })).toBe(true);
    expect(pageHasContent({ ...base, image: PNG })).toBe(true);
    expect(pageHasContent({ ...base, strokes: [{ tool: "eraser", color: "ink", size: 12, points: [[0, 0]] }] })).toBe(false);
    expect(pageHasContent({ ...base, strokes: [{ tool: "marker", color: "yellow", size: 16, points: [[0, 0]] }] })).toBe(true);
  });
});
