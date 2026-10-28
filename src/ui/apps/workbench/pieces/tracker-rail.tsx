/**
 * The tracker editor's rail: what the AI gets. Prompt is the exact text it reads each turn (the real render at the tracker's starting values),
 * the plain line a blank prompt line falls back to, and the cost; Update tool is the tracker's exact line inside the shared update tool.
 */
import { useMemo, useState, type JSX } from "react";
import type { TrackerBody } from "../../../../entities/tracker/schema";
import { Tabs } from "../../../components/button";
import { trackerPreview } from "./tracker-prompt";
import s from "./piece.module.css";

type View = "prompt" | "tool";

export function TrackerRail({ body }: { body: TrackerBody }): JSX.Element {
  const [view, setView] = useState<View>("prompt");
  const preview = useMemo(() => trackerPreview(body), [body]);
  return (
    <aside className={s.rail} aria-label="What the AI gets" data-part="piece.tracker.rail">
      <Tabs label="What the AI gets" value={view} onChange={setView} items={[{ value: "prompt", label: "Prompt" }, { value: "tool", label: "Update tool" }]} />
      {view === "prompt" ? (
        <>
          <div className={s.label}>The AI reads this every turn</div>
          <pre className={s.prose} aria-label="Prompt text">{preview.text}</pre>
          {preview.blocking && <p className={s.problem} role="status">The prompt line has a problem: {preview.blocking}</p>}
          {preview.others.length > 0 && <p className={s.hint}>It reads {preview.others.join(", ")}, which shows once that tracker is linked in the scene.</p>}
          <p className={s.hint}>With the prompt line blank it would read: <span className={s.mono}>{preview.plain}</span></p>
        </>
      ) : (
        <>
          <div className={s.label}>Its line in update_trackers</div>
          <pre className={s.code} aria-label="Update tool line">{preview.toolLine}</pre>
          <p className={s.hint}>Every linked tracker shares one update tool, so linking more trackers adds a line, not a tool.</p>
        </>
      )}
      <div className={s.cost}><span>Adds to every reply</span><b>~{preview.tokens}</b></div>
    </aside>
  );
}
