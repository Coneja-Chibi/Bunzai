/**
 * The docked Agent window's Premiere frame: one Panel with the house surface, and Kit's palette remapped onto the
 * theme's own roles for this subtree only. The transcript, ask card, meters and widgets in src/ui/agent are shared with
 * the floating Kit panel and read `--kit-*` colors; remapping those variables on the docked root restyles them here
 * while the floating panel (which renders `section`, not the Panel) keeps Kit's terminal palette untouched.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import { Panel } from "../../components/panel";
import { RoomHeader } from "../../components/room-header";
import { kitVars } from "../../agent/kit-vars";

/** Kit palette name to the theme token that stands in for it in the docked room. */
const REMAP: Record<string, string> = {
  well: "transparent",
  recess: "color-mix(in srgb, var(--stage-black) 42%, transparent)",
  floor: "color-mix(in srgb, var(--stage-black) 42%, transparent)",
  row: "color-mix(in srgb, var(--stage-black) 42%, transparent)",
  panel: "var(--bk-surface-panel)",
  lift: "color-mix(in srgb, var(--accent) 11%, transparent)",
  sunken: "var(--stage-black)",
  seam: "color-mix(in srgb, var(--text) 14%, transparent)",
  div: "color-mix(in srgb, var(--text) 14%, transparent)",
  line: "var(--bk-line)",
  mut: "var(--bk-line-control)",
  text: "var(--text)",
  bright: "var(--text)",
  soft: "var(--text-soft)",
  quiet: "var(--text-dim)",
  gold: "var(--premiere-gold)",
  rose: "var(--accent)",
  red: "var(--bk-role-danger-text)",
  teal: "var(--bk-role-info-text)",
  violet: "var(--bk-role-select)",
  alive: "var(--bk-role-ok)",
  white: "var(--bk-text-on-deep)",
  "verb-list": "var(--bk-role-select)",
  "verb-read": "var(--bk-role-select)",
  "verb-search": "var(--bk-role-select)",
  "verb-triage": "var(--bk-role-select)",
  "verb-inspect": "var(--bk-role-select)",
  "verb-write": "var(--premiere-gold)",
  "verb-shelve": "var(--premiere-gold)",
  "verb-save": "var(--premiere-gold)",
  "verb-import": "var(--premiere-gold)",
  "verb-tag": "var(--premiere-gold)",
  "verb-edit": "var(--premiere-gold)",
  "verb-delete": "var(--bk-role-danger-text)",
  "verb-fetch": "var(--bk-role-action-text)",
  "verb-send": "var(--bk-role-action-text)",
};

const premiereVars = (): CSSProperties => {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(REMAP)) vars[`--kit-${name}`] = value;
  return { ...kitVars(), ...vars } as CSSProperties;
};

/** The room's root: the floating Kit panel keeps a plain section, the docked room is the framed Panel. */
export function RoomFrame({ floating, children }: { floating: boolean; children: ReactNode }): JSX.Element {
  if (floating) return <section className="agent-room" data-room="floating" style={kitVars()}>{children}</section>;
  return (
    <Panel data-part="agent.window" className="agent-room" data-room="docked" style={premiereVars()}>
      {children}
    </Panel>
  );
}

/** The docked header: the shared RoomHeader, with the live dot and the model in its kicker. */
export function DockedHead({ model, watching, standingOn }: { model: string; watching: boolean; standingOn: string | null }): JSX.Element {
  const live = model !== "";
  return (
    <div className="agent-room__head">
      <RoomHeader
        data-part="agent.header"
        kicker={(
          <>
            <span className={`agent-room__dot${live ? " agent-room__dot--live" : ""}`} />
            {live ? model : "no model connected"}
            {watching ? "" : "  ·  not watching the studio folder"}
          </>
        )}
        title="The Agent"
        lede={standingOn ? `Standing on ${standingOn}.` : "No screen has described itself yet. Open another app and come back."}
      />
    </div>
  );
}
