/**
 * The Logit Bias manager (RoleCall's LogitBiasManager.tsx, from SillyTavern): type a word or phrase, give
 * it a bias from -100 to 100, reorder, remove, import and export the list. Words become token ids with the
 * exact tokenizer of the scene's model (core/tokens/bias.ts); where Bunzai has none for the model this
 * says so and does not send a guessed bias. `[1234, 5678]` raw ids always work, and the raw JSON box is
 * the advanced path: token id to bias, replacing the list.
 */
import { useRef, useState, type JSX } from "react";
import { Button, IconButton } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { isRecord } from "../../../core/guards";
import { biasFrom, entryTokens, exactTokenizer, type BiasEntry } from "../../../core/tokens/bias";

const newId = (): string => `bias-${crypto.randomUUID()}`;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** The entries a JSON file or a raw JSON object holds, or why not. */
function entriesFromFile(text: string): BiasEntry[] | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "That file is not valid JSON.";
  }
  if (!Array.isArray(parsed)) return "Expected an array of logit bias entries.";
  const out = parsed.flatMap((e): BiasEntry[] => (isRecord(e) && typeof e["text"] === "string" && finite(e["value"]) ? [{ id: typeof e["id"] === "string" ? e["id"] : newId(), text: e["text"], value: Math.max(-100, Math.min(100, e["value"])) }] : []));
  return out.length > 0 ? out : "No valid entries found in that file.";
}

function preview(text: string, model: string): string {
  if (!text.trim()) return "";
  const ids = entryTokens(text, exactTokenizer(model));
  if (ids === "no-tokenizer") return "no exact tokenizer for this model";
  if (ids === "invalid") return "not a list of token ids";
  return `[${ids.slice(0, 5).join(", ")}${ids.length > 5 ? "..." : ""}]`;
}

function RawJson({ entries, model, onChange }: { entries: BiasEntry[]; model: string; onChange(entries: BiasEntry[]): void }): JSX.Element {
  const made = biasFrom(entries, model);
  const shown = "bias" in made ? JSON.stringify(made.bias, null, 2) : "";
  const [text, setText] = useState(shown);
  const [problem, setProblem] = useState<string | null>(null);
  const edit = (next: string): void => {
    setText(next);
    try {
      const parsed: unknown = next.trim() ? JSON.parse(next) : {};
      if (!isRecord(parsed)) return setProblem("Use a JSON object: { \"token id\": bias }.");
      const pairs = Object.entries(parsed);
      if (pairs.some(([id, v]) => !/^\d+$/.test(id) || !finite(v) || v < -100 || v > 100)) return setProblem("Each key is a token id and each value a bias from -100 to 100.");
      setProblem(null);
      onChange(pairs.map(([id, v]) => ({ id: newId(), text: `[${id}]`, value: v as number })));
    } catch {
      setProblem("That is not valid JSON yet; nothing changes until it is.");
    }
  };
  return (
    <div>
      <textarea className="gp-ta mono" rows={5} aria-label="Logit bias raw JSON" value={text} placeholder={'{"1234": -50, "5678": 25}'} aria-invalid={problem !== null} onChange={(e) => edit(e.target.value)} />
      <div className={problem ? "gp-hint bad" : "gp-hint"} role={problem ? "alert" : undefined}>{problem ?? "Editing this replaces the entries above with one raw-id entry per token."}</div>
    </div>
  );
}

export function LogitBiasManager({ entries, model, onChange }: { entries: BiasEntry[]; model: string | undefined; onChange(entries: BiasEntry[]): void }): JSX.Element {
  const m = model ?? "";
  const [drag, setDrag] = useState<number | null>(null);
  const [raw, setRaw] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const made = biasFrom(entries, m);
  const count = "bias" in made ? Object.keys(made.bias).length : 0;
  const set = (i: number, patch: Partial<BiasEntry>): void => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const hasWords = entries.some((e) => e.text.trim() && !(e.text.trim().startsWith("[") && e.text.trim().endsWith("]")));
  const noTokenizer = exactTokenizer(m) === null;

  const move = (to: number): void => {
    if (drag === null || drag === to) return;
    const next = [...entries];
    const [item] = next.splice(drag, 1);
    next.splice(to, 0, item!);
    setDrag(to);
    onChange(next);
  };
  const exportList = (): void => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `logit-bias-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importList = (f: File | undefined): void => {
    if (!f) return;
    if (f.size > 262_144) return setNote("That file is too large to be a logit bias list.");
    const reader = new FileReader();
    reader.onload = () => {
      const read = entriesFromFile(String(reader.result));
      if (typeof read === "string") return setNote(read);
      setNote(null);
      onChange([...entries, ...read]);
    };
    reader.readAsText(f);
  };

  return (
    <div className="gp-bias">
      <input ref={file} type="file" hidden accept=".json,application/json" aria-label="Import logit bias entries" onChange={(e) => { importList(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="gp-bias-top">
        <span>{entries.length === 0 ? "No logit bias entries" : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} → ${count} token${count !== 1 ? "s" : ""} biased`}</span>
        <div className="gp-bias-btns">
          <Button size="sm" icon="mdi:upload" title="Import logit bias entries from JSON file" onClick={() => file.current?.click()}>Import</Button>
          {entries.length > 0 && <Button size="sm" icon="mdi:download" title="Export logit bias entries to JSON file" onClick={exportList}>Export</Button>}
          <Button size="sm" icon="mdi:plus" onClick={() => onChange([...entries, { id: newId(), text: "", value: 0 }])}>Add Entry</Button>
        </div>
      </div>
      {note && <div className="gp-hint bad" role="alert">{note}</div>}
      {noTokenizer && hasWords && <div className="gp-hint bad" role="alert" data-part="scene.generation.bias-note">Bunzai has no exact tokenizer for {m || "this model"}, so words cannot be turned into token ids and none of these entries is sent. Write token ids as [1234, 5678].</div>}
      {entries.map((e, i) => (
        <div key={e.id} className={`gp-bias-row${drag === i ? " drag" : ""}`} draggable onDragStart={() => setDrag(i)} onDragOver={(ev) => { ev.preventDefault(); move(i); }} onDragEnd={() => setDrag(null)}>
          <span className="gp-bias-grip" aria-hidden="true"><Ic name="mdi:drag-vertical" size={16} /></span>
          <div className="gp-bias-text">
            <input type="text" className="gp-in mono" value={e.text} placeholder="Text or [token ids]" aria-label="Logit bias text" onChange={(ev) => set(i, { text: ev.target.value })} />
            {e.text.trim() && <div className="gp-bias-prev">{preview(e.text, m)}</div>}
          </div>
          <input type="number" className="gp-in mono gp-bias-num" min={-100} max={100} step={0.01} value={e.value} aria-label="Bias" onChange={(ev) => { const n = parseFloat(ev.target.value); set(i, { value: Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : 0 }); }} />
          <span className={`gp-bias-dot ${e.value < 0 ? "neg" : e.value > 0 ? "pos" : ""}`} title={e.value < 0 ? "Suppress" : e.value > 0 ? "Boost" : "Neutral"} />
          <IconButton variant="quiet" size="sm" label="Remove entry" icon="mdi:close" onClick={() => onChange(entries.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="gp-bias-guide">
        <b>Format Guide:</b>
        <div><code>normal text</code> - tokenized with a leading space</div>
        <div><code>{"{verbatim}"}</code> - tokenized without the leading space</div>
        <div><code>[1234,5678]</code> - raw token ids</div>
        <p><b>Bias values:</b> -100 (suppress) to +100 (boost). Use -50 to discourage, +25 to encourage.</p>
        <p><b>Import/Export:</b> Save your logit bias configurations as JSON files and share them or reuse them across different presets.</p>
        <p><b>Provider support:</b> OpenAI, OpenRouter, llama.cpp, Ollama, and OpenAI-compatible APIs. Not supported by Anthropic (Claude) or Google (Gemini). Words are tokenized only for models whose tokenizer Bunzai carries (OpenAI&apos;s).</p>
      </div>
      <Button variant="quiet" size="sm" aria-expanded={raw} onClick={() => setRaw(!raw)}>Raw JSON (advanced)<Ic name={raw ? "mdi:chevron-up" : "mdi:chevron-down"} size={14} /></Button>
      {raw && <RawJson entries={entries} model={m} onChange={onChange} />}
    </div>
  );
}
