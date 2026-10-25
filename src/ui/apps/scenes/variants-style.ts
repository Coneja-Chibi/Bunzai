/**
 * Every scene variant's stylesheet (variants/<surface>/<variant>.ts), concatenated for the Scenes app's
 * one <style>. A variant matches only when the painter has set its root attribute, so an unpicked
 * variant costs bytes and nothing else.
 */
import chatThread from "./variants/scene.layout/chat-thread";
import manuscript from "./variants/scene.layout/manuscript";
import stageColumn from "./variants/scene.layout/stage-column";
import vnStage from "./variants/scene.layout/vn-stage";
import bubble from "./variants/scene.message/bubble";
import prose from "./variants/scene.message/prose";
import screenplay from "./variants/scene.message/screenplay";
import vnBox from "./variants/scene.message/vn-box";
import chatInput from "./variants/scene.composer/chat-input";
import commandBox from "./variants/scene.composer/command-box";
import promptLine from "./variants/scene.composer/prompt-line";
import typewriterLine from "./variants/scene.composer/typewriter-line";
import arrowsCount from "./variants/scene.swipes/arrows-count";
import dots from "./variants/scene.swipes/dots";
import keyChips from "./variants/scene.swipes/key-chips";
import marginNumbers from "./variants/scene.swipes/margin-numbers";
import drawer from "./variants/scene.wings/drawer";
import marginalia from "./variants/scene.wings/marginalia";
import pauseMenu from "./variants/scene.wings/pause-menu";
import sideCurtain from "./variants/scene.wings/side-curtain";
import chips from "./variants/scene.hud/chips";
import footnotes from "./variants/scene.hud/footnotes";
import fullHud from "./variants/scene.hud/full-hud";
import quietLine from "./variants/scene.hud/quiet-line";
import footnote from "./variants/scene.reasoning/footnote";
import programNote from "./variants/scene.reasoning/program-note";
import slabNote from "./variants/scene.reasoning/slab-note";
import slotTab from "./variants/scene.reasoning/slot-tab";

export const SCENE_VARIANTS_STYLE = [
  stageColumn, vnStage, chatThread, manuscript, prose, vnBox, bubble, screenplay,
  promptLine, commandBox, chatInput, typewriterLine, arrowsCount, keyChips, dots, marginNumbers,
  sideCurtain, pauseMenu, drawer, marginalia, quietLine, fullHud, chips, footnotes,
  programNote, slotTab, slabNote, footnote,
].join("\n");
