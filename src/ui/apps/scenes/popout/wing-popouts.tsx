/**
 * The wing bodies as pop-out kinds: one per Messenger program that draws a wing's body (Control Booth, Cast, Lorebooks, Prompting, Final Cut, Context). The kind's id is `panel.<program id>`, so
 * `popout.panel.<program id>` remembers whether it floats and where. The body is never drawn twice: the shell renders each program once into its holder node (messenger/shell/program-holders.tsx)
 * and a surface only hosts that node, so a floating copy is the same node moved, and the docked surface shows "is floating" while it is away. `render` is the shell's way to host the holder.
 * Titles, icons and wings repeat messenger/programs.ts; wing-popouts.test.tsx fails when they drift.
 */
import type { JSX } from "react";
import type { IconName } from "../../../_shared/ic";
import type { PopoutKind } from "./popout-kind";

interface Spec { program: string; title: string; noun: string; icon: IconName; /** Floating width in px: a Wide panel floats wider. */ width: number }

export const WING_BODY_SPECS: readonly Spec[] = [
  { program: "quickplay", title: "Control Booth", noun: "Control Booth", icon: "lucide:zap", width: 420 },
  { program: "characters", title: "Characters", noun: "Character editor", icon: "lucide:contact-round", width: 560 },
  { program: "persona", title: "My Persona", noun: "Persona editor", icon: "lucide:user-round", width: 560 },
  { program: "participants", title: "Participants", noun: "Participants", icon: "lucide:users-round", width: 420 },
  { program: "lorebook", title: "Lorebooks", noun: "Lorebooks", icon: "lucide:book-open", width: 460 },
  { program: "prompts", title: "Generation", noun: "Generation", icon: "lucide:sliders-horizontal", width: 560 },
  { program: "guides", title: "Guides", noun: "Guides", icon: "lucide:compass", width: 560 },
  { program: "author-note", title: "Scene Note", noun: "Scene note", icon: "lucide:sticky-note", width: 420 },
  { program: "writing-tools", title: "Writing Helpers", noun: "Writing helpers", icon: "lucide:pen-line", width: 420 },
  { program: "regex", title: "Regex Workshop", noun: "Regex workshop", icon: "lucide:regex", width: 560 },
  { program: "post-production", title: "Final Cut", noun: "Final Cut", icon: "lucide:scissors", width: 560 },
  { program: "inspector", title: "Context Inspector", noun: "Context inspector", icon: "lucide:scan-search", width: 560 },
  { program: "memory", title: "Memory", noun: "Memory", icon: "lucide:history", width: 420 },
];

export const popoutIdOf = (programId: string): string => `panel.${programId}`;

/** The kinds, each drawing its body with `body(programId)`. A fresh list per call; the ids and the saved places are the same every time. */
export const wingBodyPopouts = (body: (programId: string) => JSX.Element): PopoutKind[] =>
  WING_BODY_SPECS.map((s, i) => ({ id: popoutIdOf(s.program), title: s.title, noun: s.noun, icon: s.icon, width: s.width, top: 96 + (i % 6) * 28, render: () => body(s.program) }));

const META: ReadonlyMap<string, PopoutKind> = new Map(wingBodyPopouts(() => <></>).map((k, i) => [WING_BODY_SPECS[i]!.program, k]));

/** The kind a program floats as (for its placeholder and its saved state), or undefined for a program that does not float. */
export const popoutKindOfProgram = (programId: string): PopoutKind | undefined => META.get(programId);
