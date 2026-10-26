/**
 * The Pipeline Prompt Contract (RoleCall's PipelinePromptContract, PostProductionPanel.tsx:466-623): a chip per pass with its tokens, a total,
 * a click to look at one pass alone, Copy XML, and the XML in a fold. What it shows is each pass's real system prompt (fc-core.ts contractOf),
 * not a second written copy. Tokens are Bunraku's estimate (the same count the Tokens view starts from), not a tokenizer's.
 */
import { useState, type JSX } from "react";
import { Button, Chip } from "../../../components/button";
import { copyText } from "../../../_shared/clipboard";
import type { FinalCutPass } from "../../../../core/final-cut/pass";
import type { RulebookEntry } from "../../../../core/final-cut/prompts";
import { contractOf, PASS_TONE } from "./fc-core";

export function Contract({ passes, rulebook }: { passes: readonly FinalCutPass[]; rulebook: readonly RulebookEntry[] }): JSX.Element {
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const list = contractOf(passes, rulebook);
  if (list.length === 0) {
    return (
      <section className="fc-card fc-contract empty">
        <div className="kick">Pipeline Prompt Contract</div>
        <div className="fc-off">No passes enabled. The narrator output saves unchanged.</div>
      </section>
    );
  }
  const one = list.find((c) => c.type === picked) ?? null;
  const total = list.reduce((n, c) => n + c.tokens, 0);
  const shownTokens = one ? one.tokens : total;
  const xml = one ? one.xml : [`<post_production_pipeline passes="${list.length}">`, ...list.map((c) => c.xml.split("\n").map((l) => (l ? `  ${l}` : l)).join("\n")), "</post_production_pipeline>"].join("\n\n");
  const label = one ? "Copy this pass" : "Copy XML";
  return (
    <section className="fc-card fc-contract" style={{ "--p": PASS_TONE[one?.type ?? "editor"] } as React.CSSProperties} data-part="scene.finalcut.contract">
      <header>
        <div>
          <div className="kick">{one ? `Pipeline · ${one.label}` : "Pipeline Prompt Contract"}</div>
          <small>{one ? "What this agent receives." : "Click a chip to drill into one agent."}</small>
        </div>
        <div className="fc-tokens"><b>{one?.type === "validator" ? "-" : `~${shownTokens.toLocaleString()}`}</b><small>{one ? (one.type === "validator" ? "no model call" : "tokens · this pass") : "tokens total"}</small></div>
      </header>
      <div className="fc-chips">
        {one && <Chip onClick={() => setPicked(null)}>All passes ~{total.toLocaleString()}</Chip>}
        {list.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (c, i) => (
          <Chip key={c.type} pressed={picked === c.type} muted={!!picked && picked !== c.type} onClick={() => setPicked(picked === c.type ? null : c.type)}>
            {i + 1} {c.label} {c.type === "validator" ? "-" : `~${c.tokens.toLocaleString()}`}
          </Chip>
        ))}
      </div>
      <div className="fc-copy">
        <Button size="sm" onClick={() => { void copyText(xml).then((ok) => { setNote(ok ? "Copied" : "Copy failed"); setTimeout(() => setNote(null), 1200); }); }}>{note ?? label}</Button>
        <small>estimated tokens (the Tokens view's count), not a tokenizer's</small>
      </div>
      <details className="fc-fold" open={one !== null}>
        <summary><span>{one ? `View ${one.label} contract` : "View full pipeline XML (all passes)"}</span><small>{xml.length.toLocaleString()} chars</small></summary>
        <pre className="fc-xml">{xml}</pre>
      </details>
    </section>
  );
}
