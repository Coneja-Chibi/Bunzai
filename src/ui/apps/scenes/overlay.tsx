/** Scenes overlay: recent scenes with the existing handoff; loading and failures remain explicit. */
import { useEffect, useState } from "react";
import type { OverlayWidgetProps } from "../../app-contract";
import { Button, ListRow } from "../../components/button";
import { OverlayWidget } from "../../components/overlay-widget";
import { handOffScene } from "../../_shared/scene-handoff";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const [scenes, setScenes] = useState<Awaited<ReturnType<OverlayWidgetProps["ctx"]["api"]["listScenes"]>> | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { let cancelled = false; void ctx.api.listScenes().then((rows) => { if (!cancelled) setScenes(rows); }, () => { if (!cancelled) setFailed(true); }); return () => { cancelled = true; }; }, [ctx.api]);
  return <OverlayWidget title="Pick up a story">{failed ? <p>Recent scenes could not be loaded. Return to Scenes to retry.</p> : !scenes ? <p>Loading recent scenes...</p> : <>
    <ul>{scenes.slice(0, 4).map((scene) => <li key={scene.id}><ListRow onClick={() => { handOffScene(scene.id); onActivate(); }} label={scene.title} subtitle="Continue this scene" trailing={<span aria-hidden="true">Play</span>} /></li>)}</ul>
    {!scenes.length && <p>No scenes yet. Start a story from a character in the Library.</p>}</>}
    <Button onClick={() => { handOffScene(null); onActivate(); }}>Browse all scenes</Button></OverlayWidget>;
}
