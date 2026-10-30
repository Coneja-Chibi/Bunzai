/**
 * Setup step: theme. Owns four theme thumbnails and the stage's BACKWALL
 * zone (the tiny standing app preview that reskins by presence). Copy is verbatim from the locked
 * vs-setup-hybrid artifact. Writes one of the persisted theme ids.
 */
import { Card } from "../../../components/button";
import type { JSX } from "react";
import { DEFAULT_STUDIO_THEME, DEFAULT_THEME_NAME, SETTING_KEYS } from "../../../../studio/settings-shape";
import type { SetupDraft, SetupOption, SetupStep } from "../../step-contract";

const OPTIONS: SetupOption[] = [
  { id: DEFAULT_STUDIO_THEME, title: DEFAULT_THEME_NAME, isDefault: true },
  { id: "theater", title: "Theater" },
  { id: "paper", title: "Paper" },
  { id: "stage", title: "GirliePop" },
];

/** Which thumbnail palette family each bundled theme previews in; a theme not listed previews in the theater family. */
const FLAVOR: Record<string, "light" | "dark" | "greenroom"> = { paper: "light", stage: "dark", [DEFAULT_STUDIO_THEME]: "greenroom" };
const flavorOf = (id: string): "light" | "dark" | "greenroom" | "theater" => FLAVOR[id] ?? "theater";

const CSS = `
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr));gap:.8rem}
.pair>span{display:flex;min-width:0}
.pair [data-control="card"]{width:100%;display:grid;grid-template-rows:auto 1rem minmax(2.5rem,auto);
  gap:.7rem;align-items:center;padding-top:.95rem}
.pair [data-slot="mark"]{grid-row:2}
.pair [data-slot="heading"]{grid-row:3}
.pair [data-control="card"]>.mock{grid-row:1}
.mock{width:100%;aspect-ratio:4/3;border:2px solid currentColor;display:flex;overflow:hidden}
.mock .mbar{width:26%;border-right:2px solid currentColor;display:flex;flex-direction:column;gap:6px;padding:7px 6px}
.mock .mbar span{height:6px;background:currentColor;opacity:.55;display:block}
.mock .mbar span:first-child{opacity:1;width:70%}
.mock .mbody{flex:1;padding:8px;display:flex;flex-direction:column;gap:6px}
.mock .mbody span{height:6px;background:currentColor;opacity:.4;display:block}
.mock .mbody span:nth-child(1){width:60%;opacity:.75}
.mock .mbody span:nth-child(2){width:90%}
.mock .mbody span:nth-child(3){width:80%}
.mock.light{color:var(--preview-paper-ink);background:var(--preview-paper-canvas)}
.mock.dark{color:var(--preview-stage-ink);background:var(--preview-stage-panel)}
.mock.theater{color:var(--preview-theater-edge);background:var(--preview-theater-canvas)}
.mock.greenroom{color:var(--preview-greenroom-edge);background:var(--preview-greenroom-canvas)}
.thumb-name{font-family:var(--font-big);font-weight:600;font-size:1rem}
.backwall{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:1rem;padding:1.75rem 1.5rem 1.25rem;text-align:center}
.wall-note{font-family:var(--font-mono);font-weight:600;font-size:var(--text-meta);letter-spacing:.12em;
  text-transform:uppercase;color:var(--status-fg)} /* the wizard wall is var(--stage): dark in BOTH themes, so
  the ink must be the bright-on-dark pair (stage-soft flips dark in light mode and vanished) */
.preview{width:min(12.25rem,90%);border:3px solid var(--pv-line);background:var(--pv-bg);
  box-shadow:5px 6px 0 0 var(--shadow-ink)}
.preview.dark{--pv-bg:var(--preview-stage-canvas);--pv-line:var(--preview-stage-edge);--pv-top:var(--preview-stage-panel);--pv-dim:var(--preview-stage-edge);--pv-lit:var(--preview-stage-ink)}
.preview.light{--pv-bg:var(--preview-paper-canvas);--pv-line:var(--preview-paper-edge);--pv-top:var(--preview-paper-panel);--pv-dim:var(--preview-paper-edge);--pv-lit:var(--preview-paper-ink)}
.preview.theater{--pv-bg:var(--preview-theater-canvas);--pv-line:var(--preview-theater-edge);--pv-top:var(--preview-theater-panel);--pv-dim:var(--preview-theater-edge);--pv-lit:var(--preview-theater-ink)}
.preview.greenroom{--pv-bg:var(--preview-greenroom-canvas);--pv-line:var(--preview-greenroom-edge);--pv-top:var(--preview-greenroom-panel);--pv-dim:var(--preview-greenroom-edge);--pv-lit:var(--preview-greenroom-ink)}
.pv-top{height:16px;background:var(--pv-top);border-bottom:2px solid var(--pv-line);
  display:flex;align-items:center;gap:4px;padding:0 6px}
.pv-top i{width:6px;height:6px;background:var(--pv-dim);display:block}
.pv-main{display:flex;min-height:6.5rem}
.pv-side{width:34%;border-right:2px solid var(--pv-line);padding:8px 6px;
  display:flex;flex-direction:column;gap:6px}
.pv-side span{height:5px;background:var(--pv-dim);display:block}
.pv-side .lit{width:82%;background:var(--pv-line)}
.pv-body{flex:1;padding:9px 8px;display:flex;flex-direction:column;gap:6px}
.pv-body span{height:6px;background:var(--pv-dim);display:block}
.pv-body span:nth-child(1){width:64%;background:var(--pv-lit)}
.pv-body span:nth-child(2){width:92%}
.pv-body span:nth-child(3){width:78%}
.pv-body .btn{height:12px;width:44%;margin-top:3px;background:var(--pv-line)}
.pv-cap{font-family:var(--font-mono);font-weight:600;font-size:var(--text-meta);letter-spacing:.12em;
  text-transform:uppercase;color:var(--status-fg)} /* bright-on-dark pair; see .wall-note */
`;

function Bars({ cls, count }: { cls: string; count: number }): JSX.Element {
  return (
    <span className={cls}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}

/** The tiny standing app preview, skinned by the chosen theme (presence, not glow). */
function Preview({ theme }: { theme: string }): JSX.Element {
  const flavor = flavorOf(theme);
  return (
    <div className={`preview ${flavor}`}>
      <div className="pv-top">
        <i />
        <i />
        <i />
      </div>
      <div className="pv-main">
        <div className="pv-side">
          <span className="lit" />
          <span />
          <span />
          <span />
        </div>
        <div className="pv-body">
          <span />
          <span />
          <span />
          <span className="btn" />
        </div>
      </div>
    </div>
  );
}

function ThemeOption(opt: SetupOption, pressed: boolean, onPick: () => void): JSX.Element {
  const flavor = flavorOf(opt.id);
  return (
    <Card kind="choice" selected={pressed} aria-pressed={pressed ? "true" : "false"} onClick={onPick}
      heading={<span className="thumb-name">{opt.title}{opt.isDefault && <span className="default-tag">default</span>}</span>}>
      <span className={`mock ${flavor}`}>
        <Bars cls="mbar" count={3} />
        <Bars cls="mbody" count={3} />
      </span>
    </Card>
  );
}

const step: SetupStep = {
  manifest: {
    id: "theme",
    order: 10,
    question: "Choose your theme",
    say: "However you like your workspace. You can flip it any time.",
    settingsKey: SETTING_KEYS.theme,
    layoutClass: "pair",
    stageNote: "it lights as you answer",
  },
  css: CSS,
  options: () => OPTIONS,
  renderOption: ThemeOption,
  renderZone(draft: SetupDraft) {
    const selected = draft[SETTING_KEYS.theme];
    const theme = OPTIONS.find((o) => o.id === selected) ?? OPTIONS[0]!;
    return (
      <div className="backwall">
        <div className="wall-note">your workspace, as you set it</div>
        <Preview theme={theme.id} />
        <div className="pv-cap">{theme.title} workspace</div>
      </div>
    );
  },
  phrase(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.theme]);
    return picked ? { pre: "a ", strong: picked.title.toLowerCase(), post: " workspace" } : null;
  },
  recap(draft) {
    const picked = OPTIONS.find((o) => o.id === draft[SETTING_KEYS.theme]);
    return picked ? { label: "theme", value: picked.title.toLowerCase() } : null;
  },
};

export default step;
