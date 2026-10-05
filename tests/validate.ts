import type { EntItem, L, ReadKind, Scene, Step, Text } from "@/lib/types";
import { checkInput } from "@/lib/check";
import { clozeBlanks } from "@/lib/evaluate";
import { isKnownKey } from "@/components/scenes/keyboard";
import { VENN_NAME_MAX, isVennRegion } from "@/components/scenes/venn";
import { TASKS as PY_TASKS } from "@/lib/ide/python/tasks";

const filledL = (l: L) => !!l.ru?.trim() && !!l.kk?.trim();
const filledText = (t: Text) => (typeof t === "string" ? !!t.trim() : filledL(t));

/** Проблемы параметров сцены (пустой список — сцену можно нарисовать). */
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`сцена ${scene.kind}: ${msg}`);
  switch (scene.kind) {
    case "binary":
      need(/^[01]+$/.test(scene.bits), "bits — только 0 и 1");
      need((scene.highlight ?? []).every((i) => Number.isInteger(i) && i >= 0 && i < scene.bits.length), "highlight вне диапазона");
      need(scene.bits.length <= (scene.groups || scene.and !== undefined ? 32 : 16), "bits: не больше 16 разрядов (с groups или and — 32)");
      need(!scene.gap || (Number.isInteger(scene.gap[0]) && Number.isInteger(scene.gap[1]) && scene.gap[0] >= 1 && scene.gap[0] < scene.gap[1] && scene.gap[1] < scene.bits.length), "gap: 1 ≤ начало < конец < длины");
      need(scene.and === undefined || (/^[01]+$/.test(scene.and) && scene.and.length === scene.bits.length), "and: только 0 и 1, той же длины, что bits");
      need(!scene.andLabels || (scene.and !== undefined && scene.andLabels.every(filledText)), "andLabels — только вместе с and, ru/kk");
      need(!(scene.gap && scene.groups), "gap и groups вместе не рисуются");
      break;
    case "ladder":
      need(Number.isInteger(scene.number) && scene.number > 0, "number — целое > 0");
      need((scene.base ?? 2) >= 2, "base ≥ 2");
      break;
    case "lamps":
      need(/^[01]+$/.test(scene.states), "states — только 0 и 1");
      break;
    case "coins":
      need(scene.values.length > 0 && scene.values.every((v) => v > 0), "values — положительные числа");
      need((scene.picked ?? []).every((v) => scene.values.includes(v)), "picked должны быть среди values");
      break;
    case "decimal": {
      const base = scene.base ?? 10;
      need(Number.isInteger(base) && base >= 2 && base <= 16, "base — целое 2..16");
      const digits = "0123456789ABCDEF".slice(0, base);
      need(scene.number.length >= 1 && scene.number.length <= 8 && [...scene.number].every((ch) => digits.includes(ch)), `number — цифры основания ${base} (заглавные A–F), до 8 знаков`);
      need(scene.peel === undefined || typeof scene.peel === "boolean" || (Number.isInteger(scene.peel) && scene.peel >= 1 && scene.peel <= scene.number.length), "peel — true/false или число шагов 1..длины");
      break;
    }
    case "quest":
      need(!scene.caption || filledText(scene.caption), "пустая подпись");
      break;
    case "table": {
      const width = scene.columns?.length ?? scene.rows[0]?.length ?? 0;
      need(scene.rows.length > 0 && width > 0, "нет строк");
      need(scene.rows.every((r) => r.length === width), "строки разной длины (или не совпадают с columns)");
      need(scene.rows.flat().every((c) => typeof c === "string" || filledL(c)), "ячейка ru/kk");
      need(!scene.columns || scene.columns.every((c) => typeof c === "string" || filledL(c)), "заголовок ru/kk");
      need((scene.highlightRows ?? []).every((i) => i >= 0 && i < scene.rows.length), "highlightRows вне диапазона");
      need((scene.highlightCols ?? []).every((i) => i >= 0 && i < width), "highlightCols вне диапазона");
      need((scene.highlightCells ?? []).every(([r, c]) => r >= 0 && r < scene.rows.length && c >= 0 && c < width), "highlightCells вне диапазона");
      need(width <= 8 && scene.rows.length <= 16, "не больше 8 столбцов и 16 строк (экран телефона)");
      const inRow = (r: number) => Number.isInteger(r) && r >= 0 && r < scene.rows.length;
      const inCell = ([r, c]: [number, number]) => inRow(r) && Number.isInteger(c) && c >= 0 && c < width;
      need((scene.rowStates ?? []).every((x) => inRow(x.row)), "rowStates: строка вне диапазона");
      need(new Set((scene.rowStates ?? []).map((x) => x.row)).size === (scene.rowStates ?? []).length, "rowStates: повтор строки");
      need((scene.changes ?? []).every((x) => inCell(x.cell) && filledText(x.from)), "changes: ячейка вне диапазона или пустое «было»");
      need((scene.tones ?? []).every((x) => x.cells.length > 0 && x.cells.every(inCell)), "tones: ячейка вне диапазона");
      need(!scene.range || (inCell(scene.range.from) && inCell(scene.range.to) && scene.range.from[0] <= scene.range.to[0] && scene.range.from[1] <= scene.range.to[1]), "range: углы вне таблицы или перевёрнуты");
      need((scene.arrows ?? []).every((a) => inCell(a.from) && inCell(a.to)), "arrows: ячейка вне диапазона");
      need(!scene.formula || (!!scene.sheet && scene.formula.cell.trim() !== "" && scene.formula.text.trim() !== ""), "formula — только в режиме sheet, поля не пустые");
      need(!scene.rowNumbers || (!!scene.sheet && scene.rowNumbers.length === scene.rows.length && scene.rowNumbers.every((n) => Number.isInteger(n) && n >= 1)), "rowNumbers — только в sheet, по одному на строку, целые ≥ 1");
      if (scene.join) {
        const j = scene.join;
        const jw = j.columns?.length ?? j.rows[0]?.length ?? 0;
        need(j.rows.length > 0 && jw > 0 && j.rows.every((r) => r.length === jw), "join: строки правой таблицы разной длины");
        need(width + jw <= 7 && j.rows.length <= 8 && scene.rows.length <= 8, "join: вместе не больше 7 столбцов и 8 строк в каждой (экран телефона)");
        need(j.links.every(([a, b]) => inRow(a) && Number.isInteger(b) && b >= 0 && b < j.rows.length), "join: links — строка вне диапазона");
        need([...j.rows.flat(), ...(j.columns ?? [])].every((c) => typeof c === "string" || filledL(c)), "join: ячейка ru/kk");
      }
      break;
    }
    case "code":
      need(scene.lines.length > 0 && scene.lines.length <= 24, "1–24 строки кода");
      need(scene.active === undefined || (scene.active >= 0 && scene.active < scene.lines.length), "active вне диапазона");
      need((scene.marks ?? []).every((i) => i >= 0 && i < scene.lines.length), "marks вне диапазона");
      need(scene.lines.every((l) => l.length <= 60), "строка длиннее 60 символов (экран телефона)");
      need(scene.lines.every((l) => !l.includes("\t")), "табуляция в коде — используй 4 пробела");
      need(!scene.run || scene.lang === "python", "кнопка «Запустить» (run) — только у кода на Python");
      break;
    case "circuit": {
      const ids = new Set<string>(scene.inputs);
      need(scene.inputs.length >= 1 && scene.inputs.length <= 4, "1–4 входа");
      need(scene.gates.length >= 1 && scene.gates.length <= 6, "1–6 вентилей");
      for (const g of scene.gates) {
        need(g.in.every((x) => ids.has(x)), `вентиль ${g.id}: вход до объявления (порядок gates — от входов к выходу)`);
        need(g.op === "not" ? g.in.length === 1 : g.in.length === 2, `вентиль ${g.id}: у not 1 вход, у остальных 2`);
        need(!ids.has(g.id), `вентиль ${g.id}: повтор id`);
        ids.add(g.id);
      }
      need(scene.gates.some((g) => g.id === scene.output), "output — id вентиля");
      need((scene.outputs ?? []).every((o) => scene.gates.some((g) => g.id === o.gate) && o.name.trim() !== "" && o.name.length <= 3), "outputs: id вентиля и имя до 3 символов");
      need(!scene.outputs?.length || scene.outputs[0].gate === scene.output, "outputs: первый выход — output");
      need(Object.keys(scene.values ?? {}).every((k) => scene.inputs.includes(k)), "values — только для входов");
      break;
    }
    case "flow": {
      const ids = new Set(scene.nodes.map((n) => n.id));
      need(ids.size === scene.nodes.length, "повтор id блока");
      need(scene.nodes.every((n) => n.x >= 0 && n.x <= 4 && n.y >= 0 && n.y <= 9 && Number.isInteger(n.x) && Number.isInteger(n.y)), "x 0..4, y 0..9, целые");
      need(new Set(scene.nodes.map((n) => `${n.x}:${n.y}`)).size === scene.nodes.length, "два блока в одной клетке");
      need(scene.nodes.every((n) => filledText(n.label)), "подпись блока ru/kk");
      need(scene.edges.every((e) => ids.has(e.from) && ids.has(e.to)), "стрелка к несуществующему блоку");
      need(scene.edges.every((e) => !e.label || filledText(e.label)), "подпись стрелки ru/kk");
      need(!scene.active || ids.has(scene.active), "active — id блока");
      break;
    }
    case "cards":
      need(scene.items.length >= 1 && scene.items.length <= 9, "1–9 карточек");
      need(scene.items.every((i) => filledText(i.title) && (!i.text || filledText(i.text))), "текст карточки ru/kk");
      break;
    case "pixels": {
      const w = scene.rows[0]?.length ?? 0;
      need(scene.rows.length >= 1 && scene.rows.length <= 16 && w >= 1 && w <= 16, "от 1×1 до 16×16");
      need(scene.rows.every((r) => r.length === w), "строки разной длины");
      need(scene.rows.join("").split("").every((ch) => ch in scene.palette), "символ не из палитры");
      break;
    }
    case "web":
      need(scene.html.trim().length > 0, "пустой html");
      need(!/<script|on\w+\s*=|javascript:/i.test(scene.html + (scene.htmlKk ?? "") + (scene.css ?? "")), "скрипты и обработчики запрещены");
      need(scene.htmlKk === undefined || scene.htmlKk.trim().length > 0, "пустой htmlKk");
      break;
    case "hardware":
      need(scene.items.length >= 1 && scene.items.length <= 9, "hardware: 1–9 рисунков");
      need(new Set(scene.items).size === scene.items.length, "hardware: повтор рисунка");
      need((scene.highlight ?? []).every((h) => scene.items.includes(h)), "hardware: подсветка не из items");
      break;
    case "pc-inside":
      break;
    case "cpu-cycle":
      need(scene.instr === undefined || scene.instr.length <= 14, "cpu-cycle: команда длиннее 14 символов");
      break;
    case "keyboard":
      need(scene.keys.length >= 1 && scene.keys.length <= 4, "keyboard: 1–4 клавиши");
      need(scene.keys.every(isKnownKey), `keyboard: неизвестная клавиша (${scene.keys.filter((k) => !isKnownKey(k)).join(", ")})`);
      break;
    case "sizes":
      need(scene.items.length >= 2 && scene.items.length <= 7, "sizes: 2–7 полос");
      need(scene.items.every((i) => Number.isFinite(i.bytes) && i.bytes > 0 && filledText(i.label)), "sizes: размер > 0 и подпись");
      break;
    case "files": {
      const count = (nodes: { name: string; children?: unknown[] }[]): number =>
        nodes.reduce((a, n) => a + 1 + (Array.isArray(n.children) ? count(n.children as { name: string; children?: unknown[] }[]) : 0), 0);
      need(scene.tree.length >= 1 && count(scene.tree) <= 14, "files: 1–14 узлов");
      break;
    }
    case "venn": {
      const n = scene.sets.length;
      const nameLen = (x: Text) => (typeof x === "string" ? [x.length] : [x.ru.length, x.kk.length]);
      need(n >= 2 && n <= 3, "venn: 2–3 множества");
      need(scene.sets.every(filledText), "venn: название множества не пустое (ru и kk)");
      need(scene.sets.every((s) => nameLen(s).every((len) => len <= VENN_NAME_MAX)), `venn: название множества длиннее ${VENN_NAME_MAX} символов (не влезет у круга)`);
      const keys = Object.keys(scene.values ?? {});
      need(keys.every((k) => isVennRegion(k, n)), `venn: values — недопустимая область для ${n} множеств (${keys.filter((k) => !isVennRegion(k, n)).join(", ")})`);
      need(Object.values(scene.values ?? {}).every((v) => typeof v === "string" && v.trim() !== "" && v.length <= 12), "venn: значение области — непустая строка до 12 символов");
      const hl = scene.highlight ?? [];
      need(hl.every((r) => isVennRegion(r, n)), `venn: highlight — недопустимая область для ${n} множеств`);
      need(new Set(hl).size === hl.length, "venn: highlight — повтор области");
      need(scene.universe === undefined || filledText(scene.universe), "venn: пустая подпись универсума");
      break;
    }
    case "layers":
      need(scene.items.length >= 2 && scene.items.length <= 6, "layers: 2–6 слоёв");
      need(scene.highlight === undefined || (scene.highlight >= 0 && scene.highlight < scene.items.length), "layers: highlight вне диапазона");
      need(scene.items.every((i) => filledText(i.title)), "layers: пустой заголовок");
      break;
    // ---- волна 3 (этап 16Б) ----
    case "numberline": {
      const { min, max } = scene;
      const on = (x: number) => Number.isInteger(x) && x >= min && x <= max;
      need(Number.isInteger(min) && Number.isInteger(max) && min < max && max - min <= 40, "numberline: min < max, целые, не больше 40 делений");
      need(scene.ticks === undefined || (scene.ticks === "all" ? max - min <= 20 : scene.ticks.every(on)), "numberline: ticks — \"all\" при ≤ 21 делении или числа на оси");
      need(scene.rows.length >= 1 && scene.rows.length <= 3, "numberline: 1–3 строки");
      for (const r of scene.rows) {
        need(!r.label || filledText(r.label), "numberline: пустая подпись строки");
        need(!!(r.ranges?.length || r.points?.length || r.jumps), "numberline: пустая строка (нет ranges, points, jumps)");
        for (const g of r.ranges ?? []) {
          need((g.from === null || on(g.from)) && (g.to === null || on(g.to)), "numberline: конец промежутка вне оси");
          need(g.from === null || g.to === null || g.from <= g.to, "numberline: from > to");
          need(!(g.from === null && g.fromIn) && !(g.to === null && g.toIn), "numberline: у луча нет закрашенного конца на бесконечности");
        }
        need((r.points ?? []).every((p) => on(p.at) && (!p.label || filledText(p.label))), "numberline: точка вне оси или пустая подпись");
        if (r.jumps) {
          const { start, stop, step } = r.jumps;
          need(Number.isInteger(step) && step !== 0 && on(start) && on(stop), "numberline: jumps — шаг ≠ 0, start и stop на оси");
          need(Math.ceil((stop - start) / step) <= 20, "numberline: jumps — не больше 20 прыжков");
        }
      }
      break;
    }
    case "tape": {
      const n = scene.cells.length;
      const at = (i: number) => Number.isInteger(i) && i >= 0 && i < n;
      need(n >= 1 && n <= 16, "tape: 1–16 ячеек");
      need(scene.cells.every((c) => c.length <= 8), "tape: ячейка длиннее 8 символов");
      if (scene.slice) {
        const { start, stop, step = 1 } = scene.slice;
        need(Number.isInteger(step) && step !== 0, "tape: slice.step — целое ≠ 0");
        need(Number.isInteger(start) && start >= 0 && start <= n && Number.isInteger(stop) && stop >= -1 && stop <= n, "tape: slice — start 0..n, stop −1..n");
      }
      need((scene.pointers ?? []).every((p) => at(p.at) && p.label.trim() !== "" && p.label.length <= 4), "tape: указатель вне ленты или подпись длиннее 4 символов");
      need((scene.swaps ?? []).every(([a, b]) => at(a) && at(b) && a !== b), "tape: swaps — индексы вне ленты или одинаковые");
      need([...(scene.highlight ?? []), ...(scene.dim ?? [])].every(at), "tape: highlight/dim вне ленты");
      need((scene.groups ?? []).every((g) => at(g.from) && at(g.to) && g.from <= g.to && filledText(g.label)), "tape: группа вне ленты или пустая подпись");
      need(!scene.after || (scene.after.length <= 16 && scene.after.every((c) => c.length <= 8)), "tape: after — до 16 ячеек по 8 символов");
      need(!scene.alias || !!scene.name, "tape: alias — только вместе с name");
      break;
    }
    case "chart": {
      const k = scene.labels.length;
      need(k >= 2 && k <= 12, "chart: 2–12 категорий");
      need(scene.labels.every(filledText), "chart: пустая подпись категории");
      need(scene.series.length >= 1 && scene.series.length <= (scene.type === "pie" ? 1 : 4), "chart: 1–4 серии (у pie — одна)");
      need(scene.series.every((s) => s.values.length === k && s.values.every((v) => Number.isFinite(v) && v >= 0)), "chart: у серии по значению ≥ 0 на категорию");
      need(scene.series.every((s) => !s.name || filledText(s.name)), "chart: пустое имя серии");
      need(scene.series.length === 1 || scene.series.every((s) => !!s.name), "chart: у нескольких серий нужны имена (легенда)");
      need(scene.type !== "pie" || scene.series[0].values.reduce((a, b) => a + b, 0) > 0, "chart: pie — сумма > 0");
      need(scene.type !== "pie" || (!scene.threshold && !scene.axes && !scene.funnel), "chart: у pie нет threshold, axes, funnel");
      need(!scene.funnel || (scene.type === "bar" && scene.series.length === 1), "chart: funnel — bar с одной серией");
      need((scene.highlight ?? []).every((i) => Number.isInteger(i) && i >= 0 && i < k), "chart: highlight вне диапазона");
      need(!scene.threshold || (Number.isFinite(scene.threshold.value) && (!scene.threshold.label || filledText(scene.threshold.label))), "chart: threshold");
      break;
    }
    case "graph": {
      const ids = new Set(scene.nodes.map((v) => v.id));
      const layout = scene.layout ?? "free";
      need(scene.nodes.length >= 2 && scene.nodes.length <= 16, "graph: 2–16 вершин");
      need(ids.size === scene.nodes.length, "graph: повтор id вершины");
      need(scene.nodes.every((v) => /^[\p{L}\p{N}_-]{1,12}$/u.test(v.id)), "graph: id — буквы, цифры, _ и -, до 12 символов");
      need(scene.nodes.every((v) => !v.label || filledText(v.label)), "graph: пустая подпись вершины");
      need(layout !== "free" || scene.nodes.every((v) => [v.x, v.y].every((c) => c !== undefined && Number.isFinite(c) && c >= 0 && c <= 100)), "graph: layout free — x и y 0..100 у каждой вершины");
      need(scene.edges.every((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to), "graph: ребро к несуществующей вершине или петля");
      need(scene.edges.every((e) => e.weight === undefined || (e.weight.trim() !== "" && e.weight.length <= 6)), "graph: вес ребра — до 6 символов");
      const key = (a: string, b: string) => (scene.directed ? `${a}>${b}` : [a, b].sort().join("~"));
      need(new Set(scene.edges.map((e) => key(e.from, e.to))).size === scene.edges.length, "graph: повтор ребра");
      if (layout === "tree") {
        need(!!scene.root && ids.has(scene.root), "graph: tree — root среди вершин");
        need(scene.edges.length === scene.nodes.length - 1, "graph: tree — рёбер на одно меньше вершин");
        const seen = new Set<string>(scene.root ? [scene.root] : []);
        for (let grew = true; grew; ) {
          grew = false;
          for (const e of scene.edges)
            for (const [a, b] of [[e.from, e.to], [e.to, e.from]] as const)
              if (seen.has(a) && !seen.has(b) && (!scene.directed || a === e.from)) {
                seen.add(b);
                grew = true;
              }
        }
        need(seen.size === scene.nodes.length, "graph: tree — не все вершины достижимы от root");
      }
      const edgeSet = new Set(scene.edges.map((e) => key(e.from, e.to)));
      const path = scene.path ?? [];
      need(path.every((v) => ids.has(v)), "graph: path — неизвестная вершина");
      need(path.every((v, i) => i === 0 || edgeSet.has(key(path[i - 1], v))), "graph: path — соседние вершины не соединены ребром");
      need((scene.highlight ?? []).every((v) => ids.has(v)), "graph: highlight — неизвестная вершина");
      break;
    }
    case "grid": {
      const { rows, cols } = scene;
      const at = ([r, c]: [number, number]) => Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < rows && c >= 0 && c < cols;
      need(Number.isInteger(rows) && Number.isInteger(cols) && rows >= 1 && rows <= 10 && cols >= 1 && cols <= 10, "grid: от 1×1 до 10×10");
      need(!scene.values || (scene.values.length === rows && scene.values.every((r) => r.length === cols && r.every((c) => c.length <= 4))), "grid: values — rows × cols, клетка до 4 символов");
      for (const mk of scene.marks ?? []) {
        need((mk.cells ?? []).every(at), "grid: marks.cells вне сетки");
        need((mk.rows ?? []).every((r) => Number.isInteger(r) && r >= 0 && r < rows) && (mk.cols ?? []).every((c) => Number.isInteger(c) && c >= 0 && c < cols), "grid: marks.rows/cols вне сетки");
        need(!mk.region || rows === cols, "grid: region — только у квадратной сетки");
      }
      need((scene.path ?? []).every(at), "grid: path вне сетки");
      need(!scene.numbered || !!scene.path?.length, "grid: numbered — только с path");
      const taken = new Set<string>();
      let overlap = false;
      for (const mg of scene.merges ?? []) {
        const rs = mg.rs ?? 1, cs = mg.cs ?? 1;
        need(at([mg.r, mg.c]) && rs >= 1 && cs >= 1 && rs * cs > 1 && mg.r + rs <= rows && mg.c + cs <= cols, "grid: объединение вне сетки или из одной клетки");
        for (let r = mg.r; r < mg.r + rs; r++)
          for (let c = mg.c; c < mg.c + cs; c++) {
            if (taken.has(`${r}:${c}`)) overlap = true;
            taken.add(`${r}:${c}`);
          }
      }
      need(!overlap, "grid: объединения пересекаются");
      need(!scene.axes || ((!scene.axes.row || scene.axes.row.length <= 3) && (!scene.axes.col || scene.axes.col.length <= 3)), "grid: имя оси до 3 символов");
      break;
    }
    case "db-schema": {
      const tables = new Map(scene.tables.map((t) => [t.name, t]));
      const fieldOk = (ref: string) => {
        const [t, f, extra] = ref.split(".");
        return extra === undefined && !!tables.get(t)?.fields.some((x) => x.name === f);
      };
      need(scene.tables.length >= 1 && scene.tables.length <= 4, "db-schema: 1–4 таблицы");
      need(tables.size === scene.tables.length, "db-schema: повтор имени таблицы");
      for (const t of scene.tables) {
        need(t.name.trim() !== "" && t.name.length <= 14, `db-schema: имя таблицы ${t.name} — до 14 символов`);
        need(t.fields.length >= 1 && t.fields.length <= 7, `db-schema: ${t.name} — 1–7 полей`);
        need(new Set(t.fields.map((f) => f.name)).size === t.fields.length, `db-schema: ${t.name} — повтор поля`);
        need(t.fields.every((f) => f.name.trim() !== "" && `${f.name} ${f.type ?? ""}`.length <= 22), `db-schema: ${t.name} — поле с типом длиннее 22 символов`);
        for (const f of t.fields.filter((x) => x.fk)) {
          const [tt, ff] = f.fk!.split(".");
          need(fieldOk(f.fk!) && !!tables.get(tt)?.fields.find((x) => x.name === ff)?.pk, `db-schema: ${t.name}.${f.name} — fk должен указывать на PK «Таблица.поле»`);
        }
      }
      need((scene.cards ?? []).every((c) => fieldOk(c.field) && !!tables.get(c.field.split(".")[0])?.fields.find((x) => x.name === c.field.split(".")[1])?.fk), "db-schema: cards — поле с fk");
      need((scene.highlight ?? []).every((h) => tables.has(h) || fieldOk(h)), "db-schema: highlight — «Таблица» или «Таблица.поле»");
      break;
    }
    case "box": {
      const sides = (x: number | [number, number, number, number] | undefined) =>
        x === undefined ? [] : typeof x === "number" ? [x] : x;
      const all = [...sides(scene.padding), ...sides(scene.border), ...sides(scene.margin)];
      need(Number.isInteger(scene.width) && scene.width > 0 && scene.width <= 2000, "box: width — целое 1..2000");
      need(scene.height === undefined || (Number.isInteger(scene.height) && scene.height > 0), "box: height — целое > 0");
      need(all.every((v) => Number.isInteger(v) && v >= 0 && v <= 200), "box: стороны — целые 0..200 px");
      need(!scene.borderBox || scene.width >= 2 * Math.max(0, ...sides(scene.padding)) + 2 * Math.max(0, ...sides(scene.border)), "box: border-box — width меньше padding + border");
      need(!scene.collapse || (Number.isInteger(scene.collapse.top) && scene.collapse.top >= 0 && scene.collapse.top <= 200), "box: collapse.top — 0..200");
      break;
    }
    case "wave": {
      const ok = (s: number, b?: number) => Number.isInteger(s) && s >= 0 && s <= 40 && (b === undefined || (Number.isInteger(b) && b >= 1 && b <= 16));
      need(ok(scene.samples, scene.bits), "wave: samples 0..40, bits 1..16");
      need(!scene.digital || scene.samples >= 2, "wave: digital — нужно ≥ 2 отсчётов");
      need(!scene.compare || ok(scene.compare.samples, scene.compare.bits), "wave: compare — samples 0..40, bits 1..16");
      need((!scene.label || filledText(scene.label)) && (!scene.compare?.label || filledText(scene.compare.label)), "wave: пустая подпись");
      break;
    }
    case "url": {
      const url = scene.parts.map((p) => p.text).join("");
      need(scene.parts.length >= 1 && scene.parts.every((p) => p.text !== ""), "url: части не пустые");
      need(url.length <= 48 && !/\s/.test(url), "url: без пробелов, до 48 символов (экран телефона)");
      need((scene.highlight ?? []).every((r) => scene.parts.some((p) => p.role === r)), "url: highlight — роль, которой нет среди частей");
      break;
    }
    case "message": {
      need(filledText(scene.from) && filledText(scene.text) && (!scene.subject || filledText(scene.subject)), "message: from и text ru/kk");
      need(scene.channel === "email" || !scene.subject, "message: subject — только у email");
      const text = scene.text;
      const inText = (m: Text) =>
        typeof m === "string" ? (typeof text === "string" ? text.includes(m) : text.ru.includes(m) && text.kk.includes(m)) : typeof text !== "string" && text.ru.includes(m.ru) && text.kk.includes(m.kk);
      need((scene.marks ?? []).length <= 4 && (scene.marks ?? []).every((m) => filledText(m.text) && inText(m.text) && (!m.note || filledText(m.note))), "message: marks — до 4 точных подстрок текста на обоих языках");
      break;
    }
    case "gates":
      need(scene.ops.length >= 1 && scene.ops.length <= 6 && new Set(scene.ops).size === scene.ops.length, "gates: 1–6 разных вентилей");
      need((scene.highlight ?? []).every((o) => scene.ops.includes(o)), "gates: highlight — из ops");
      break;
    case "switches": {
      const k = scene.values?.length ?? scene.names?.length ?? (scene.mode === "not" ? 1 : 2);
      need(scene.mode === "not" ? k === 1 : scene.mode === "xor" ? k === 2 : k === 2 || k === 3, "switches: not — 1 ключ, xor — 2, and/or — 2 или 3");
      need(!scene.names || (scene.names.length === k && scene.names.every((x) => x.trim() !== "" && x.length <= 3)), "switches: names — по имени до 3 символов на ключ");
      need(!scene.values || !scene.names || scene.values.length === scene.names.length, "switches: values и names разной длины");
      break;
    }
  }
  if ("caption" in scene && scene.caption !== undefined) need(filledText(scene.caption), "пустая подпись");
  return errors;
}

const READ_KIND_LIST: readonly ReadKind[] = ["output", "bug", "fix", "fill", "purpose", "schema"];

/** Проблемы задания ЕНТ (пустой список — задание корректно). */
export function validateEnt(item: EntItem): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`${item.id}: ${msg}`);
  const uniq = (arr: Text[]) => new Set(arr.map((o) => JSON.stringify(o))).size === arr.length;
  need(/^[a-z0-9-]+:[a-z0-9-]+$/.test(item.id), "id вида <урок>:<имя> (латиница, цифры, дефис)");
  need([1, 2, 3].includes(item.level), "level 1|2|3");
  if (item.scene) errors.push(...validateScene(item.scene).map((e) => `${item.id}: ${e}`));
  // «Чтение кода» (#87): известный вид; у обычного задания есть что читать; у «где ошибка» строка с ошибкой не подсвечена.
  const readOk = (r: ReadKind | undefined) => r === undefined || READ_KIND_LIST.includes(r);
  if (item.kind !== "context" && item.read) {
    need(readOk(item.read), `read — один из ${READ_KIND_LIST.join(", ")}`);
    const sc = item.scene?.kind;
    need(
      sc === "code" || sc === "web" || sc === "flow" || sc === "table" || /`[^`]+`/.test(item.prompt.ru),
      "read: нужен материал для чтения — сцена code/web/flow/table или `код` в условии",
    );
  }
  if (item.kind !== "context" && (item.read === "bug" || item.read === "fix")) {
    need(!(item.scene?.kind === "code" && item.scene.marks?.length), "read bug/fix: не подсвечивай строку с ошибкой (marks выдают ответ)");
  }
  if (item.kind === "context") {
    for (const q of item.questions) need(readOk(q.read), `${q.id}: read — один из ${READ_KIND_LIST.join(", ")}`);
  }
  if (item.kind === "context") {
    need(filledL(item.text), "text ru/kk");
    need(item.questions.length === 5, "ровно 5 вопросов");
    for (const q of item.questions) {
      need(filledL(q.prompt) && filledL(q.explanation), `${q.id}: prompt/explanation ru/kk`);
      need(q.options.length === 4 && q.options.every(filledText) && uniq(q.options), `${q.id}: 4 разных варианта`);
      need(q.correct >= 0 && q.correct < 4, `${q.id}: correct 0..3`);
      need(!q.hint || filledL(q.hint), `${q.id}: hint ru/kk`);
    }
    need(new Set(item.questions.map((q) => q.id)).size === 5, "id вопросов уникальны");
    return errors;
  }
  need(filledL(item.prompt), "prompt ru/kk");
  need(filledL(item.explanation), "explanation ru/kk");
  need(!item.hint || filledL(item.hint), "hint ru/kk");
  switch (item.kind) {
    case "single":
      need(item.options.length === 4, "ровно 4 варианта");
      need(item.options.every(filledText) && uniq(item.options), "варианты непустые и разные");
      need(item.correct >= 0 && item.correct < 4, "correct 0..3");
      need(!item.whyWrong || (item.whyWrong.length === 4 && item.whyWrong[item.correct] === null), "whyWrong: 4 элемента, у верного null");
      need((item.whyWrong ?? []).every((w) => w === null || filledL(w)), "whyWrong ru/kk");
      break;
    case "multi":
      need(item.options.length === 6, "ровно 6 вариантов");
      need(item.options.every(filledText) && uniq(item.options), "варианты непустые и разные");
      need(item.correct.length >= 2 && item.correct.length <= 3, "2–3 верных");
      need(new Set(item.correct).size === item.correct.length && item.correct.every((i) => i >= 0 && i < 6), "correct 0..5 без повторов");
      break;
    case "match":
      need(item.items.length === 2, "ровно 2 пункта (A, B)");
      need(item.choices.length === 4, "ровно 4 описания");
      need(item.items.every(filledText) && item.choices.every(filledText) && uniq(item.choices), "тексты непустые, описания разные");
      need(item.answer.length === 2 && item.answer.every((a) => a >= 0 && a < 4) && item.answer[0] !== item.answer[1], "answer: 2 разных индекса 0..3");
      // Буквы A/B и номера описаний экран добавляет сам — в тексте их быть не должно.
      need(
        [...item.items, ...item.choices].every((t) => !/^\s*([A-DА-Г]|\d)[.)]\s/.test(typeof t === "string" ? t : `${t.ru}\n${t.kk}`)),
        "не пиши «A. »/«1) » в начале пунктов и описаний — буквы и номера ставит экран",
      );
      break;
  }
  return errors;
}

/** Возвращает список проблем шага (пустой — шаг валиден). */
export function validateStep(step: Step): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`${step.id}: ${msg}`);
  // Схемы шага: сцена теории/ситуации/разбора/решаем-вместе и «раскрытие» после ответа.
  const scenes: (Scene | undefined)[] = [step.reveal, step.scene];
  if (step.type === "worked") scenes.push(...step.steps.map((x) => x.scene));
  for (const sc of scenes) if (sc) errors.push(...validateScene(sc).map((e) => `${step.id}: ${e}`));
  if (step.reveal) need(step.type !== "video" && step.type !== "theory" && step.type !== "story" && step.type !== "worked" && step.type !== "explore", "reveal только у заданий");
  if (step.type === "video") need(filledL(step.title), "title");
  if (step.type === "theory") {
    need(filledL(step.title), "title");
    need(filledL(step.body), "body");
  }
  if (step.type === "story") need(filledL(step.body), "body");
  if (step.type === "worked") {
    need(filledL(step.title), "title");
    need(step.steps.length >= 2 && step.steps.every((x) => filledL(x.text)), "минимум 2 шага ru/kk");
    need(!step.result || filledL(step.result), "result ru/kk");
  }
  if (step.type === "explore") {
    need(filledL(step.title), "title");
    need(step.size >= 1 && step.size <= 8, "size 1..8");
    if (step.goal) need(step.goal.target >= 0 && filledL(step.goal.text), "goal");
  }
  if (step.type === "video" || step.type === "theory" || step.type === "story" || step.type === "worked" || step.type === "explore") return errors;

  need(filledL(step.prompt), "prompt ru/kk");
  need(filledL(step.explanation), "explanation ru/kk");
  need(!step.hint || filledL(step.hint), "hint ru/kk");
  if ((step.type === "choice" || step.type === "multi") && step.whyWrong) {
    const ww = step.whyWrong;
    const right = step.type === "choice" ? [step.correct] : step.correct;
    need(ww.length === step.options.length, "whyWrong: столько же элементов, сколько вариантов");
    need(right.every((i) => ww[i] === null), "whyWrong: у верных вариантов null");
    need(ww.every((w) => w === null || filledL(w)), "whyWrong ru/kk");
  }
  switch (step.type) {
    case "choice":
      need(step.options.length >= 2, "минимум 2 варианта");
      need(step.options.every(filledText), "пустой вариант");
      need(step.correct >= 0 && step.correct < step.options.length, "correct вне диапазона");
      need(new Set(step.options.map((o) => JSON.stringify(o))).size === step.options.length, "повторяющиеся варианты");
      break;
    case "multi":
      need(step.options.length >= 3, "минимум 3 варианта");
      // На ЕНТ в заданиях с несколькими ответами ровно 6 вариантов (аудит C4); правило — для шагов уроков и банков.
      need(!step.ent || step.options.length === 6, "multi с пометкой ЕНТ: ровно 6 вариантов");
      need(step.correct.length >= 1, "нет верных");
      need(step.correct.every((i) => i >= 0 && i < step.options.length), "correct вне диапазона");
      break;
    case "input":
      need(step.answers.length > 0, "нет ответов");
      need(step.answers.every((a) => checkInput(a, step.answers, step.mode)), "ответ не проходит свою проверку");
      break;
    case "bits":
      need(step.target >= 0 && step.target < 2 ** step.bits, "target не помещается в bits");
      break;
    case "ladder":
      need(step.number > 0 && step.number < 1024, "number вне 1..1023");
      break;
    case "match":
      need(step.pairs.length >= 3 && step.pairs.length <= 6, "3–6 пар");
      need(new Set(step.pairs.map((p) => JSON.stringify(p.right))).size === step.pairs.length, "повторы справа");
      break;
    case "order":
      need(step.items.length >= 3 && step.items.every(filledL), "минимум 3 пункта ru/kk");
      break;
    case "solution":
      need(filledL(step.reference), "reference");
      need(checkInput(step.answer, [step.answer], step.answerMode), "answer");
      break;
    case "cloze": {
      const blanks = clozeBlanks(step);
      need(blanks.length >= 1, "нет пропусков");
      need(blanks.every((b) => b.blank.length > 0 && b.blank.every((v) => checkInput(v, b.blank, b.mode))), "ответ пропуска не проходит свою проверку");
      need(step.lines.flat().every((t) => (typeof t === "object" && !("blank" in t) ? filledL(t) : true)), "текст ru/kk");
      need(blanks.every((b) => b.width === undefined || b.width > 0), "width > 0");
      need(blanks.every((b) => b.mode !== "binary" || b.blank.every((v) => /^[01]+$/.test(v))), "двоичный пропуск: ответ из 0 и 1");
      // Этап 16Б: выбор слов вместо ввода. Подписи — у всех текстовых пропусков шага или ни у одного; подпись — верный ответ.
      const textBlanks = blanks.filter((b) => b.mode === "text");
      const labeled = textBlanks.filter((b) => b.label);
      need(labeled.length === 0 || labeled.length === textBlanks.length, "label — у всех текстовых пропусков шага или ни у одного");
      need(labeled.every((b) => filledL(b.label!) && checkInput(b.label!.ru, b.blank, "text") && checkInput(b.label!.kk, b.blank, "text")), "label.ru и label.kk — верные ответы пропуска");
      need(!step.bank || labeled.length > 0, "bank (отвлекатели) — только вместе с label у пропусков");
      need(
        (step.bank ?? []).every((d) => filledL(d) && !textBlanks.some((b) => checkInput(d.ru, b.blank, "text") || checkInput(d.kk, b.blank, "text"))),
        "отвлекатель bank не должен быть верным ответом ни одного пропуска",
      );
      break;
    }
    case "entmatch":
      // «Соответствие» как на ЕНТ (этап 14) — те же правила, что у EntMatch в validateEnt.
      need(step.items.length === 2, "ровно 2 пункта (A, B)");
      need(step.choices.length === 4, "ровно 4 описания");
      need(step.items.every(filledText) && step.choices.every(filledText), "тексты непустые");
      need(new Set(step.choices.map((o) => JSON.stringify(o))).size === 4, "описания разные");
      need(step.answer.length === 2 && step.answer.every((a) => Number.isInteger(a) && a >= 0 && a < 4) && step.answer[0] !== step.answer[1], "answer: 2 разных индекса 0..3");
      need(
        [...step.items, ...step.choices].every((t) => !/^\s*([A-DА-Г]|\d)[.)]\s/.test(typeof t === "string" ? t : `${t.ru}\n${t.kk}`)),
        "не пиши «A. »/«1) » в начале пунктов и описаний — буквы и номера ставит экран",
      );
      break;
    case "code": {
      // Задача практикума на Python с тем же навыком, что у шага (этап 14).
      const task = PY_TASKS.find((x) => x.id === step.task);
      need(!!task, `нет задачи практикума ${step.task}`);
      need(!task || task.lang === "python", "задача с кодом в уроке — только Python");
      need(!!step.skill, "у задачи с кодом нужен skill");
      break;
    }
  }
  return errors;
}
