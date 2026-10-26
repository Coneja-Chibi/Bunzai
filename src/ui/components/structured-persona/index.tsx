/**
 * StructuredPersona - Agnai persona kind + attribute map editor (approved vs-agnai-components).
 */
import { Button, IconButton, Segmented } from "../button";
import { useState, type JSX, type KeyboardEvent } from "react";
import {
  PERSONA_KINDS,
  addAttribute,
  normalizePersona,
  removeAttribute,
  setAttributeKey,
  setAttributeValues,
  setKind,
  toWire,
  type PersonaKind,
} from "./core";
import styles from "./styles.module.css";

export interface StructuredPersonaProps {
  value: unknown;
  onChange(next: Record<string, unknown>): void;
}

export function StructuredPersona({ value, onChange }: StructuredPersonaProps): JSX.Element {
  const persona = normalizePersona(value);
  const commit = (next: ReturnType<typeof normalizePersona>): void => onChange(toWire(next));

  return (
    <div className={styles.wrap}>
      <div className={styles.kinds}>
        <Segmented
          size="sm"
          label="Persona format"
          value={persona.kind}
          onChange={(k) => commit(setKind(persona, k))}
          items={PERSONA_KINDS.map((k) => ({ value: k, label: k }))}
        />
      </div>

      {persona.kind === "text" ? (
        <p className={styles.hint}>
          Plain text lives in the Personality field. Pick attributes, W++, SBF, or boostyle for a trait map.
        </p>
      ) : (
        <>
          {Object.entries(persona.attributes).map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ([key, vals]) => (
            <AttrRow
              key={key}
              attrKey={key}
              values={vals}
              onKeyChange={(nk) => commit(setAttributeKey(persona, key, nk))}
              onValuesChange={(vs) => commit(setAttributeValues(persona, key, vs))}
              onRemove={() => commit(removeAttribute(persona, key))}
            />
          ))}
          <div className={styles.add}>
            <Button size="sm" onClick={() => commit(addAttribute(persona))}>
              + Attribute row
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AttrRow(props: {
  attrKey: string;
  values: string[];
  onKeyChange(k: string): void;
  onValuesChange(v: string[]): void;
  onRemove(): void;
}): JSX.Element {
  const { attrKey, values, onKeyChange, onValuesChange, onRemove } = props;
  const [draft, setDraft] = useState("");

  const add = (): void => {
    const t = draft.trim();
    if (!t) return;
    onValuesChange([...values.filter(Boolean), t]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className={styles.attr}>
      <div className={styles.top}>
        <input
          className={styles.key}
          value={attrKey}
          onChange={(e) => onKeyChange(e.target.value)}
          aria-label="Attribute name"
        />
        <div className={styles.rm}>
          <Button size="sm" variant="danger" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
      <div className={styles.chips}>
        {values.filter(Boolean).map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (v, i) => (
          <span className={styles.chip} key={`${v}-${i}`}>
            {v}
            <IconButton variant="quiet" size="sm" icon="lucide:x" label={`Remove ${v}`} onClick={() => onValuesChange(values.filter((_, j) => j !== i))} />
          </span>
        ))}
        <input
          className={styles.chipInput}
          value={draft}
          placeholder="+ value"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
        />
      </div>
    </div>
  );
}

export type { PersonaKind };
