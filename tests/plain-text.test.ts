import { describe, expect, it } from "vitest";
import { plainText } from "@/lib/text";

describe("plainText: строчная markdown-разметка → простой текст", () => {
  it("убирает обратные кавычки", () => {
    expect(plainText("Что выведет `print(2 + 3)`?")).toBe("Что выведет print(2 + 3)?");
    expect(plainText("`x`")).toBe("x");
  });

  it("жирный и курсив", () => {
    expect(plainText("Это **важно** запомнить")).toBe("Это важно запомнить");
    expect(plainText("**Внимание:** условие")).toBe("Внимание: условие");
    expect(plainText("слово __жирное__ тут")).toBe("слово жирное тут");
    expect(plainText("это *курсив* и _тоже_")).toBe("это курсив и тоже");
    expect(plainText("(**да**, *нет*)")).toBe("(да, нет)");
  });

  it("маркер ==текст== без цвета и с цветом =={g}текст==", () => {
    expect(plainText("Найди ==ошибку== в коде")).toBe("Найди ошибку в коде");
    expect(plainText("Верно: =={g}зелёный== и =={p}розовый==")).toBe("Верно: зелёный и розовый");
    expect(plainText("==`x`== — целое")).toBe("x — целое");
  });

  it("формулы и имена не ломаются: a*b*c, 2**10, my_var_name, a == b", () => {
    expect(plainText("a*b*c")).toBe("a*b*c");
    expect(plainText("2*3*4")).toBe("2*3*4");
    expect(plainText("a * b * c")).toBe("a * b * c");
    expect(plainText("2**10")).toBe("2**10");
    expect(plainText("my_var_name")).toBe("my_var_name");
    expect(plainText("a_b и c_d")).toBe("a_b и c_d");
    expect(plainText("если a == b, то выведи")).toBe("если a == b, то выведи");
  });

  it("внутри кода разметка не трогается", () => {
    expect(plainText("`a == b` и `2**10` и `x*y*z`")).toBe("a == b и 2**10 и x*y*z");
    expect(plainText("`my_var_name`")).toBe("my_var_name");
  });

  it("обычный русский и казахский текст не меняется", () => {
    const ru = "Сколько байт в 2 килобайтах? Ответ: 2048 (2¹¹).";
    const kk = "Екілік санау жүйесіндегі 1011₂ санының ондық мәні қандай?";
    expect(plainText(ru)).toBe(ru);
    expect(plainText(kk)).toBe(kk);
    expect(plainText("")).toBe("");
  });

  it("кириллица рядом с разметкой считается словом", () => {
    expect(plainText("слово*не курсив*слово")).toBe("слово*не курсив*слово");
    expect(plainText("**сан** және *жол*")).toBe("сан және жол");
  });

  it("одиночные непарные символы остаются", () => {
    expect(plainText("a * b")).toBe("a * b");
    expect(plainText("5 == 5")).toBe("5 == 5");
    expect(plainText("x_")).toBe("x_");
  });
});
