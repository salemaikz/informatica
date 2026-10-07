import { Composition, Folder } from "remotion";
import { TeachReel, MemeReel, InviteReel, TeachHookScene, TeachStringScene, TeachRuleScene, TeachCompareScene, MemeSetupScene, MemeErrorScene, MemeIndexScene, MemeFixedScene, InviteHelloScene, InviteLessonScene, InviteQuestionScene, InviteCtaScene } from "./instagram";
import { ShelfLesson, NotebookLesson, DetectiveLesson, ShelfIndicesScene, ShelfLastScene, ShelfSliceScene, ShelfErrorScene, NotebookIndicesScene, NotebookLastScene, NotebookSliceScene, NotebookErrorScene, DetectiveIndicesScene, DetectiveLastScene, DetectiveSliceScene, DetectiveErrorScene } from "./lessons";

export function VariantsRoot() {
  return <>
    <Folder name="Lessons">
      <Composition id="ShelfLesson" component={ShelfLesson} fps={30} width={1080} height={1080} durationInFrames={900} defaultProps={{ lang: "ru" }} />
      <Composition id="NotebookLesson" component={NotebookLesson} fps={30} width={1080} height={1080} durationInFrames={900} defaultProps={{ lang: "ru" }} />
      <Composition id="DetectiveLesson" component={DetectiveLesson} fps={30} width={1080} height={1080} durationInFrames={900} defaultProps={{ lang: "ru" }} />
    </Folder>
    <Folder name="Lesson-Scenes">
      <Composition id="ShelfIndices" component={ShelfIndicesScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="ShelfLast" component={ShelfLastScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="ShelfSlice" component={ShelfSliceScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="ShelfError" component={ShelfErrorScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="NotebookIndices" component={NotebookIndicesScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="NotebookLast" component={NotebookLastScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="NotebookSlice" component={NotebookSliceScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="NotebookError" component={NotebookErrorScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="DetectiveIndices" component={DetectiveIndicesScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="DetectiveLast" component={DetectiveLastScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="DetectiveSlice" component={DetectiveSliceScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
      <Composition id="DetectiveError" component={DetectiveErrorScene} fps={30} width={1080} height={1080} durationInFrames={225} defaultProps={{ lang: "ru" }} />
    </Folder>
    <Folder name="Instagram">
      <Composition id="InstagramTeachBool" component={TeachReel} fps={30} width={1080} height={1920} durationInFrames={600} defaultProps={{ lang: "ru", music: false }} />
      <Composition id="InstagramMemeIndex" component={MemeReel} fps={30} width={1080} height={1920} durationInFrames={600} defaultProps={{ lang: "ru", music: false }} />
      <Composition id="InstagramInviteBit" component={InviteReel} fps={30} width={1080} height={1920} durationInFrames={600} defaultProps={{
        lang: "ru",
        music: false,
      }} />
    </Folder>
    <Folder name="Instagram-Scenes">
      <Composition id="TeachHook" component={TeachHookScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="TeachString" component={TeachStringScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="TeachRule" component={TeachRuleScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="TeachCompare" component={TeachCompareScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="MemeSetup" component={MemeSetupScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="MemeError" component={MemeErrorScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="MemeIndex" component={MemeIndexScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="MemeFixed" component={MemeFixedScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="InviteHello" component={InviteHelloScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="InviteLesson" component={InviteLessonScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="InviteQuestion" component={InviteQuestionScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
      <Composition id="InviteCta" component={InviteCtaScene} fps={30} width={1080} height={1920} durationInFrames={150} defaultProps={{ lang: "ru" }} />
    </Folder>
  </>;
}
