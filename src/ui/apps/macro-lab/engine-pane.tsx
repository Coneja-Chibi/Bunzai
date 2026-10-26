/**
 * The engine box: what the platform's own macro engine did with the text.
 *
 * THIS IS THE ONE ANSWER HERE THAT IS NOT OURS. It comes from a real SillyTavern or Marinara
 * checkout on this machine, assembled through the same code path a converted preset takes, and
 * nothing in this file models a macro. That is the whole value: everywhere else Bunraku tells you
 * what it believes about an engine, and here the engine tells you.
 *
 * ON A BUTTON, NEVER ON A KEYSTROKE. Resolving spawns somebody else's application, and SillyTavern's
 * adapter stages a copy of its macro folder inside the user's own checkout to do it. That is a fine
 * thing to do when a person asks for it and an unforgivable thing to do on every character typed.
 * The route refuses a second concurrent run per engine as well; this is the half a person sees.
 */
import { Button } from "../../components/button";
import type { JSX } from "react";
import { Panel } from "../../components/panel";
import type { MacroEngineInfo, MacroResolveResult } from "../../app-contract";
import styles from "./styles.module.css";

export interface EngineState {
  /** null until a render has been asked for and answered */
  readonly result: MacroResolveResult | null;
  readonly busy: boolean;
  /** a refusal from the route itself (no engine, already running, bad request) */
  readonly problem: string | null;
}

export const IDLE_ENGINE: EngineState = { result: null, busy: false, problem: null };

export function EnginePane({
  engine,
  lensLabel,
  state,
  onResolve,
}: {
  /** the engine for the chosen lens, or null when this lens has no runtime here */
  engine: MacroEngineInfo | null;
  lensLabel: string;
  state: EngineState;
  onResolve: () => void;
}): JSX.Element {
  const result = state.result;

  return (
    <Panel data-part="macro-lab.engine" deck="regex" className={styles.box} aria-label="What the engine did">
      <div className={styles.boxHead}>
        <h2 className={styles.boxTitle}>Resolved</h2>
        <span className={styles.boxNote}>
          {result?.ok ? `${result.engine.name} ${result.engine.version}` : "the real engine"}
        </span>
      </div>

      <div className={styles.actions} data-part="macro-lab.resolve">
        <Button variant="primary" onClick={onResolve} disabled={!engine || state.busy}>
          {state.busy ? "Resolving…" : "Resolve for real"}
        </Button>
        {/*
          The reason a lens cannot be resolved, said where the disabled button is. Five lenses have
          catalogs and only the two with a checkout on this machine have a runtime; a control that
          simply greys out claims the feature is broken rather than absent.
        */}
        {!engine ? (
          <span className={styles.why}>
            {`No ${lensLabel} engine on this machine, so nothing can run this text. The reading beside `}
            {"it still works."}
          </span>
        ) : null}
      </div>

      {state.problem ? <p className={styles.problem}>{state.problem}</p> : null}

      {result && !result.ok ? (
        /**
         * A refusal is printed as a refusal. "The engine finished and found nothing unresolved" and
         * "the engine never answered" must never look the same on screen - that confusion is the
         * single failure the whole render contract exists to prevent, and it would arrive here as a
         * blank output box reading like a clean pass.
         */
        <p className={styles.problem}>
          {`The engine did not finish (${result.reason}): ${result.detail}. Nothing was resolved, so `}
          {"do not read this as a pass."}
        </p>
      ) : null}

      {result?.ok ? (
        <>
          <pre className={styles.resolved}>{result.prompt || "(the engine returned nothing)"}</pre>

          {result.unresolved.length > 0 ? (
            <div>
              <p className={styles.quiet}>
                {"Still wearing braces after the engine finished, so this is what the model would "}
                {"actually see:"}
              </p>
              <div className={styles.tokens}>
                {result.unresolved.map(/* bounded-ok: macro bible / engine reports / ops matrix: fixed engine data or per-run summaries */ (u) => (
                  <code key={u.token} className={styles.deadToken}>
                    {u.count > 1 ? `${u.token} ×${u.count}` : u.token}
                  </code>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.ok}>Every macro resolved. Nothing was left unexpanded.</p>
          )}

          {result.warnings.map(/* bounded-ok: macro bible / engine reports / ops matrix: fixed engine data or per-run summaries */ (w) => (
            <p key={w} className={styles.problem}>{w}</p>
          ))}
        </>
      ) : null}

      {!result && !state.problem ? (
        <div className={styles.moment}>
          <b>{engine ? "Ready when you are" : "No engine to answer"}</b>
          <span className={styles.quiet}>
            {engine
              ? "Press Resolve to run this text through the engine itself. Nothing is sent anywhere: it runs on this machine, against the checkout you installed."
              : "This box needs a real engine to answer. Point Bunraku at a checkout and it will run your text through it."}
          </span>
        </div>
      ) : null}
    </Panel>
  );
}
