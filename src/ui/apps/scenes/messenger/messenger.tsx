/**
 * The Messenger as the scene page mounts it: the shell (messenger-chrome.tsx) with its stylesheet, and the settings layer wired to the page's wing arguments. The sheet is kept out of the
 * shell itself so the shell's tests, which ask the DOM what is visible, do not run against a sheet this large (jsdom resolves styles one rule at a time).
 */
import type { JSX } from "react";
import { MessengerChrome, type MessengerChromeProps } from "./messenger-chrome";
import { MESSENGER_STYLE } from "./messenger-style";
import { boothProgramBody } from "./panels/booth";
import { castProgramBody } from "./panels/cast";
import { loreProgramBody } from "./panels/lore";
import { workshopProgramBody } from "./panels/workshop";
import { PersonaSwap } from "./shell/persona-swap";
import { SettingsHost } from "./shell/settings-host";
import { onChatOf, type WingArgs } from "./wing-props";

/** `args` is what the settings content reads of the page; null while the scene loads, which leaves the settings layer unopened. */
export function Messenger({ args, ...props }: Omit<MessengerChromeProps, "renderSettings" | "renderPersonaSwap" | "onChat"> & { args: WingArgs | null }): JSX.Element {
  return (
    <>
      <style>{MESSENGER_STYLE}</style>
      <MessengerChrome {...props} renderProgram={(p, open) => castProgramBody(p, args, open, () => props.renderProgram(p, open)) ?? boothProgramBody(p, args, open) ?? loreProgramBody(p, args) ?? workshopProgramBody(p, args) ?? props.renderProgram(p, open)} renderSettings={(scope, onClose, open) => (args ? <SettingsHost args={args} scope={scope} onClose={onClose} onOpen={open} /> : null)}
        renderPersonaSwap={(onClose, onNew) => (args ? <PersonaSwap args={args} onClose={onClose} onNew={onNew} /> : null)} onChat={(chat) => { if (args) onChatOf(args)(chat); }} />
    </>
  );
}
