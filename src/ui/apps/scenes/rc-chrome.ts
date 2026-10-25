/**
 * What a scene sheet needs to wear RoleCall's chrome without changing any other theme (plan 19). Doer 1's tokens (--rc-radius*, --rc-text-*, --rc-zinc-*)
 * already resolve per theme; this adds the two things they do not cover. `rcScope` puts a sheet's rules under the root attribute the "rolecall" chrome
 * paints (`html[data-chrome="rolecall"]`), so a look that is RoleCall's alone (Final Cut's neobrut frames, the message action bar) never reaches another
 * theme. `RC_SIZE_STYLE` defines the sub-12px sizes RoleCall draws labels at (--rc-s-10px and the rest): in RoleCall's chrome they are the real size, in
 * every other theme they are that theme's own small-text size, so the 12px floor still holds there.
 */
export const RC = 'html[data-chrome="rolecall"]';

/** A sheet written for `.scs` / `.sct`, re-rooted under RoleCall's chrome. */
export const rcScope = (css: string): string => css.replaceAll(".scs ", `${RC} .scs `).replaceAll(".sct", `${RC} .sct`);

const SIZES = ["8px", "9px", "10px", "11px", ".55rem", ".62rem", ".64rem", ".68rem", ".7rem", ".72rem"] as const;
const name = (size: string): string => `--rc-s-${size.replace(".", "p")}`;
/** `var(--rc-s-10px)`: the size to use where RoleCall draws text smaller than 12px. */
export const rcSize = (size: (typeof SIZES)[number]): string => `var(${name(size)})`;

export const RC_SIZE_STYLE = `
:root{${SIZES.map((s) => `${name(s)}:var(--text-meta)`).join(";")};--rc-r-portrait:0}
${RC}{${SIZES.map((s) => `${name(s)}:${s}`).join(";")};--rc-r-portrait:16px}
`;
