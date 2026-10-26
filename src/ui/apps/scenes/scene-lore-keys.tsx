/**
 * The entry editor's keyword boxes (RoleCall's TriggerInputBox and TriggerChip): chips that hold
 * three at first and "and N more" for the rest, Enter to add (a "/pattern/flags" becomes a regex
 * trigger and is refused when it will not compile), and in Advanced mode each chip's own percent and
 * cooldown, edited in place where RoleCall opens a browser prompt. Advanced mode also offers
 * "+ Condition", limited to the special keys the activation engine actually evaluates.
 */
import { useState, type JSX } from "react";
import type { Trigger } from "../../../entities/lorebook/schema";
import { SPECIAL_TRIGGER_PRESETS } from "../../components/lore-special-triggers";
import { Ic } from "../../_shared/ic";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { parseTriggerInput } from "./lore-core";
import { Button, Chip as PillChip, IconButton, MenuItem } from "../../components/button";

const MAX_VISIBLE = 3;
/** Special keys the engine evaluates (triggers-special.ts, triggers-emotion.ts); the narrative ones always read false here, and the active-book and group-chat ones are fixed. */
const HONOURED = ["[recency", "[messageCount", "[randomChance", "[generationType", "[emotion"];
const CONDITIONS = SPECIAL_TRIGGER_PRESETS.filter((p) => HONOURED.some((h) => p.keyword.startsWith(h)));

const label = (t: Trigger): string => (t.isRegex ? `/${t.keyword}/${t.flags ?? ""}` : t.keyword);

function Chip({ trigger, two, advanced, onRemove, onPatch }: {
  trigger: Trigger;
  two: boolean;
  advanced: boolean;
  onRemove(): void;
  onPatch(patch: Partial<Trigger>): void;
}): JSX.Element {
  const [editing, setEditing] = useState<"probability" | "frequency" | null>(null);
  const field = (name: "probability" | "frequency", unit: string, fallback: number): JSX.Element => {
    const value = trigger[name] ?? fallback;
    if (editing === name) {
      return (
        <span className="pc"><input type="number" min={0} max={name === "probability" ? 100 : undefined} autoFocus defaultValue={value} aria-label={name === "probability" ? "Trigger probability" : "Trigger cooldown"}
          onBlur={(e) => {
            const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
            onPatch(name === "probability" ? { probability: Math.min(100, n || 100) } : { frequency: n > 0 ? n : undefined });
            setEditing(null);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (isEscapeClose(e)) setEditing(null); }} />{unit}</span>
      );
    }
    return (
      <PillChip aria-label={name === "probability" ? "Change trigger probability" : "Change trigger cooldown"}
        title={name === "probability" ? "Trigger Probability. Change this individual trigger chance." : "Trigger Cooldown. Set how many messages must pass before this trigger can fire again."}
        onClick={() => setEditing(name)}>{name === "probability" ? `${value}${unit}` : <><Ic name="lucide:clock" size={12} />{trigger.frequency ? trigger.frequency : ""}</>}</PillChip>
    );
  };
  return (
    <span className={`wl-ch${two ? " two" : ""}${trigger.isRegex ? " rx" : ""}`} title={trigger.isRegex ? "Regex trigger" : two ? "Secondary trigger keyword" : "Primary trigger keyword"}>
      <span>{label(trigger)}</span>
      {advanced && field("probability", "%", 100)}
      {advanced && field("frequency", "", 0)}
      <IconButton variant="quiet" size="sm" icon="lucide:x" label={`Remove ${label(trigger)}`} title="Remove Trigger. Delete this trigger from the entry." onClick={onRemove} />
    </span>
  );
}

function Condition({ advanced, onAdd }: { advanced: boolean; onAdd(t: Trigger): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <span className="wl-rel">
      <Button variant="quiet" size="sm" menu aria-expanded={open} onClick={() => setOpen((v) => !v)}>+ Condition</Button>
      {open && (
        <div className="wl-dd" role="menu" aria-label="Insert special condition" style={{ right: 0, minWidth: 220 }}>
          {CONDITIONS.map((p) => (
            <MenuItem key={p.keyword} title={p.hint ?? p.keyword} hint={p.keyword}
              onClick={() => { onAdd({ keyword: p.keyword, isRegex: false, ...(advanced ? { probability: 100 } : {}) }); setOpen(false); }}>
              {p.label}
            </MenuItem>
          ))}
        </div>
      )}
    </span>
  );
}

export function TriggerBox({ triggers, two = false, advanced, placeholder, onChange }: {
  triggers: readonly Trigger[];
  /** The secondary box: amber, and no "+ Condition". */
  two?: boolean;
  advanced: boolean;
  placeholder: string;
  onChange(next: Trigger[]): void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const parsed = draft.trim() ? parseTriggerInput(draft) : null;
  const bad = parsed && !parsed.ok ? parsed.error : null;
  const visible = expanded ? triggers : triggers.slice(0, MAX_VISIBLE);
  const hidden = triggers.length - MAX_VISIBLE;
  const add = (t: Trigger): void => onChange([...triggers, advanced ? { ...t, probability: t.probability ?? 100 } : t]);
  return (
    <div className="wl-tb" data-part="scene.world.keys">
      <div className={`wl-tbx${two ? " two" : ""}${bad ? " bad" : ""}`}>
        {visible.map((t, i) => (
          <Chip key={`${t.keyword}-${i}`} trigger={t} two={two} advanced={advanced}
            onRemove={() => onChange(triggers.filter((_, j) => j !== i))}
            onPatch={(patch) => onChange(triggers.map((x, j) => (j === i ? { ...x, ...patch } : x)))} />
        ))}
        {!expanded && hidden > 0 && (
          <PillChip aria-label={`Show ${hidden} more trigger${hidden > 1 ? "s" : ""}`} onClick={() => setExpanded(true)}><Ic name="lucide:plus" size={12} />and {hidden} more</PillChip>
        )}
        {expanded && triggers.length > MAX_VISIBLE && <PillChip aria-label="Show fewer triggers" onClick={() => setExpanded(false)}>Show less</PillChip>}
        <input type="text" value={draft} placeholder={triggers.length === 0 ? placeholder : ""} aria-label={two ? "Add secondary keyword" : "Add keyword"}
          title="Type a keyword or regex pattern and press Enter to add" onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!parsed || !parsed.ok) return;
            add(parsed.trigger);
            setDraft("");
          }} />
        {advanced && !two && <Condition advanced={advanced} onAdd={add} />}
      </div>
      {bad && <div className="wl-err" role="alert"><Ic name="lucide:triangle-alert" size={14} />Invalid regex: {bad}</div>}
    </div>
  );
}
