/**
 * RpgStats - character-card RPG block matching Marinara `RPGStatsConfig`:
 * enabled + attributes[{name,value}] + hp{value,max}.
 * Colored status bars (name/value/max/color) are Persona `personaStats.bars`, not this shape.
 * Never writes a `pools` key onto character.extensions.rpgStats.
 */
import type { JSX } from "react";
import { ListEditor } from "../list-editor";
import { FieldForm, type FormField } from "../field-form";
import { ToggleSwitch } from "../toggle-switch";
import styles from "./styles.module.css";
import { numOr, type Rec, recOr } from "../../../core/guards";

const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);

export interface RpgStatsProps {
  value: Rec;
  onChange(next: Rec): void;
}

const ATTR_FIELDS: readonly FormField[] = [
  { key: "name", label: "Attribute", kind: "text", placeholder: "STR", half: true },
  { key: "value", label: "Value", kind: "number", half: true },
];
const HP_FIELDS: readonly FormField[] = [
  { key: "value", label: "Current HP", kind: "number", half: true, min: 0 },
  { key: "max", label: "Max HP", kind: "number", half: true, min: 1 },
];

/** Canonical character rpgStats object (no pools, no foreign keys). */
export function normalizeCharacterRpgStats(value: unknown): Rec {
  const v = recOr(value);
  const hp = recOr(v.hp);
  const attributes = arr(v.attributes).map((row) => {
    const r = recOr(row);
    return {
      name: typeof r.name === "string" ? r.name : "",
      value: numOr(r.value, 0),
    };
  });
  return {
    enabled: v.enabled === true,
    attributes,
    hp: {
      value: numOr(hp.value, numOr(hp.max, 100)),
      max: Math.max(1, numOr(hp.max, 100)),
    },
  };
}

export function RpgStats({ value, onChange }: RpgStatsProps): JSX.Element {
  const v = normalizeCharacterRpgStats(value);
  const set = (patch: Rec): void => onChange(normalizeCharacterRpgStats({ ...v, ...patch }));
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.k}>Stats enabled</span>
        <ToggleSwitch
          on={v.enabled === true}
          onChange={(on) => set({ enabled: on })}
          label={v.enabled === true ? "On" : "Off"}
        />
      </div>
      <div className={styles.group}>
        <div className={styles.gtitle}>Attributes</div>
        <ListEditor
          items={arr(v.attributes)}
          fields={ATTR_FIELDS}
          addLabel="+ add attribute"
          onChange={(next) => set({ attributes: next })}
        />
      </div>
      <div className={styles.group}>
        <div className={styles.gtitle}>Hit points</div>
        <FieldForm
          fields={HP_FIELDS}
          value={recOr(v.hp)}
          onChange={(key, next) => set({ hp: { ...recOr(v.hp), [key]: next } })}
        />
      </div>
    </div>
  );
}
