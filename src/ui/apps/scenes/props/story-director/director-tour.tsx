/**
 * The first-use note (RoleCall's DMTourOverlay, tutorial/DMTourOverlay.tsx, six steps over the panel): shown once at the top of the panel as a dismissible strip rather than an overlay, with the
 * same words. "Got it" is remembered for the viewer (a per-user pref, like the Props wing's Tooltips switch).
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import { Button } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";

export const TOUR_PREF = "scenes.director.tour";

const STEPS: readonly { title: string; message: string }[] = [
  { title: "Story Overview", message: "See the current chapter, mood, and the DM's intentions at a glance. This is your dashboard for what's happening in the story right now." },
  { title: "Story Arcs", message: "Track active storylines. The DM creates and advances arcs automatically based on the conversation. You can also resolve arcs manually when a storyline concludes." },
  { title: "Turn Analysis", message: "After each turn, the DM analyzes what happened: seeds planted, payoffs delivered, unexpected developments. Check here to see the DM's perspective on the story." },
  { title: "Debug & Shadow World", message: "The Debug tab shows the DM's hidden state: shadow world events, planted seeds, and invisible arcs. Peek behind the curtain to see what the DM is planning!" },
];

export function DirectorTour({ ctx }: { ctx: AppContext }): JSX.Element | null {
  const [seen, setSeen] = useState(() => ctx.prefs.get(TOUR_PREF) === true);
  if (seen) return null;
  const dismiss = (): void => { setSeen(true); ctx.prefs.set(TOUR_PREF, true); };
  return (
    <aside className="dr-tour" role="note" aria-label="Meet the Story Director" data-part="scene.director.tour">
      <Ic name="mdi:drama-masks" size={16} />
      <div>
        <b>Meet the Story Director</b>
        <p>The Story Director is your AI co-pilot for narrative management. It tracks story arcs, plants foreshadowing, and guides the narrative behind the scenes, like a real tabletop game master.</p>
        <ul>{STEPS.map((s) => <li key={s.title}><b>{s.title}.</b> {s.message}</li>)}</ul>
        <p>You're Ready! The Story Director works in the background. Just chat naturally and it'll weave the narrative threads, track your arcs, and make sure no storyline gets forgotten!</p>
      </div>
      <Button variant="primary" size="sm" onClick={dismiss}>Got it</Button>
    </aside>
  );
}
