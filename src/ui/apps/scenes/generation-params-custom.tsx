/**
 * Custom Request Parameters (RoleCall's collapsible under the groups, SamplerPanel.tsx:1348-1424):
 * headers to add, body fields to add, and body fields to remove. Each box checks its text as it is
 * typed and saves only text that holds up, so a bad box is said here and never sent. Deviation from
 * RoleCall: JSON only, and the request's own fields (model, messages, stream, tools) cannot be set
 * or removed. A header's value never shows outside this box.
 */
import { useState, type JSX } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { customProblem } from "../../../stage/params/custom";
import type { SceneGeneration } from "../../../stage/params/scene";

type Field = "customHeaders" | "customBody" | "customExclude";

const FIELDS: readonly { key: Field; kind: "headers" | "body" | "exclude"; label: string; icon: IconName; rows: number; placeholder: string; note?: string }[] = [
  { key: "customHeaders", kind: "headers", label: "Include Request Headers", icon: "mdi:web", rows: 3, placeholder: '{"x-custom-header": "my-value"}' },
  { key: "customBody", kind: "body", label: "Include Body Parameters", icon: "mdi:code-json", rows: 3, placeholder: '{"top_k": 40, "custom_param": "value"}' },
  { key: "customExclude", kind: "exclude", label: "Exclude Body Parameters", icon: "mdi:close-circle-outline", rows: 2, placeholder: "temperature\ntop_p", note: "List parameter names to remove from the request body, one per line." },
];

function Box({ f, saved, onSave }: { f: (typeof FIELDS)[number]; saved: string; onSave(text: string): void }): JSX.Element {
  const [text, setText] = useState(saved);
  const problem = customProblem(f.kind, text);
  const edit = (next: string): void => {
    setText(next);
    if (customProblem(f.kind, next) === null) onSave(next);
  };
  return (
    <div className="gp-cfield">
      <label className="gp-clabel"><Ic name={f.icon} size={14} />{f.label}</label>
      <textarea className="gp-ta mono" rows={f.rows} value={text} placeholder={f.placeholder} aria-label={f.label} aria-invalid={problem !== null} onChange={(e) => edit(e.target.value)} />
      {problem ? <div className="gp-hint bad" role="alert">{problem} Not saved.</div> : f.note && <div className="gp-hint">{f.note}</div>}
    </div>
  );
}

export function CustomRequestParams({ samplers, onSave }: { samplers: SceneGeneration; onSave(key: Field, text: string): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="gp-group gp-custom" data-part="scene.generation.custom">
      <button type="button" className="gp-ghead" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Ic name="mdi:code-braces" size={16} />
        <span className="gp-ctitle">Custom Request Parameters</span>
        <span className="gp-ctag">Advanced</span>
        <Ic name={open ? "mdi:chevron-up" : "mdi:chevron-down"} size={16} />
      </button>
      {open && (
        <div className="gp-cbody">
          <p className="gp-hint">Add HTTP headers and body parameters to each API request. Use a JSON object. The request&apos;s own fields (model, messages, stream, tools) cannot be set or removed.</p>
          {FIELDS.map((f) => <Box key={f.key} f={f} saved={samplers[f.key] ?? ""} onSave={(t) => onSave(f.key, t)} />)}
        </div>
      )}
    </div>
  );
}
