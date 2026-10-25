/**
 * What every Settings section is handed (index.tsx builds it once): the app, the scene, the one writer of the scene's choices
 * (`use-scene-compendium.ts`), the scene's books, the model list, and the guide library. A section is a drop-in file that takes
 * these and draws one card; none owns state of its own beyond what it is typing.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../../../app-contract";
import type { GuideRecord } from "../../../../../../core/guide-record";
import type { Chat, ChatCompendiumPatch } from "../../../../../../stage/contracts/chat-store";
import type { SceneCompendium } from "../../../use-scene-compendium";
import type { SceneLore } from "../../../use-scene-lore";
import type { SceneModels } from "../../../use-scene-models";

export interface SectionProps {
  ctx: AppContext;
  chat: Chat;
  compendium: SceneCompendium;
  lore: SceneLore;
  models: SceneModels;
  /** The Guides the person can attach; null until the library has been read, an empty list when it could not be. */
  guides: readonly GuideRecord[] | null;
  /** The book open in the Compendium, for the rows that act on one (Revert Last Standardization, the tree choices and Import chat history). */
  bookId: string | undefined;
  /** Saves a change; a refusal is said in the status line, never thrown into the page. */
  set(change: ChatCompendiumPatch): Promise<void>;
}

export type SettingsView = "essentials" | "advanced";
export type SectionComponent = (props: SectionProps) => JSX.Element;
