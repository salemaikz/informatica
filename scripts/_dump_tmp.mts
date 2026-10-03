const f = process.argv[2];
const m = await import(`/home/user/informatica/src/content/ent/${f}.ts`);
const s = (x: any) => typeof x === "string" ? x : x && x.ru !== undefined ? `RU: ${x.ru} | KK: ${x.kk}` : JSON.stringify(x);
for (const it of m.ITEMS) {
  console.log(`## ${it.id} [${it.kind}]`);
  console.log(`Q: ${s(it.prompt)}`);
  if (it.options) it.options.forEach((o: any, i: number) => console.log(`  ${i}${(Array.isArray(it.correct)?it.correct.includes(i):it.correct===i)?"*":" "} ${s(o)}`));
  if (it.pairs) console.log(`  pairs: ${JSON.stringify(it.pairs)}`);
  if (it.left) console.log(`  left: ${JSON.stringify(it.left)} right: ${JSON.stringify(it.right)} correct: ${JSON.stringify(it.correct)}`);
  if (!it.options && !it.left) console.log(`  rest: ${JSON.stringify({...it, prompt:undefined, explanation:undefined, hint:undefined, whyWrong:undefined})}`);
  console.log(`E: ${s(it.explanation)}`);
  console.log(`H: ${s(it.hint)}`);
}
