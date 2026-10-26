/**
 * ResponseSchema - Agnai json ResponseSchema editor (approved wireframe).
 */
import { Button, IconButton } from "../button";
import type { JSX } from "react";
import {
  normalizeSchema,
  schemaToWire,
  type ResponseSchemaValue,
  type SchemaField,
} from "./core";
import { ExpandTextarea } from "../expand";
import styles from "./styles.module.css";

export interface ResponseSchemaProps {
  value: unknown;
  onChange(next: Record<string, unknown>): void;
}

export function ResponseSchema({ value, onChange }: ResponseSchemaProps): JSX.Element {
  const s = normalizeSchema(value);
  const commit = (next: ResponseSchemaValue): void => onChange(schemaToWire(next));

  const setField = (i: number, patch: Partial<SchemaField>): void => {
    const fields = s.fields.map((f, j) => (j === i ? { ...f, ...patch } : f));
    commit({ ...s, fields });
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.lbl}>Fields</span>
      {s.fields.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (f, i) => (
        <div className={styles.row} key={i}>
          <input
            className={`${styles.input} ${styles.name}`}
            value={f.name}
            placeholder="name"
            onChange={(e) => setField(i, { name: e.target.value })}
          />
          <select
            className={styles.sel}
            value={f.type || "string"}
            onChange={(e) => setField(i, { type: e.target.value })}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
          </select>
          <input
            className={styles.input}
            value={f.description}
            placeholder="description"
            onChange={(e) => setField(i, { description: e.target.value })}
          />
          <IconButton
            variant="quiet"
            size="sm"
            icon="lucide:x"
            label="Remove field"
            onClick={() => commit({ ...s, fields: s.fields.filter((_, j) => j !== i) })}
          />
        </div>
      ))}
      <div className={styles.add}>
        <Button
          size="sm"
          onClick={() =>
            commit({
              ...s,
              fields: [...s.fields, { name: "", type: "string", description: "" }],
            })
          }
        >
          + Field
        </Button>
      </div>
      <div className={styles.grid}>
        <div>
          <span className={styles.lbl}>System prompt</span>
          <ExpandTextarea
            label="System prompt"
            className={styles.ta}
            value={s.systemPrompt}
            onChange={(e) => commit({ ...s, systemPrompt: e.target.value })}
          />
        </div>
        <div>
          <span className={styles.lbl}>Jailbreak</span>
          <ExpandTextarea
            label="Jailbreak"
            className={styles.ta}
            value={s.jailbreak}
            onChange={(e) => commit({ ...s, jailbreak: e.target.value })}
          />
        </div>
        <div>
          <span className={styles.lbl}>History slot</span>
          <ExpandTextarea
            label="History slot"
            className={styles.ta}
            value={s.history}
            onChange={(e) => commit({ ...s, history: e.target.value })}
          />
        </div>
        <div>
          <span className={styles.lbl}>Image caption</span>
          <ExpandTextarea
            label="Image caption"
            className={styles.ta}
            value={s.imageCaption}
            onChange={(e) => commit({ ...s, imageCaption: e.target.value })}
          />
        </div>
      </div>
      <div>
        <span className={styles.lbl}>Response slot</span>
        <ExpandTextarea
          label="Response slot"
          className={styles.ta}
          value={s.response}
          onChange={(e) => commit({ ...s, response: e.target.value })}
        />
      </div>
    </div>
  );
}
