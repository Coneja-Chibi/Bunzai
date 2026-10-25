/**
 * InjectionCard (P4 v2) - "where your persona appears", the body of the Prompt Injection section (the layout draws the card):
 * stops via injectionsForProfile (the position-picker law), a foreign
 * already-set stop dashed amber and kept, depth where the stop takes one (RoleCall's Message Depth slider for its own
 * Depth stop, a number and a role for ST's in-chat), RC's wrapper text. `locked` is RoleCall's "a preset block already
 * seats the persona": the stops stay shown, cannot change, and the depth control goes. `lens` adds the Workbench's platform note.
 */
import type { JSX } from "react";
import type { PersonaBody } from "../../../../entities/persona/schema";
import { Slider } from "../../../components/slider";
import es from "../editor-styles";
import { patchInjection } from "./session";
import s from "./persona.module.css";

export interface InjectionCardProps {
  body: PersonaBody;
  onBody: (fn: (b: PersonaBody) => PersonaBody, key: keyof PersonaBody) => void;
  stops: readonly string[];
  labels: Record<string, { label: string; hint: string }>;
  showWrapper: boolean;
  locked?: boolean;
  lens?: boolean;
}

export function InjectionCard({ body, onBody, stops, labels, showWrapper, locked = false, lens = false }: InjectionCardProps): JSX.Element {
  const current = body.chatInjection?.position ?? "character";
  const foreign = current && !stops.includes(current);
  const depth = body.chatInjection?.depth ?? 2;

  return (
    <>
      <div className={s.stops} role="group" aria-label="Where it is injected">
        {stops.map((stop) => {
          const on = current === stop;
          const meta = labels[stop] ?? { label: stop, hint: "" };
          return (
            <button
              key={stop}
              type="button"
              className={on ? `${s.stop} ${s.stopOn}` : s.stop}
              aria-pressed={on}
              disabled={locked}
              onClick={() => onBody((b) => patchInjection(b, { position: stop }), "chatInjection")}
            >
              <b className={s.stopB}>{meta.label}</b>
              <span className={s.stopHint}>{meta.hint}</span>
            </button>
          );
        })}
        {foreign && (
          <button type="button" className={`${s.stop} ${s.stopOn} ${s.stopForeign}`} aria-pressed disabled>
            <b className={s.stopB}>{labels[current]?.label ?? current}</b>
            <span className={s.stopHint}>set on another platform's lens - kept, not carried here</span>
          </button>
        )}
      </div>

      {current === "depth" && !locked && (
        <div className={s.depthBox}>
          <div className={s.depthHead}><span>Message Depth</span><b>{depth}</b></div>
          <Slider readout={false} min={0} max={20} value={depth} aria-label="Message depth" color="var(--a, var(--accent))"
            onChange={(n) => onBody((b) => patchInjection(b, { depth: n }), "chatInjection")} />
          <p className={s.depthNote}>Insert {depth === 0 ? "at the very end" : `${depth} messages from the end`}</p>
        </div>
      )}

      {current === "in_chat" && !locked && (
        <div className={s.depthRow}>
          <span>at depth</span>
          <input
            className={s.depthIn}
            type="number"
            min={0}
            max={10}
            value={depth}
            aria-label="Injection depth"
            onChange={(e) => onBody((b) => patchInjection(b, { depth: Number(e.target.value) }), "chatInjection")}
          />
          {current === "in_chat" && (
            <>
              <span>as</span>
              <select
                className={s.depthIn}
                style={{ width: "6.5rem" }}
                value={body.chatInjection?.role ?? "system"}
                aria-label="Injection role"
                onChange={(e) =>
                  onBody((b) => patchInjection(b, { role: e.target.value as "system" | "user" | "assistant" }), "chatInjection")
                }
              >
                <option value="system">system</option>
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
            </>
          )}
        </div>
      )}

      {showWrapper && (
        <label className={s.wrap}>
          <span className={s.wrapLabel}>Custom wrapper text <small>(optional)</small></span>
          <input
            className={es.in}
            value={body.chatInjection?.wrapper ?? ""}
            placeholder="e.g., This is {{user}}'s identity:"
            aria-label="Custom wrapper text"
            onChange={(e) => onBody((b) => patchInjection(b, { wrapper: e.target.value }), "chatInjection")}
          />
        </label>
      )}
      {lens && (
        <div className={s.stopNote}>
          Under a platform lens, stops that wire cannot carry disappear; a foreign stop already set
          shows dashed amber.
        </div>
      )}
    </>
  );
}
