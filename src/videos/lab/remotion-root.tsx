import { Composition, registerRoot } from "remotion";
import { LabVideo } from "./Video";
import { FPS, SIZE, STYLES } from "./registry";
import { durationFor } from "./timing";
function Root() {
  return <>{STYLES.map(({ id }) => <Composition key={id} id={id} component={LabVideo} width={SIZE} height={SIZE} fps={FPS} durationInFrames={durationFor(id)} defaultProps={{ variant: id, lang: "ru" as const, subtitles: false }} />)}</>;
}
registerRoot(Root);
