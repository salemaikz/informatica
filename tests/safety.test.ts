import { describe, expect, it } from "vitest";
import { crisisLang, crisisReply, detectCrisis, isCrisisReply } from "@/lib/safety";
import { dict } from "@/i18n/dict";

describe("detectCrisis: срабатывает", () => {
  const selfHarm = [
    "Я хочу умереть",
    "не хочу больше жить",
    "Жить не хочу",
    "хочу покончить с собой",
    "думаю убить себя",
    "мысли о суициде",
    "суицид",
    "хочется сдохнуть",
    "хочу вскрыть вены",
    "режу себя",
    "лучше бы меня не было",
    "hochu umeret",
    "ne hochu zhit",
    "өлгім келеді",
    "өмір сүргім келмейді",
    "өзімді өлтіргім келеді",
    "өзіме қол жұмсағым келеді",
    "I want to die",
    "я хочу умиреть",
    "незачем жить",
    "өзімді-өзім өлтіргім келеді",
    "олгим келеди",
    "i wanna die",
  ];
  const abuse = [
    "меня бьет отец",
    "Меня бьют дома",
    "папа бьет меня",
    "меня избивает отчим",
    "меня изнасиловали",
    "ко мне пристает учитель",
    "мені ұрады",
    "мені үйде ұрады",
    "мені зорлады",
    "боюсь идти домой",
    "меня травят в школе",
    "мені әкем ұрады",
    "мени урады",
  ];
  it.each(selfHarm)("self_harm: %s", (s) => expect(detectCrisis(s)).toBe("self_harm"));
  it.each(abuse)("abuse: %s", (s) => expect(detectCrisis(s)).toBe("abuse"));
  it("в середине длинного сообщения", () => {
    expect(detectCrisis("Привет. Слушай, честно, мне так плохо, я хочу умереть. Помоги с двоичной системой")).toBe("self_harm");
  });
});

describe("detectCrisis: учебное не срабатывает", () => {
  const safe = [
    "как убить процесс в linux",
    "kill -9 1234",
    "убить зависший процесс командой kill",
    "смерть персонажа в игре",
    "персонаж умер в игре, как сохранить",
    "я умру со скуки",
    "хочу умереть со скуки на этом уроке",
    "умираю от скуки",
    "умереть от смеха",
    "не хочу жить в общежитии",
    "меня бьет током при пайке",
    "меня бьют в игре",
    "как перевести 25 в двоичную систему",
    "что такое цикл while",
    "мне нравится жить в Астане",
    "процесс завершится с кодом смерти",
    "ойында кейіпкер өлді",
    "меня бьёт озноб",
    "меня бьет дрожь",
    "меня били в игре",
    "я готов умереть ради пятёрки",
    "устал жить по расписанию",
    "def die(): pass",
    "",
  ];
  it.each(safe)("null: %s", (s) => expect(detectCrisis(s)).toBeNull());
});

describe("ответ", () => {
  it("содержит телефоны 150, 111, 112 на обоих языках", () => {
    for (const kind of ["self_harm", "abuse"] as const)
      for (const lang of ["ru", "kk"] as const) {
        const r = crisisReply(kind, lang);
        for (const n of ["150", "111", "112"]) expect(r).toContain(n);
      }
  });
  it("ru: «со взрослым», без глаголов с родом", () => {
    for (const kind of ["self_harm", "abuse"] as const) {
      const r = crisisReply(kind, "ru");
      expect(r).not.toMatch(/ с взрослым/);
      expect(r.replace(/один на один/g, "")).not.toMatch(/сделал|одна|один/);
    }
  });
  it("язык: казахские буквы переключают на kk", () => {
    expect(crisisLang("өлгім келеді", "ru")).toBe("kk");
    expect(crisisLang("хочу умереть", "ru")).toBe("ru");
    expect(crisisLang("хочу умереть", "kk")).toBe("kk");
  });
});

describe("кризисный ответ в словаре раздела ИИ", () => {
  it("тексты лежат под ai.crisis.* и совпадают с ответом crisisReply", () => {
    expect(crisisReply("self_harm", "ru")).toBe(dict["ai.crisis.selfHarm"].ru);
    expect(crisisReply("self_harm", "kk")).toBe(dict["ai.crisis.selfHarm"].kk);
    expect(crisisReply("abuse", "ru")).toBe(dict["ai.crisis.abuse"].ru);
    expect(crisisReply("abuse", "kk")).toBe(dict["ai.crisis.abuse"].kk);
  });

  it("isCrisisReply узнаёт сохранённый ответ (под ним нет «Сообщить об ошибке») и не путает с обычным", () => {
    for (const kind of ["self_harm", "abuse"] as const) {
      for (const lang of ["ru", "kk"] as const) {
        expect(isCrisisReply(crisisReply(kind, lang))).toBe(true);
        expect(isCrisisReply(`${crisisReply(kind, lang)}\n`)).toBe(true);
      }
    }
    expect(isCrisisReply("Двоичная система — это система счисления с основанием 2.")).toBe(false);
    expect(isCrisisReply("")).toBe(false);
  });
});
