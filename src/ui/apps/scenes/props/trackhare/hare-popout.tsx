/**
 * TrackHare's lore trace as a pop-out kind: the latest reply's fired entries, recalled entries and Didn't-fire section in a floating
 * panel that stays up with the popover shut. It reads the trace itself and follows the viewer's TrackHare options (the same
 * `trackhare.*` prefs the options card writes), so it is the popover's body, not a copy of its rules.
 */
import { useEffect, useState, type JSX } from "react";
import { boolOr } from "../../../../../core/guards";
import type { PopoutContext, PopoutKind } from "../../popout/popout-kind";
import { HareHits } from "./hare-hits";
import { parseDensity, parseSort } from "./hare-core";
import type { TraceState } from "./hare-popover";

function HareTracePane({ ctx, chat }: PopoutContext): JSX.Element {
  const [got, setGot] = useState<TraceState>({ state: "loading" });
  useEffect(() => {
    let live = true;
    ctx.api.getSceneTrace(chat.id).then(
      (trace) => { if (live) setGot({ state: "ready", trace }); },
      (e: unknown) => { if (live) setGot({ state: "failed", why: e instanceof Error && e.message ? e.message : "TrackHare couldn't read this reply." }); },
    );
    return () => { live = false; };
  }, [ctx.api, chat.id, chat.updatedAt, chat.activeBranchId]);
  const density = parseDensity(ctx.prefs.get("trackhare.density"));
  return (
    <div className={`hare-trace${density === "compact" ? " compact" : ""}`} data-part="props.trackhare.trace">
      {got.state === "loading" && <div className="hare-none">Loading...</div>}
      {got.state === "failed" && <div className="hare-err">{got.why}</div>}
      {got.state === "ready" && got.trace === null && <div className="hare-none">No reply yet.</div>}
      {got.state === "ready" && got.trace && (
        <HareHits trace={got.trace} group={boolOr(ctx.prefs.get("trackhare.group"), true)} sort={parseSort(ctx.prefs.get("trackhare.sort"))} showMisses={boolOr(ctx.prefs.get("trackhare.misses"), true)} />
      )}
    </div>
  );
}

export const hareTracePopout: PopoutKind = {
  id: "trackhare.trace",
  title: "TrackHare",
  noun: "Lore trace",
  icon: "lucide:puzzle",
  top: 160,
  render: (c) => <HareTracePane {...c} />,
};
