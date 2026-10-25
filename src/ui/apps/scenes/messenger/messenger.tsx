/**
 * The Messenger as the scene page mounts it: the shell (messenger-chrome.tsx) with its stylesheet. The sheet is kept out of the shell itself so the shell's tests, which ask the
 * DOM what is visible, do not run against a sheet this large (jsdom resolves styles one rule at a time).
 */
import type { JSX } from "react";
import { MessengerChrome, type MessengerChromeProps } from "./messenger-chrome";
import { MESSENGER_STYLE } from "./messenger-style";

export function Messenger(props: MessengerChromeProps): JSX.Element {
  return <><style>{MESSENGER_STYLE}</style><MessengerChrome {...props} /></>;
}
