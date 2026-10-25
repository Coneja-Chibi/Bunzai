/**
 * The scene.reasoning surface (approved wireframe rc-port/scene-reasoning-themes.html): the two blocks above a reply,
 * the provider's native reasoning first ("Backstage - Native Reasoning") and the thinking written inside the reply's own
 * tags second ("Behind the Scene"), each a header button over a body, collapsed to a snippet by default. This file is
 * the "core" look, RoleCall's two cards with the glass taken out; a theme that picks program-note, slot-tab, slab-note
 * or footnote only restyles this same markup (variants/scene.reasoning), and the numerals of the last two are the one
 * thing the pick adds. What the blocks hold, say and remember is scene-reasoning-core.ts. The hidden parts (snippet, copy,
 * body) are never in the tree when they should not show, so no variant needs to hide a control.
 */
import { useReducer, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import { chooseOpen, durationLabel, isOpen, snippetOf, type ReasoningKind, type ReasoningProps } from "./scene-reasoning-core";
import { useCopyFeedback } from "../../_shared/use-copy-feedback";

export interface ReasoningBlocksProps extends ReasoningProps {
  /** The reply has no text of its own: the thinking is all there is, so its blocks open. */
  only: boolean;
  onCopy(text: string): Promise<boolean>;
}

const LABEL = { native: "Backstage - Native Reasoning", tags: "Behind the Scene" } as const;

interface BlockProps {
  segment: string;
  kind: ReasoningKind;
  text: string;
  ms: number | undefined;
  /** The numeral a look draws, or undefined. */
  no: string | undefined;
  live: boolean;
  thinking: boolean;
  core: boolean;
  auto: boolean;
  cap: boolean;
  only: boolean;
  onCopy(text: string): Promise<boolean>;
}

function Block({ segment, kind, text, ms, no, live, thinking, core, auto, cap, only, onCopy }: BlockProps): JSX.Element {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [copied, copy] = useCopyFeedback(text, onCopy);
  const open = isOpen({ key: segment, kind, live, auto, only });
  const native = kind === "native";
  return (
    <div className={`rb rb-${native ? "nat" : "tag"}${open ? " rb-open" : ""}${core ? " rb-core" : ""}${thinking ? " rb-thinking" : ""}`} data-part="scene.reasoning" data-kind={native ? "native" : "tags"} data-open={open}>
      <button type="button" className="rb-hd" aria-expanded={open} data-part="scene.reasoning.header" onClick={() => { chooseOpen(segment, kind, !open); redraw(); }}>
        {core && <span className="rb-ico" data-part="scene.reasoning.icon"><Ic name={native ? "lucide:theater" : "lucide:clapperboard"} size={16} /></span>}
        <span className="rb-info">
          <span className="rb-chip" data-part="scene.reasoning.label">{no && <b className="rb-no" data-part="scene.reasoning.number">{no}</b>}{LABEL[kind]}</span>
          <span className="rb-dur" data-part="scene.reasoning.duration">{durationLabel(kind, ms, thinking)}{thinking && <span className="rb-dots" data-dots="" aria-hidden="true"><i /><i /><i /></span>}</span>
          {!open && <span className="rb-snip" data-part="scene.reasoning.snippet">{snippetOf(text)}</span>}
        </span>
        <span className="rb-cv" data-part="scene.reasoning.chevron"><Ic name="lucide:chevron-down" size={14} /></span>
      </button>
      <button type="button" className="rb-copy" aria-label={`Copy ${native ? "native reasoning" : "thinking"}`} data-part="scene.reasoning.copy" onClick={copy}>
        {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}
      </button>
      {open && (
        <div className="rb-bd" data-part="scene.reasoning.body" {...(cap ? { "data-cap": "true", tabIndex: 0 } : {})}>
          {core && native && <div className="rb-cur" data-part="scene.reasoning.curtain">Before the curtain</div>}
          {text}
          {thinking && <span className="caret" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}

/** The blocks of one message; nothing at all when it has no thinking. */
export function ReasoningBlocks(p: ReasoningBlocksProps): JSX.Element | null {
  const variant = useSurfaceVariant("scene.reasoning");
  if (!p.rNat && !p.rTag) return null;
  const numbered = variant === "slot-tab" ? 2 : variant === "footnote" ? 1 : 0;
  const no = (n: 1 | 2): string | undefined => (numbered === 2 ? `0${n}` : numbered === 1 ? String(n) : undefined);
  const shared = { segment: p.rKey ?? "", live: p.rLive === true, core: variant === "core", auto: p.rAuto !== false, cap: p.rCap === true, only: p.only, onCopy: p.onCopy };
  return (
    <div className="rb-list">
      {p.rNat && <Block {...shared} kind="native" text={p.rNat} ms={p.rNatMs} no={no(1)} thinking={p.rDots === "native"} />}
      {p.rTag && <Block {...shared} kind="tags" text={p.rTag} ms={p.rTagMs} no={no(p.rNat ? 2 : 1)} thinking={p.rDots === "tags"} />}
    </div>
  );
}
