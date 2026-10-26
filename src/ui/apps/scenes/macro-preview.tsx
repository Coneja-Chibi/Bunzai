/**
 * The macro syntax preview under a prompt's text (RoleCall's MacroSyntaxPreview, PresetPanel.tsx:3697-3852): a read-only copy with every `{{macro::arg}}`
 * coloured, hidden when the text holds none. Display only, nothing is evaluated (ADR-012). It can be dragged taller (80 to 640, saved) and opened over the
 * whole scene.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { IconButton } from "../../components/button";
import { FullscreenLayer } from "./fullscreen-layer";
import { PREVIEW_HEIGHT, parseSize } from "./size-core";
import { SplitGrip } from "./split-grip";

export type MacroPart = { kind: "text" | "macro"; value: string };

/** The text cut at its `{{...}}` pairs, in order. */
export function macroParts(content: string): MacroPart[] {
  const parts: MacroPart[] = [];
  let last = 0;
  for (const m of content.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: "text", value: content.slice(last, at) });
    parts.push({ kind: "macro", value: m[1]! });
    last = at + m[0].length;
  }
  if (last < content.length) parts.push({ kind: "text", value: content.slice(last) });
  return parts;
}

export function MacroPreview({ content, prefs }: { content: string; prefs: AppContext["prefs"] }): JSX.Element | null {
  const [height, setHeight] = useState(() => parseSize(PREVIEW_HEIGHT, prefs.get(PREVIEW_HEIGHT.key)));
  const [open, setOpen] = useState(false);
  const parts = macroParts(content);
  const count = parts.filter((p) => p.kind === "macro").length;
  if (count === 0) return null;
  const head = (
    <div className="mp-hd">
      <span className="mp-t">Macro Preview</span>
      <span className="mp-n">{count} {count === 1 ? "macro" : "macros"}</span>
      <IconButton variant="quiet" size="sm" label={open ? "Collapse macro preview" : "Expand macro preview"} icon={open ? "lucide:minimize-2" : "lucide:maximize-2"} onClick={() => setOpen(!open)} />
    </div>
  );
  const body = (
    <div className="mp-body"><pre>{parts.map((p, i) => {
      if (p.kind === "text") return <span key={i}>{p.value}</span>;
      return <span key={i} className="mp-m"><span className="mp-b">{"{{"}</span>{p.value.split(/(::)/).map((seg, j) => (
        seg === "::" ? <span key={j} className="mp-b">{seg}</span> : <span key={j} className={j === 0 ? "mp-name" : "mp-arg"}>{seg}</span>
      ))}<span className="mp-b">{"}}"}</span></span>;
    })}</pre></div>
  );
  if (open) return <FullscreenLayer label="Macro preview"><div className="mp mp-full">{head}{body}</div></FullscreenLayer>;
  return (
    <div className="mp" style={{ height }}>
      <SplitGrip rule={PREVIEW_HEIGHT} size={height} grows="up" label="Resize macro preview" onLive={setHeight}
        onSave={(px) => { if (px === null) { setHeight(PREVIEW_HEIGHT.start); prefs.set(PREVIEW_HEIGHT.key, null); } else prefs.set(PREVIEW_HEIGHT.key, px); }} />
      {head}{body}
    </div>
  );
}
