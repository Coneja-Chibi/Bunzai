/**
 * The deeper pages of the scene scope, reached by a drill row of one of its category pages: today the Final Cut passes (one page per pass, one per attached Anti-slop set, and the on-demand editing tools). A page is a
 * heading and one section of rows bound to the Full Chat writers; an id this scope does not own is none, so the You scope's pages (user/deep.tsx) stay what they were.
 */
import type { JSX } from "react";
import { getSet } from "../../../../../../core/final-cut/banks";
import type { SettingsDeepPage } from "../../frames/settings-window";
import type { SceneEnv } from "./env";
import { AgentPage } from "./finalcut-agent";
import { AntiSlopPage, AntiSlopSetPage } from "./finalcut-antislop";
import { SafetyPage, ToolsPage } from "./finalcut-checks";
import { EditorPage } from "./finalcut-editor";
import { TranslatorPage } from "./finalcut-translator";
import { FavoriteModels } from "./models-page";
import { MODELS_PAGE, PROMPTS_PAGE } from "./pages";
import { PromptBlocksPage } from "./prompt-blocks";

/** The deeper page of each Final Cut pass and of the editing tools. */
export const FINAL_CUT_PAGES = {
  safety: "scene.finalcut.safety", antislop: "scene.finalcut.anti-slop", editor: "scene.finalcut.editor", translator: "scene.finalcut.translator", agent: "scene.finalcut.agent", tools: "scene.finalcut.tools",
} as const;

const SET_PREFIX = "scene.finalcut.set.";

export function sceneDeep(env: SceneEnv, id: string): SettingsDeepPage | null {
  const page = (title: string, description: string, body: JSX.Element): SettingsDeepPage => ({ title, sections: [{ id: "rows", title, description, body }] });
  switch (id) {
    case PROMPTS_PAGE: return page("Prompt blocks", "Choices and one switch per prompt, for this scene only. The preset in your library is not changed.", <PromptBlocksPage env={env} />);
    case MODELS_PAGE: return page("Favorite models", "Starred models come first in the narrator and Story Director model lists.", <FavoriteModels env={env} />);
    case FINAL_CUT_PAGES.safety: return page("Output safety check", "A cheap malformed-output guard before the reply is saved.", <SafetyPage env={env} />);
    case FINAL_CUT_PAGES.antislop: return page("Anti-slop engine", "Watches for worn-out patterns and rewrites them in place, on the banks you attach.", <AntiSlopPage env={env} />);
    case FINAL_CUT_PAGES.editor: return page("Scene editor", "An LLM rewrite pass: proofreading, voice, point of view, polish.", <EditorPage env={env} />);
    case FINAL_CUT_PAGES.translator: return page("Translator", "An LLM localization pass that keeps names, macros, VN tags and markdown.", <TranslatorPage env={env} />);
    case FINAL_CUT_PAGES.agent: return page("Your department", "A focused post-production agent with your own instruction and an optional preset rulebook.", <AgentPage env={env} />);
    case FINAL_CUT_PAGES.tools: return page("On-demand editing tools", "Rewrite, Expand, Reduce, Custom and Correction run on your scene model unless you point one elsewhere.", <ToolsPage env={env} />);
    default: {
      if (!id.startsWith(SET_PREFIX)) return null;
      const raw = id.slice(SET_PREFIX.length);
      const set = getSet(raw);
      return set ? page(set.label, "Which banks of this set run, and how much of each the prompt sends.", <AntiSlopSetPage env={env} raw={raw} />) : null;
    }
  }
}
