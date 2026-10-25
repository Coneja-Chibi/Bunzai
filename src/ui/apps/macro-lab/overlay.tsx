/** Macro Lab overlay: real engine availability, without running any draft or imported macro. */
import { useEffect, useState } from "react";
import type { MacroEngineInfo, OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const [engines, setEngines] = useState<MacroEngineInfo[] | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { let cancelled = false; void ctx.api.macroEngines().then((out) => { if (!cancelled) setEngines(out.engines); }, () => { if (!cancelled) setFailed(true); }); return () => { cancelled = true; }; }, [ctx.api]);
  return <OverlayWidget title="Macro engine bench"><pre>{"{{user}}  {{char}}\nMacro text stays text until you run the test bench."}</pre>
    {failed ? <p>Engine availability could not be checked.</p> : !engines ? <p>Checking installed engines...</p> : <ul>{engines.map((engine) => <li key={engine.id}>{engine.label}<small>Available on this host</small></li>)}{!engines.length && <li>No test engines installed.</li>}</ul>}
    <button onClick={onActivate}>Return to macro testing</button></OverlayWidget>;
}
