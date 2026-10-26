/**
 * Lite state-graph editor: states + transitions, apply compiles into trigger scripts.
 */
import { Button, IconButton } from "../../../../components/button";
import { useMemo, useState, type JSX } from "react";
import type { TriggerScript } from "../../../../../entities/character/schema";
import { WorkshopEhead } from "../ehead";
import { MiniSelect, WORKSHOP_EVENTS } from "../mini-select";
import { WorkshopNotice } from "../notice";
import styles from "../styles.module.css";
import {
  compileGraph,
  decompileTriggers,
  mergeCompiledTriggers,
  seedStateVar,
  transitionSummary,
} from "./compile";
import { STATE_VAR, blankGraph, newStateId, newTransitionId, type GraphTransition, type StateGraph } from "./model";

export interface StateGraphPaneProps {
  triggers: TriggerScript[];
  defaultVarsText: string;
  onApply(triggers: TriggerScript[], defaultVarsText: string): void;
}

const OPS: ReadonlyArray<readonly [string, string]> = [
  ["=", "is"], ["!=", "is not"], [">", "is greater than"], ["<", "is less than"],
];
const SETOPS: ReadonlyArray<readonly [string, string]> = [
  ["=", "set to"], ["+=", "add"], ["-=", "subtract"],
];

export function StateGraphPane({
  triggers,
  defaultVarsText,
  onApply,
}: StateGraphPaneProps): JSX.Element {
  const initial = useMemo(() => decompileTriggers(triggers), [triggers]);
  const [graph, setGraph] = useState<StateGraph>(initial);
  const [newLabel, setNewLabel] = useState("");

  const setStates = (states: StateGraph["states"]): void => setGraph((g) => ({ ...g, states }));
  const setTransitions = (transitions: GraphTransition[]): void =>
    setGraph((g) => ({ ...g, transitions }));

  const addState = (): void => {
    const label = newLabel.trim() || "New state";
    const used = new Set(graph.states.map((s) => s.id));
    const id = newStateId(label, used);
    setStates([...graph.states, { id, label }]);
    setNewLabel("");
  };

  const addTransition = (): void => {
    const from = graph.states[0]?.id ?? "idle";
    const to = graph.states[1]?.id ?? from;
    setTransitions([
      ...graph.transitions,
      {
        id: newTransitionId(),
        from,
        to,
        event: "output",
      },
    ]);
  };

  const patchT = (id: string, patch: Partial<GraphTransition>): void =>
    setTransitions(graph.transitions.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const apply = (): void => {
    const compiled = compileGraph(graph);
    const nextTriggers = mergeCompiledTriggers(triggers, compiled);
    const first = graph.states[0]?.id ?? "idle";
    onApply(nextTriggers, seedStateVar(defaultVarsText, first));
  };

  const reset = (): void => setGraph(blankGraph());

  const stateOpts: ReadonlyArray<readonly [string, string]> = graph.states.map((s) => [
    s.id,
    s.label,
  ]);

  return (
    <>
      <WorkshopEhead
        title="State map"
        sub="states and moves · compiles into trigger rules"
      />
      <WorkshopNotice kind="warn">
        Lite mode: each move becomes a When/If/Then rule that sets <b>{STATE_VAR}</b>.
        Advanced code rules stay on Triggers and are left alone.
      </WorkshopNotice>

      <div className={styles.ehead}>
        <h2 style={{ fontSize: "var(--text-control)" }}>States</h2>
      </div>
      {graph.states.map((s) => (
        <div className={styles.ruleRow} key={s.id}>
          <input
            className={styles.val}
            value={s.label}
            onChange={(e) =>
              setStates(graph.states.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))
            }
          />
          <span className={styles.hint} style={{ margin: 0 }}>id: {s.id}</span>
          <IconButton label="Remove state" variant="danger" size="sm" icon="lucide:x" onClick={() => {
              setStates(graph.states.filter((x) => x.id !== s.id));
              setTransitions(graph.transitions.filter((t) => t.from !== s.id && t.to !== s.id));
            }} />
        </div>
      ))}
      <div className={styles.ruleRow}>
        <input
          className={styles.val}
          value={newLabel}
          placeholder="new state name"
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Button size="sm" onClick={addState}>+ State</Button>
      </div>

      <div className={styles.ehead} style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "var(--text-control)" }}>Moves</h2>
      </div>
      {graph.transitions.length === 0 && (
        <WorkshopNotice kind="empty" role="note">
          No moves yet. Add a move from one state to another, then Apply to triggers.
        </WorkshopNotice>
      )}
      {graph.transitions.map((t) => (
        <div className={styles.trig} key={t.id}>
          <div className={styles.th}>
            <MiniSelect opts={stateOpts} value={t.from} onChange={(v) => patchT(t.id, { from: v })} />
            <span className={styles.kw}>TO</span>
            <MiniSelect opts={stateOpts} value={t.to} onChange={(v) => patchT(t.id, { to: v })} />
            <MiniSelect opts={WORKSHOP_EVENTS} value={t.event} onChange={(v) => patchT(t.id, { event: v })} />
            <IconButton label="Remove move" variant="danger" size="sm" icon="lucide:x" onClick={() => setTransitions(graph.transitions.filter((x) => x.id !== t.id))} />
          </div>
          <div className={styles.body}>
            <p className={styles.summary}>{transitionSummary(t, graph.states)}</p>
            <div className={styles.ruleRow}>
              <span className={styles.hint} style={{ margin: 0 }}>also if</span>
              <input className={styles.var} value={t.whenVar ?? ""} placeholder="var" onChange={(e) => patchT(t.id, { whenVar: e.target.value })} />
              <MiniSelect opts={OPS} value={t.whenOp || "="} onChange={(v) => patchT(t.id, { whenOp: v })} />
              <input className={styles.val} value={t.whenValue ?? ""} placeholder="value" onChange={(e) => patchT(t.id, { whenValue: e.target.value })} />
            </div>
            <div className={styles.ruleRow}>
              <span className={styles.hint} style={{ margin: 0 }}>also then</span>
              <input className={styles.var} value={t.effectVar ?? ""} placeholder="var" onChange={(e) => patchT(t.id, { effectVar: e.target.value })} />
              <MiniSelect opts={SETOPS} value={t.effectOp || "="} onChange={(v) => patchT(t.id, { effectOp: v })} />
              <input className={styles.val} value={t.effectValue ?? ""} placeholder="value" onChange={(e) => patchT(t.id, { effectValue: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      <Button size="sm" onClick={addTransition}>+ Add a move</Button>
      <div className={styles.ruleRow} style={{ marginTop: "0.8rem" }}>
        <Button size="sm" onClick={apply}>Apply to triggers</Button>
        <Button variant="quiet" size="sm" onClick={reset}>Reset map</Button>
      </div>
    </>
  );
}
