/**
 * Catch thinking (RoleCall's CatchThinkingSection.tsx): what the display moves out of a reply into Behind the
 * Scene. Auto, Only these, Off. The lists are kept when the mode changes, so going back to Only these finds
 * your tags where you left them. The rules are core/reasoning-capture.ts's, read by every display of a reply.
 * RoleCall's Auto also infers a "Thinking:" heading and untagged thinking and can ask a helper model (Smart
 * Recovery); Bunraku does not, so its help text does not promise them.
 */
import type { JSX } from "react";
import { Button, Chip, Segmented } from "../../../components/button";
import { BUILTIN_CAPTURE_OPTIONS, CAPTURE_MAX_CUSTOM, CAPTURE_MAX_LENGTH, DEFAULT_ONLY_BUILTIN_TAGS, closingForOpening, normalizeCapture, prefillTag, type CaptureDelimiter, type CaptureMode, type ReasoningCapture } from "../../../../core/reasoning-capture";

const MODE_HELP: Record<CaptureMode, string> = {
  auto: "catches your Start Reply With tag, other thinking tags like <think> or <scratchpad>, tags that look like them, and tags that never close. Best if you want thinking kept out of the reply no matter what.",
  only: "catches exactly the tags below and nothing else. No look-alike names, no unclosed tags. Everything else stays in the reply exactly as written.",
  off: "nothing is taken out of the reply. You see exactly what the model wrote. Reasoning the provider sends separately (Claude, DeepSeek and similar) still shows in its own box, because it was never part of the reply.",
};
const MODE_LABEL: Record<CaptureMode, string> = { auto: "Auto", only: "Only these", off: "Off" };

/** The capture policy after the mode is changed: Only these starts from the Start Reply With tag and the common built-in tags when nothing was kept (one rule, shared by the Generation tab and the Messenger settings). */
export function captureWithMode(value: ReasoningCapture | undefined, prefill: string | undefined, mode: CaptureMode): ReasoningCapture {
  const policy: ReasoningCapture = value ? { ...normalizeCapture(value), custom: value.custom } : normalizeCapture(undefined);
  if (mode === "only" && policy.custom.length === 0 && policy.builtinTags.length === 0) {
    const own = prefillTag(prefill);
    return { mode, custom: own?.close ? [{ open: own.open, close: own.close }] : [], builtinTags: [...DEFAULT_ONLY_BUILTIN_TAGS] };
  }
  return { ...policy, mode };
}

export function CatchThinking({ value, prefill, onChange }: { value: ReasoningCapture | undefined; prefill: string | undefined; onChange(next: ReasoningCapture): void }): JSX.Element {
  // Own rows still being typed (blank) are kept, which normalizing would drop.
  const policy: ReasoningCapture = value ? { ...normalizeCapture(value), custom: value.custom } : normalizeCapture(undefined);
  const picked = new Set(policy.builtinTags);
  const selectMode = (mode: CaptureMode): void => { if (mode !== policy.mode) onChange(captureWithMode(value, prefill, mode)); };
  const setCustom = (custom: CaptureDelimiter[]): void => onChange({ ...policy, custom });
  const updateRow = (index: number, patch: Partial<CaptureDelimiter>): void => setCustom(policy.custom.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const toggle = (tag: string): void => {
    const next = new Set(picked);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    onChange({ ...policy, builtinTags: BUILTIN_CAPTURE_OPTIONS.filter((t) => next.has(t)) });
  };
  return (
    <div className="gn-catch" data-part="scene.generation.catch">
      <div className="gn-ch"><span id="catch-thinking-label">Catch thinking</span><small>what goes in Behind the Scene</small></div>
      <Segmented label="Catch thinking" items={(Object.keys(MODE_LABEL) as CaptureMode[]).map((mode) => ({ value: mode, label: MODE_LABEL[mode] }))} value={policy.mode} onChange={selectMode} />
      <p className="gn-copy"><b>{MODE_LABEL[policy.mode]}:</b> {MODE_HELP[policy.mode]}</p>
      {policy.mode === "only" && (
        <div className="gn-only">
          <div className="gn-own">
            <span className="gn-cap">Your own tags</span>
            {policy.custom.length > 0 && <div className="gn-row gn-colh"><span>Opens with</span><span>Closes with</span><span className="sr-only">Remove</span></div>}
            {policy.custom.map(/* bounded-ok: fixed category set, per-item detail, capped or short by construction */ (row, index) => (
              <div key={index} className="gn-row">
                <input type="text" className="gn-in" value={row.open} maxLength={CAPTURE_MAX_LENGTH} aria-label={`Opening text ${index + 1}`} placeholder="<plan>"
                  onChange={(e) => {
                    const open = e.target.value;
                    // Fill the matching closer while it is empty or was the automatic one, so <plan> brings </plan> along.
                    const close = !row.close || row.close === closingForOpening(row.open) ? closingForOpening(open) || row.close : row.close;
                    updateRow(index, { open, close });
                  }} />
                <input type="text" className="gn-in" value={row.close} maxLength={CAPTURE_MAX_LENGTH} aria-label={`Closing text ${index + 1}`} placeholder="</plan>" onChange={(e) => updateRow(index, { close: e.target.value })} />
                <Button variant="danger" size="sm" aria-label={`Remove tag ${index + 1}`} onClick={() => setCustom(policy.custom.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            ))}
            {policy.custom.length < CAPTURE_MAX_CUSTOM && <Button variant="quiet" size="sm" onClick={() => setCustom([...policy.custom, { open: "", close: "" }])}>+ Add your own tag</Button>}
            <p className="gn-sub">Any text works, not just &lt;tags&gt;, for example Status: and ---. Type an opening tag and its closing tag fills in for you.</p>
          </div>
          <div className="gn-own">
            <div className="gn-pickh"><span className="gn-cap">Built-in thinking tags</span>
              <span className="gn-sub">{picked.size} of {BUILTIN_CAPTURE_OPTIONS.length} picked{" · "}
                <Button variant="quiet" size="sm" onClick={() => onChange({ ...policy, builtinTags: [...BUILTIN_CAPTURE_OPTIONS] })}>All</Button>{" · "}
                <Button variant="quiet" size="sm" onClick={() => onChange({ ...policy, builtinTags: [] })}>None</Button></span></div>
            <div className="gn-chips">
              {BUILTIN_CAPTURE_OPTIONS.map((tag) => <Chip key={tag} pressed={picked.has(tag)} onClick={() => toggle(tag)}>{picked.has(tag) ? "+ " : ""}{tag}</Chip>)}
            </div>
            <p className="gn-sub">Tap a tag to catch it or stop catching it. Each one catches its opening and matching closing tag, like &lt;think&gt; ... &lt;/think&gt;.</p>
          </div>
          {policy.custom.every((r) => !r.open.trim() || !r.close.trim()) && picked.size === 0 && (
            <p role="status" className="gn-warn">Nothing is picked, so nothing will be caught. Add a tag or pick a built-in one.</p>
          )}
        </div>
      )}
    </div>
  );
}
