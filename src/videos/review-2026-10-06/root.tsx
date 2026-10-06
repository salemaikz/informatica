import { Composition, registerRoot } from "remotion";
import { RangeVideo } from "./RangeVideo";
import { LogicVideo } from "./LogicVideo";

function ReviewRoot() {
  return <>
    <Composition id="PythonRange" component={RangeVideo} fps={30} width={1080} height={1080} durationInFrames={1200} defaultProps={{ lang: "ru" }} />
    <Composition id="LogicClub" component={LogicVideo} fps={30} width={1080} height={1080} durationInFrames={1320} defaultProps={{ lang: "ru" }} />
  </>;
}
registerRoot(ReviewRoot);
