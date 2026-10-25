/** Host-derived room activity shared across shell and separately bundled apps; standalone app mounts are active. */
import { createContext, type Context } from "react";
import { isTopDialog } from "./use-escape-key";

const ACTIVITY = Symbol.for("bunraku.app-activity");
const contexts = globalThis as typeof globalThis & { [ACTIVITY]?: Context<boolean> };
export const AppActivity = contexts[ACTIVITY] ??= createContext(true);

/** The launcher hosts app interaction; other modal prompts own their keys ahead of editor shortcuts. */
export function canUseAppShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || document.querySelector("dialog[open]")) return false;
  const top = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].find(isTopDialog);
  return !top || top.querySelector('[data-part="shell.overlay"]') !== null;
}
