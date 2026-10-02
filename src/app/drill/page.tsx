import { DrillScreen } from "./DrillScreen";

// Тренировка: ?mode=smart | mistakes | skill&skill=ns.dec2bin
export default async function DrillPage(props: PageProps<"/drill">) {
  const sp = await props.searchParams;
  const mode = sp.mode === "mistakes" || sp.mode === "skill" ? sp.mode : "smart";
  const skill = typeof sp.skill === "string" ? sp.skill : undefined;
  return <DrillScreen mode={mode} skill={skill} />;
}
