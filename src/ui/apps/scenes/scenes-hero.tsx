/**
 * "Continue your story": the hero card (the current filter's most recent scene, in the same
 * fixed-size backdrop-face shape every card uses, 1.6x the size) beside its preview panel, which
 * loads the scene's last couple of live messages (sceneTail, P2 data) itself. No summary data
 * exists yet, so the preview ships a single message slide with no pips or arrows - a second slide
 * can slot in later without changing this shape. A failed or slow tail load never blocks the hero
 * card itself from rendering and opening the scene.
 *
 * KNOWN GAP (P3b item 1, reported rather than silently patched): each message runs through Prose
 * (paragraphs, *italic actions*, "colored speech") and is clamped to 4 lines with a bottom fade, but
 * NOT through chatDisplay's macro engine the way scene-page.tsx renders the same text. chatDisplay
 * needs the frozen character/persona snapshot body (examples, prompts, description, scenario); the
 * light sceneTail endpoint this preview calls (P2 data, by design never opens the whole scene) hands
 * back only `{ id, role, speaker, text }`, with no snapshot. Running chatDisplay here honestly would
 * mean either widening SceneTailMessage's wire shape (a change to src/studio/scenes.ts::sceneTail,
 * outside this plan's "accent field only" scope for that file) or calling ctx.api.openScene per hero
 * mount (the full take, against the P2 design's own reason for a separate light endpoint, and while a
 * parallel run is measuring this list's performance). A raw `{{macro}}` - most likely the greeting,
 * which is stored unprocessed - can still show literally here until that is resolved.
 *
 * stripReasoningTags needs no snapshot (unlike chatDisplay's macro pass), so it runs here directly:
 * an inline <think> block from an imported SillyTavern message never reaches this preview either.
 */
import { useEffect, useState, type CSSProperties, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { SceneSummary, SceneTailMessage } from "../../../studio/scenes";
import { useAccentVars } from "../../_shared/use-scoped-accents";
import { stripReasoningTags } from "../../../core/reasoning-tags";
import { SceneArt } from "./scene-art";
import { Prose } from "./prose";
import { since, takePips } from "./scenes-core";
import { Card } from "../../components/button";

function PreviewSlide({ tail }: { tail: SceneTailMessage[] }): JSX.Element {
  return (
    <div className="pv-slide on">
      {tail.map((m) => (
        <div className="pv-msg" key={m.id}>
          <span className={`av${m.role === "user" ? " you" : ""}`}>{(m.speaker.trim().charAt(0) || "?").toUpperCase()}</span>
          <div className="pv-msg-tx">
            <b>{m.speaker}</b>
            <div className="pv-msg-clamp"><Prose text={stripReasoningTags(m.text)} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SceneHero({ ctx, scene, picked, onOpen }: { ctx: AppContext; scene: SceneSummary; picked?: boolean; onOpen(): void }): JSX.Element {
  const accentVars = useAccentVars();
  const [tail, setTail] = useState<SceneTailMessage[] | null>(null);
  useEffect(() => {
    let live = true;
    setTail(null);
    if (scene.castMissing) return; // nothing to preview: the card is gone and the server would refuse
    ctx.api.getSceneTail(scene.id, 2).then(
      (t) => { if (live) setTail(t); },
      () => { if (live) setTail([]); }, // a failed load leaves the preview art-only, never the page broken
    );
    return () => { live = false; };
  }, [ctx.api, scene.id, scene.castMissing]);

  const { pips, overflow } = takePips(scene.takeCount);
  const label = scene.activeTake.original ? "Director's Cut" : scene.activeTake.name;
  const tone = accentVars(scene.accent ?? "var(--accent)") as CSSProperties;

  return (
    <div className="stagerow" data-part="scenes.hero" style={tone}>
      <Card kind="art" data-part="scenes.hero.open" selected={picked} aria-pressed={picked} onClick={onOpen}>
        <div className="art"><SceneArt ctx={ctx} chatId={scene.id} characterId={scene.cast.character.id} snapshotVersion={scene.snapshotVersion} hasArt={scene.hasPortrait} name={scene.characterName} /></div>
        <span className="badge"><span className="dot" />Live</span>
        <div className="hero-ov">
          <span className="s-act"><b>Continue your story</b></span>
          <h2>{scene.title}</h2>
          <p className="sub">{scene.characterName} &middot; {label}</p>
          {scene.takeCount > 1 && (
            <div className="hero-pips">
              {Array.from({ length: pips }, (_, i) => <span key={i} className={(scene.activeTake.original ? i === 0 : i === pips - 1) ? "on" : undefined} />)}
              {overflow > 0 && <span className="over">+{overflow}</span>}
            </div>
          )}
          <div className="hero-stats">
            <b>{scene.messageCount} {scene.messageCount === 1 ? "msg" : "msgs"}</b><span>&middot;</span><span>{since(scene.updatedAt, Date.now())}</span>
            {scene.takeCount > 1 && <><span>&middot;</span><b>{scene.takeCount} takes</b></>}
          </div>
          <span className="s-btn">Continue Story</span>
        </div>
      </Card>

      <Card kind="art" data-part="scenes.hero.preview" onClick={onOpen}>
        <div className="art" />
        {tail && tail.length > 0 && <PreviewSlide tail={tail} />}
      </Card>
    </div>
  );
}
