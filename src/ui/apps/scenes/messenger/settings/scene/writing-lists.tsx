/**
 * The lists of the scene scope's Writing page: the guides, the regex sets and the Final Cut passes, each a switch per item bound to the writer its Full Chat tab uses (`useScenePrompting.setGuide`,
 * `useSceneRegexPicks.setOn`, `useFinalCut`). Writing, editing and deleting an item is its own program, reached by a drill row.
 */
import type { JSX } from "react";
import { onPass } from "../../../final-cut/fc-core";
import { useFinalCut } from "../../../final-cut/use-final-cut";
import { CATEGORY_LABEL, MODE_META, groupGuides } from "../../../guides-core";
import { useSceneRegexPicks } from "../../../use-scene-regex-picks";
import { useScenePrompting } from "../../../use-scene-prompting";
import { ActionRow, DrillRow, ToggleRow } from "../../frames/settings-rows";
import { chatOf, sayFailed, takeChat, type SceneEnv } from "./env";
import { SavedToggle } from "./saved";

const NOTE = "msn-st-secd";

export function GuidesBody({ env }: { env: SceneEnv }): JSX.Element {
  const chat = chatOf(env);
  const prompting = useScenePrompting(env.a.ctx, chat, takeChat(env));
  const on = chat.prompting?.guides ?? [];
  const { library } = prompting;
  return (
    <div data-part="scene.messenger.settings.writing.guides">
      {library.state === "loading" && <p className={NOTE} role="status">Loading guides...</p>}
      {library.state === "failed" && <ActionRow label="The guides could not be read" description={library.why} action="Try again" onAction={prompting.reload} />}
      {library.state === "ready" && library.guides.length === 0 && <p className={NOTE}>No guides yet. Write one in the guide editor.</p>}
      {library.state === "ready" && groupGuides(library.guides, "").flatMap((g) => g.rows).map((g) => (
        <SavedToggle key={g.id} label={g.title || "Untitled"} description={`${CATEGORY_LABEL[g.category]}, ${MODE_META[g.mode].label}. Use in this scene only.`} saved={on.includes(g.id)}
          write={(next) => prompting.setGuide(g.id, next).catch(sayFailed(env, "The guide"))} />
      ))}
      <DrillRow label="Guide editor" description="Write, edit, copy or delete guides." onOpen={() => env.open("guides")} />
    </div>
  );
}

export function RegexBody({ env }: { env: SceneEnv }): JSX.Element {
  const picks = useSceneRegexPicks(env.a.ctx, chatOf(env), takeChat(env));
  const { library } = picks;
  return (
    <div data-part="scene.messenger.settings.writing.regex">
      {library.state === "loading" && <p className={NOTE} role="status">Loading regex scripts...</p>}
      {library.state === "failed" && <ActionRow label="The regex scripts could not be read" description={library.why} action="Try again" onAction={picks.reload} />}
      {library.state === "ready" && library.sets.length === 0 && <p className={NOTE}>No regex scripts yet. Make one in the regex workshop.</p>}
      {library.state === "ready" && library.sets.map((s) => {
        const rules = s.facts?.regex?.ruleCount;
        const about = [s.facts?.description, rules === undefined ? "" : `${rules} ${rules === 1 ? "rule" : "rules"}`].filter(Boolean).join(". ");
        return <SavedToggle key={s.id} label={s.name} {...(about ? { description: about } : {})} saved={picks.on.includes(s.id)} write={(next) => picks.setOn(s.id, next).catch(sayFailed(env, "The regex script"))} />;
      })}
      <DrillRow label="Regex scripts" description="Make, edit, reorder or delete scripts." onOpen={() => env.open("regex")} />
    </div>
  );
}

const PASSES = [
  { type: "validator", label: "Output safety check", description: "Checks the finished reply for empty output, leaked syntax and unbalanced markup. No model call." },
  { type: "anti-slop", label: "Anti-slop engine", description: "Replaces worn-out phrases using the banks you attach." },
  { type: "editor", label: "Scene editor", description: "Rewrites the reply: proofreading, voice, point of view, polish." },
  { type: "translator", label: "Translator", description: "Translates the final reply and keeps names, macros and markup." },
  { type: "custom-agent", label: "Your department", description: "A pass with your own instruction." },
] as const;

export function FinalCutBody({ env }: { env: SceneEnv }): JSX.Element {
  const fc = useFinalCut(env.a.ctx, chatOf(env), takeChat(env));
  const { passes } = fc.settings;
  const safety = onPass(passes, "validator");
  return (
    <div data-part="scene.messenger.settings.writing.finalcut">
      <ToggleRow label="Final Cut" description="Run the passes below on every new reply. Off leaves the narrator's text as written; your settings are kept." on={fc.settings.on === true} onChange={fc.setOn} />
      {PASSES.map((p) => (
        <div key={p.type}>
          <ToggleRow label={p.label} description={p.description} on={onPass(passes, p.type) !== undefined} onChange={() => fc.toggle(p.type)} />
          {p.type === "validator" && safety && <ToggleRow label="Also check my messages before send" on={safety.applyToUserMessages === true} onChange={(applyToUserMessages) => fc.patch("validator", { applyToUserMessages })} />}
        </div>
      ))}
      {fc.error && <p className={NOTE} role="alert">{fc.error}</p>}
      <DrillRow label="Passes in detail" description="Each pass's model, strength, banks and the prompt it sends." onOpen={() => env.open("post-production")} />
    </div>
  );
}
