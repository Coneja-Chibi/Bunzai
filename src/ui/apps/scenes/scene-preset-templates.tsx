/**
 * The preset's system prompts (RoleCall's PresetPanel Templates section and its TemplateItem): eight
 * always-listed text fields, each a collapsed row with its token estimate or "empty" that opens into a
 * textarea. The Preset tab lists them in a collapsed Templates section; the Writing Tools tab shows
 * the same row for the tools that use one. Both save through the wing's one text writer
 * (use-scene-preset-text.ts), so the two tabs edit one field and never disagree. Behavior (wrap in
 * quotes, continue prefill, names) is not drawn: nothing reads it (RC flaw F4).
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { PresetBody } from "../../../entities/preset/schema";
import { countText } from "../../../core/tokens";
import { Ic } from "../../_shared/ic";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import { TEMPLATE_FIELDS } from "./preset-core";
import type { PresetText, SystemPromptKey } from "./use-scene-preset-text";

/** One field: its label and size, and when open its text, saved to the preset 500 ms after typing stops, on leaving the field and on closing. */
export function TemplateItem({ label, content, loadedAt, onSave }: {
  label: string;
  content: string;
  /** Which load of the preset this shows; the text handed up carries it. */
  loadedAt: number;
  onSave(text: string, loadedAt: number): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(content);
  const saver = useDebouncedSave<string>((v) => onSave(v, loadedAt), 500);
  // A save made as the other tab closed lands after this one has opened: show it, unless text is waiting here.
  useEffect(() => { if (saver.pending() === undefined) setValue(content); }, [content, saver]);
  const empty = value.trim().length === 0;
  const tokens = useMemo(() => (empty ? 0 : countText(value)), [empty, value]);
  return (
    <div className={`tpl-item${empty ? "" : " set"}`}>
      <button type="button" className="tpl-row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`cv${open ? "" : " r"}`}><Ic name="lucide:chevron-down" size={12} /></span>
        <span className="tpl-name">{label}</span>
        <span className="tpl-meta">{empty ? "empty" : `~${String(tokens)}`}</span>
      </button>
      {open && (
        <textarea value={value} placeholder="Enter template content..." aria-label={`${label} text`} rows={Math.max(3, value.split("\n").length)}
          onChange={(e) => { setValue(e.target.value); saver.push(e.target.value); }} onBlur={saver.flush} />
      )}
    </div>
  );
}

/** The editor for one system prompt, keyed so a reload of the preset shows the text that came in. */
export function SystemPromptItem({ field, body, text }: { field: SystemPromptKey; body: PresetBody; text: PresetText }): JSX.Element {
  const label = TEMPLATE_FIELDS.find((f) => f.key === field)!.label;
  return <TemplateItem key={`${field}:${String(text.reloads)}`} label={label} content={body.systemPrompts?.[field] ?? ""} loadedAt={text.reloads} onSave={(v, at) => text.saveSystemPrompt(field, v, at)} />;
}

/** The Preset tab's Templates section: collapsed, with how many of the eight are set; the tab's prompt search narrows it. */
export function TemplatesSection({ body, text, query }: { body: PresetBody; text: PresetText; query: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const entries = TEMPLATE_FIELDS.map((f) => ({ ...f, content: body.systemPrompts?.[f.key] ?? "" }));
  const shown = q ? entries.filter((e) => e.key.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)) : entries;
  return (
    <div className="tpl">
      <button type="button" className="tpl-hd" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`cv${open ? "" : " r"}`}><Ic name="lucide:chevron-down" size={12} /></span>
        <Ic name="lucide:scroll-text" size={14} />
        <span className="tpl-t">Templates</span>
        <span className="tpl-count">{entries.filter((e) => e.content.trim()).length}/{entries.length}</span>
      </button>
      {open && (
        <div className="tpl-list">
          {shown.length === 0 ? <p className="tpl-none">No templates match search</p> : shown.map((e) => <SystemPromptItem key={e.key} field={e.key} body={body} text={text} />)}
        </div>
      )}
    </div>
  );
}
