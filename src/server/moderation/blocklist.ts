import "server-only";

// Стоп-корни для имён игроков (ru / kk / en и транслит). ТОЛЬКО на сервере: в JS-бандл детей список не попадает —
// иначе он стал бы словарём ругательств и подсказкой для обхода (docs/specs/duels.md §7, решение плана №6).
//
// Режимы (как в docs/specs/duels-design/3-safety.md §2):
// - any   — корень где угодно, в том числе через разделители («х у й») — только грубые корни без ложных срабатываний;
// - start — с начала слова;
// - word  — только целое слово (короткие корни: «бок» не задевает «Бөкей», «секс» — «Сексенбай», «nazi» — «Nazira»).
// Корни пишем обычными буквами: сравнение идёт по скелету (moderation/skeleton.ts), поэтому «хуй» = «хуи», «ё» = «е»,
// казахские буквы = русские (қотақ → котак). Кириллические корни сравниваются с кириллическим скелетом, латинские — с латинским.
//
// Черновик составлен моделью (Claude) для этапа 16Д; носителем ru/kk не вычитан — отметить в CHANGELOG.
// Проверка на ложные срабатывания — tests/check-name.test.ts (200+ обычных имён, в том числе Бөкей, Хусаин, Хуршид,
// Сексенбай, Назира, Асель/Assel). Добавляя корень, прогоняй этот тест.

export type BlockMode = "any" | "start" | "word";
export type BlockLang = "ru" | "kk" | "en";
export type BlockCategory = "profanity" | "sexual" | "slur_ethnic" | "slur_other" | "drugs" | "violence_extremism" | "self_harm";

export interface BlockEntry {
  stem: string;
  lang: BlockLang;
  mode: BlockMode;
  cat: BlockCategory;
}

type Row = [stem: string, mode: BlockMode, cat: BlockCategory];

const P: BlockCategory = "profanity";
const S: BlockCategory = "sexual";
const E: BlockCategory = "slur_ethnic";
const O: BlockCategory = "slur_other";
const D: BlockCategory = "drugs";
const V: BlockCategory = "violence_extremism";
const H: BlockCategory = "self_harm";

const RU: Row[] = [
  // мат
  ["хуй", "any", P], ["хуе", "any", P], ["хуя", "any", P], ["хую", "any", P], ["хуил", "any", P],
  ["пизд", "any", P],
  ["ебат", "start", P], ["ебал", "start", P], ["ебан", "start", P], ["ебл", "start", P], ["ебну", "start", P],
  ["ебуч", "start", P], ["ебош", "start", P], ["ебись", "start", P],
  ["заеб", "start", P], ["выеб", "start", P], ["наеб", "start", P], ["проеб", "start", P], ["отъеб", "start", P],
  ["уеба", "start", P], ["уебо", "start", P], ["уебищ", "any", P], ["долбоеб", "any", P], ["распиздяй", "any", P],
  ["бляд", "any", P], ["блять", "any", P], ["бля", "word", P],
  ["сука", "word", P], ["суки", "word", P], ["сучка", "word", P], ["сучара", "any", P], ["сучий", "word", P],
  ["мудак", "any", P], ["мудил", "any", P], ["мудач", "any", P], ["мудозвон", "any", P],
  ["пидор", "any", O], ["пидар", "any", O], ["пидр", "any", O], ["педик", "word", O], ["педераст", "any", O], ["педрил", "any", O],
  ["гандон", "any", P], ["гондон", "any", P], ["залуп", "any", P], ["манда", "word", S], ["мандавош", "any", P],
  ["шлюх", "any", S], ["шалав", "any", S], ["проститут", "any", S],
  ["дерьм", "any", P], ["говн", "any", P], ["засран", "any", P], ["обосра", "any", P], ["срать", "word", P], ["сраный", "word", P],
  ["жоп", "start", P], ["жопа", "any", P], ["жопу", "any", P], ["жопе", "any", P], ["жопой", "any", P], ["жопн", "any", P],
  ["черножоп", "any", E],
  // сексуальное
  ["дроч", "any", S], ["минет", "any", S], ["секс", "word", S], ["сексуал", "any", S], ["трахат", "any", S], ["трахну", "any", S],
  ["порн", "any", S], ["оргазм", "any", S], ["сиськ", "any", S], ["член", "word", S], ["пенис", "any", S], ["вагин", "any", S],
  ["анал", "word", S], ["кончил", "word", S], ["шлюшк", "any", S],
  // оскорбления
  ["дебил", "any", O], ["идиот", "any", O], ["кретин", "any", O], ["даун", "word", O], ["олигофрен", "any", O],
  ["урод", "word", O], ["уроды", "word", O], ["чмо", "word", O], ["чмошн", "any", O], ["лох", "word", O], ["лохи", "word", O],
  ["лошара", "any", O], ["дура", "word", O], ["дурак", "word", O], ["тупица", "word", O], ["гнида", "word", O], ["мразь", "any", O],
  ["тварь", "word", O], ["сволоч", "any", O], ["ублюд", "any", O], ["выродок", "any", O], ["петух", "word", O], ["козел", "word", O],
  ["шмара", "any", S], ["овца", "word", O],
  // национальные оскорбления
  ["ниггер", "any", E], ["нигер", "word", E], ["негр", "word", E], ["негры", "word", E], ["негритос", "any", E],
  ["хач", "word", E], ["хачи", "word", E], ["хачик", "word", E], ["чурка", "word", E], ["чурки", "word", E], ["чурбан", "word", E],
  ["жид", "word", E], ["жиды", "word", E], ["жидяр", "any", E], ["жидовс", "any", E], ["хохол", "word", E], ["хохлы", "word", E],
  ["кацап", "any", E], ["москал", "start", E], ["узкоглаз", "any", E], ["чучмек", "any", E], ["черномаз", "any", E], ["чуркестан", "any", E],
  // наркотики
  ["нарко", "start", D], ["наркот", "any", D], ["героин", "word", D], ["кокаин", "any", D], ["марихуан", "any", D], ["гашиш", "any", D],
  ["спайс", "word", D], ["мефедрон", "any", D], ["закладчик", "any", D], ["анаша", "any", D],
  // насилие, экстремизм, самоповреждение
  ["убийц", "any", V], ["убью", "word", V], ["убить", "word", V], ["террор", "start", V], ["игил", "word", V], ["нацист", "any", V],
  ["фашист", "any", V], ["гитлер", "any", V], ["свастик", "any", V], ["скулшут", "any", V], ["колумбайн", "any", V],
  ["суицид", "any", H], ["самоубий", "any", H], ["повешусь", "any", H], ["вскрою", "word", H],
];

const KK: Row[] = [
  ["қотақ", "any", P], ["қотағ", "any", P], ["сік", "word", P], ["сікт", "start", P], ["сігей", "any", P], ["сігем", "start", P],
  ["сиктир", "any", P], ["амың", "word", P], ["амыңды", "any", P], ["амыңа", "start", P], ["шешеңді", "any", P], ["шешеңнің", "any", P],
  ["қаншық", "any", P], ["ақымақ", "any", O], ["ақмақ", "word", O], ["жалап", "any", S], ["боқ", "word", P], ["боқтық", "word", P],
  ["есек", "word", O], ["шошқа", "word", O], ["сасық", "word", O], ["жынды", "word", O], ["малғұн", "word", O], ["нашақор", "any", D],
  ["өлтір", "start", V], ["иттің", "word", O],
];

const EN: Row[] = [
  ["fuck", "any", P], ["fuk", "word", P], ["fck", "any", P], ["shit", "word", P], ["shitty", "word", P], ["bullshit", "any", P],
  ["shithead", "any", P], ["cunt", "any", P], ["dick", "word", P], ["dickhead", "any", P], ["cock", "word", S], ["cocksuck", "any", S],
  ["pussy", "any", S], ["bitch", "any", P], ["whore", "any", S], ["slut", "any", S], ["fag", "word", O], ["faggot", "any", O],
  ["nigger", "any", E], ["nigga", "any", E], ["retard", "any", O], ["porn", "any", S], ["sex", "word", S], ["sexy", "word", S],
  ["penis", "any", S], ["vagina", "any", S], ["dildo", "any", S], ["boobs", "word", S], ["tits", "word", S], ["ass", "word", P],
  ["asshole", "any", P], ["bastard", "any", P], ["wank", "any", S], ["piss", "start", P], ["cum", "word", S], ["anal", "word", S],
  ["anus", "word", S], ["milf", "any", S], ["xxx", "word", S], ["jizz", "any", S], ["horny", "word", S], ["blowjob", "any", S],
  ["nazi", "word", V], ["hitler", "any", V], ["kill", "word", V], ["killer", "word", V], ["rape", "word", V], ["rapist", "any", V],
  ["terrorist", "any", V], ["suicide", "any", H], ["cocaine", "any", D], ["heroin", "word", D], ["weed", "word", D],
  // транслит русского мата и оскорблений
  ["hui", "word", P], ["huy", "word", P], ["huj", "word", P], ["xui", "word", P], ["xuy", "word", P], ["huesos", "any", P],
  ["pizd", "any", P], ["pisd", "any", P], ["blyat", "any", P], ["blyad", "any", P], ["bliat", "any", P], ["blya", "word", P],
  ["suka", "word", P], ["suki", "word", P], ["eban", "start", P], ["ebat", "start", P], ["ebal", "start", P], ["ebla", "start", P],
  ["zaeb", "start", P], ["pidor", "any", O], ["pidar", "any", O], ["pidr", "any", O], ["mudak", "any", P], ["mudil", "any", P],
  ["gandon", "any", P], ["gondon", "any", P], ["zalup", "any", P], ["shluh", "any", S], ["shlyuh", "any", S], ["dolboeb", "any", P],
  ["nahui", "any", P], ["nahuy", "any", P], ["nahuj", "any", P], ["zhopa", "any", P], ["jopa", "word", P], ["govno", "any", P],
  ["chmo", "word", O], ["debil", "any", O], ["chlen", "word", S], ["shalava", "any", S],
  // транслит казахского
  ["qotaq", "any", P], ["kotak", "any", P], ["sigei", "any", P], ["sigey", "any", P], ["siktir", "any", P], ["qanshyq", "any", P],
  ["kanshyk", "any", P], ["aqymaq", "any", O], ["akymak", "any", O], ["zhalap", "any", S],
];

const rows = (lang: BlockLang, list: Row[]): BlockEntry[] => list.map(([stem, mode, cat]) => ({ stem, lang, mode, cat }));

/** Весь список корней. */
export const BLOCKLIST: readonly BlockEntry[] = [...rows("ru", RU), ...rows("kk", KK), ...rows("en", EN)];
