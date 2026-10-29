/**
 * Thinking in Replies (RoleCall's card of that name, SamplerPanel.tsx:1020-1218): Start Reply With, who it is sent as
 * (assistant prefill, user hint or system note), the common tag shapes, Catch thinking and "How thinking capture works".
 * Start Reply With is the scene's own text (ChatStore rule 37 `prefill`), chat-level as in RoleCall, so it replaces
 * the preset's prefill and the Prompting wing's preset text is never edited here. RoleCall's "Let the model see its
 * old thinking" (keepThinking: off strips an earlier reply's thinking from the history the model reads, assemble.ts) and
 * "Show Prefill in Chat" (showPrefill: the reply is shown with the prefill it was written after, kept with it) follow.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { modelTakesPrefill } from "../../../../core/assembly/request";
import { Chip, Segmented, Toggle } from "../../../components/button";
import { Ic } from "../../../_shared/ic";
import { useDebouncedSave } from "../../../_shared/use-debounced-value";
import { paramById } from "../../../../stage/params";
import { SettingCard } from "./setting-card";
import type { GenerationEnv } from "./generation-env";
import { CatchThinking } from "./catch-thinking";
import type { PromptingView } from "./use-prompting-view";

const ROLES = ["assistant", "user", "system"] as const;
export const ROLE_NAME = { assistant: "Assistant Prefill", user: "User Hint", system: "System Note" } as const;
const ROLE_TIP = {
  assistant: "Send as assistant prefill (default; the model continues the message)",
  user: "Send as trailing user hint (use when the model rejects assistant prefill)",
  system: "Send as trailing system note",
} as const;
const SHAPES: readonly (readonly [string, string])[] = [
  ["<think>", "most common · DeepSeek-R1 · Qwen3 · most open-source"], ["<thinking>", "community Claude-style"], ["<thought>", "some presets"], ["<plan>", "planning-first community CoT pattern"],
  ["<reasoning>", "prose reasoning wrap"], ["<reflection>", "self-reflect pattern"], ["<analysis>", "analytic CoT"], ["<scratchpad>", "Anthropic prompting-guide pattern"], ["[THINK]", "Mistral Magistral (square brackets)"],
];

function Explainer(): JSX.Element {
  return (
    <details className="gn-det">
      <summary><Ic name="mdi:chevron-right" size={16} />How thinking capture works</summary>
      <div className="gn-copy">
        <p><b>Two kinds of thinking.</b> Provider reasoning is sent separately by models like Claude or DeepSeek and always gets its own box; the Reasoning level sets how much. Thinking in the reply is text the model writes inside the reply itself, usually because your preset asks for it. Catch thinking controls this second kind.</p>
        <p><b>Auto looks for, in order:</b> your Start Reply With tag, including a reply that only closes it (the prefill opened it); the preset&apos;s own thinking markers; common thinking tags such as &lt;think&gt;, &lt;thinking&gt;, &lt;plan&gt;, &lt;analysis&gt;, &lt;reasoning&gt; and &lt;scratchpad&gt;; tags whose names look like those; and a tag that opens and never closes (everything after it is caught).</p>
        <p><b>Only these</b> catches exactly your own tags and the built-in tags you pick, closed blocks only. <b>Off</b> catches nothing.</p>
        <p>Changing this setting changes how every reply in this scene is shown, including earlier ones; the stored reply is never edited.</p>
      </div>
    </details>
  );
}

export function ThinkingGroup({ env, prompting }: { env: GenerationEnv; prompting: PromptingView }): JSX.Element {
  const { view, write } = prompting;
  const role = view.prefillRole ?? "assistant";
  const model = env.chat.connection?.model ?? "";
  const stored = view.prefill ?? "";
  const [text, setText] = useState(stored);
  const typed = useRef(false);
  // The store's text shows unless the person is mid-edit: a saved change lands, a failed one is put back.
  useEffect(() => { if (!typed.current) setText(stored); }, [stored]);
  const save = useDebouncedSave<string>((next) => { write({ prefill: next.trim() ? next : null }, "Start Reply With"); typed.current = false; }, 400);
  const claude = /claude/i.test(model) && !modelTakesPrefill(model);
  return (
    <section className="gn-box" data-part="scene.generation.thinking">
      <div className="gn-bh gn-bh2"><Ic name="mdi:message-text-outline" size={16} /><b>Thinking in Replies</b><small>Start Reply With · what gets caught</small></div>
      <div className="gn-bb">
        <div>
          <label className="gn-lbl" htmlFor="gn-prefill">Start Reply With <small>{ROLE_NAME[role]}</small></label>
          <div className="gn-seg3r">
            <Segmented label="Prefill role" items={ROLES.map((r) => ({ value: r, label: r, title: ROLE_TIP[r] }))} value={role} onChange={(r) => write({ prefillRole: r === "assistant" ? null : r }, "Start Reply With")} />
          </div>
          {claude && (
            <div role="status" aria-label="Claude prefill compatibility warning" className="gn-claude">
              <p><Ic name="mdi:alert-outline" size={16} /> <b>Claude 4.6+ cannot continue an assistant prefill.</b></p>
              <p>{role === "assistant" ? "Bunzai will ignore any chat or preset Start Reply With text for this model. The text remains saved for compatible models." : role === "user" ? "Bunzai will send the Start Reply With text as a final user message instead." : "Bunzai will send the Start Reply With text as a final system note."}</p>
              <div className="gn-two">
                <Segmented<typeof role> label="Claude prefill handling" items={[{ value: "assistant", label: "Ignore for Claude", tone: "var(--stage-warn)" }, { value: "user", label: "Send as user message", tone: "var(--stage-warn)" }]} value={role} onChange={(r) => write({ prefillRole: r === "assistant" ? null : r }, "Start Reply With")} />
              </div>
            </div>
          )}
          <input id="gn-prefill" type="text" className="gn-in" value={text} placeholder="e.g., <think>" maxLength={2000} onChange={(e) => { typed.current = true; setText(e.target.value); save.push(e.target.value); }} />
          <p className="gn-copy">
            {stored.trim() ? <>Every reply starts with <code>{stored}</code>. What gets moved into Behind the Scene is set by Catch thinking below.</>
              : <>Text every reply starts with. The most common use is <code>&lt;think&gt;</code> so the model opens a thinking block right away.</>}
          </p>
          <details className="gn-det">
            <summary><Ic name="mdi:chevron-right" size={16} />Common tag shapes</summary>
            <div className="gn-chips">
              {SHAPES.map(([tag, hint]) => <Chip key={tag} pressed={stored === tag} title={hint} onClick={() => { typed.current = false; setText(tag); write({ prefill: tag }, "Start Reply With"); }}>{tag}</Chip>)}
            </div>
            <p className="gn-sub">Pick one to fill the field above. You can still type your own.</p>
          </details>
        </div>
        <hr className="gn-hr" />
        <CatchThinking value={view.capture} prefill={stored} onChange={(next) => write({ capture: next }, "Catch thinking")} />
        <hr className="gn-hr" />
        <SettingCard def={paramById("keep_inline_thinking_tags")!} enabled={view.keepThinking === true} value={view.keepThinking === true} onToggle={(on) => write({ keepThinking: on ? true : null }, "Let the model see its old thinking")} onChange={(v) => write({ keepThinking: v === true ? true : null }, "Let the model see its old thinking")} />
        <div className="gn-sw">
          <div><b>Show Prefill in Chat</b><small>Display the prefill text in the chat interface.</small></div>
          <Toggle size="sm" on={view.showPrefill === true} aria-label="Show Prefill in Chat" onChange={() => write({ showPrefill: view.showPrefill === true ? null : true }, "Show Prefill in Chat")} />
        </div>
        <hr className="gn-hr" />
        <Explainer />
      </div>
    </section>
  );
}
