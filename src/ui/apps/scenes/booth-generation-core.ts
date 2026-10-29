/**
 * The Control Booth's Generation rules. RoleCall warns when Max Context is at the model's window and the
 * window is large (QuickPlayPanel.tsx:2013-2019, VVS-643): every message then resends that much history.
 * Bunzai's Context tokens left unset send up to the window too (presetWindow never goes past a stated
 * window), so unset counts as maxed. A window the connection does not state is unknown: no warning, never
 * an invented number (RoleCall's three different fallbacks, flaw F3). Pure.
 */
export const MAXED_WINDOW = 65_536;

/** The number of history tokens a message may resend when Context tokens is at the window, else null. */
export function contextMaxed(windowTokens: number | undefined, maxContext: number | undefined): number | null {
  if (windowTokens === undefined || windowTokens < MAXED_WINDOW) return null;
  const effective = Math.min(maxContext ?? windowTokens, windowTokens);
  return effective >= windowTokens ? effective : null;
}
