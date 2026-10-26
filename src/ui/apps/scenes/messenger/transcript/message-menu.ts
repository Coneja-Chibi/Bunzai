/**
 * The Messenger message menu's items (backlog slice 5): the hover bar's own actions, offered under the same conditions and calling the same props, so the menu can never offer what the bar would
 * not. Groups follow shell.html `ctxMenu()`: Edit and Copy; the generate actions; Hide and Final Cut; history and branching; Writing tools; Remove version and Delete. Delete keeps its existing
 * confirm (Delete this and all after goes through the page's dialog). Pure: the caller hands in copy and the highlighted passage.
 */
import { badgeLabel } from "../../../../../core/final-cut/trace";
import type { TextRange } from "../../../../../core/draft-prompts";
import type { BubbleProps } from "../../scene-bubble";
import { WRITING_TOOLS, type ToolId } from "../../writing-tools-core";
import type { MenuEntry, MenuItemSpec } from "../frames/context-menu";

const find = (id: ToolId) => WRITING_TOOLS.find((t) => t.id === id)!;
const tool = (id: ToolId): string => find(id).label;

export interface MenuHands {
  copy(): void;
  /** the passage highlighted in the message, if it is one place in it */
  selection(): TextRange | null;
}

export function messageMenu(p: BubbleProps, hands: MenuHands): MenuEntry[] {
  const idle = p.busy !== true;
  const groups: MenuItemSpec[][] = [
    [
      ...(p.onEdit ? [{ id: "edit", label: "Edit message", icon: "lucide:pen-line" as const, hint: "E", onSelect: () => p.onEdit?.(p.id) }] : []),
      { id: "copy", label: "Copy text", icon: "lucide:copy" as const, hint: "C", onSelect: hands.copy },
    ],
    [
      ...(p.onRegenerate && idle ? [{ id: "regenerate", label: "Regenerate as a new version", icon: "lucide:rotate-ccw" as const, hint: find("regenerate").shortcut, onSelect: () => p.onRegenerate?.() }] : []),
      ...(p.onContinue && idle ? [{ id: "continue", label: "Continue generation", icon: "lucide:play" as const, hint: find("continue").shortcut, onSelect: () => p.onContinue?.() }] : []),
      ...(p.onAskAgain && idle ? [{ id: "ask-again", label: "Ask again for a reply", icon: "lucide:rotate-ccw" as const, onSelect: () => p.onAskAgain?.() }] : []),
    ],
    [
      ...(p.onHide ? [{ id: "hide", label: p.hidden ? "Show to AI" : "Hide from AI", icon: p.hidden ? "lucide:eye-off" as const : "lucide:eye" as const, onSelect: () => p.onHide?.(p.id) }] : []),
      ...(p.finalCut && p.onFinalCut ? [{ id: "final-cut", label: badgeLabel(p.finalCut), icon: "lucide:scissors" as const, onSelect: () => p.onFinalCut?.(p.id) }] : []),
    ],
    [
      ...(p.onUndoEdit && p.historyCount ? [
        { id: "undo-edit", label: "Undo last edit", icon: "lucide:rotate-ccw" as const, onSelect: () => p.onUndoEdit?.(p.id) },
        { id: "edit-history", label: "Edit history", icon: "lucide:history" as const, hint: p.historyCount, onSelect: () => p.onHistory?.(p.id) },
      ] : []),
      ...(p.onBranch ? [{ id: "branch", label: "Branch from here", icon: "lucide:git-branch" as const, onSelect: () => p.onBranch?.(p.id, false) }] : []),
      ...(p.onRetake ? [{ id: "retake", label: "Retake from here", icon: "lucide:rotate-ccw" as const, onSelect: () => p.onRetake?.(p.id, false) }] : []),
    ],
    (p.onGuided || p.onCorrect || p.onExpand) ? [{
      id: "writing-tools", label: "Writing tools", icon: "lucide:sparkles" as const,
      submenu: [
        ...(p.onGuided && idle ? [{ id: "guided", label: p.guidance ? `Edit ${tool("guided").toLowerCase()}` : tool("guided"), icon: "lucide:sparkles" as const, onSelect: () => p.onGuided?.(p.id, p.guidance) }] : []),
        ...(p.onCorrect ? [{ id: "correct", label: tool("correct"), icon: "lucide:wand-sparkles" as const, onSelect: () => p.onCorrect?.(p.id, hands.selection()) }] : []),
        ...(p.onExpand ? [{ id: "expand", label: tool("expand-character"), icon: "lucide:user" as const, onSelect: () => p.onExpand?.() }] : []),
      ],
    }] : [],
    [
      ...(p.onRemoveVersion && idle && p.vCount && p.vCount > 1 && p.vIndex !== undefined
        ? [{ id: "remove-version", label: `Remove version ${p.vIndex + 1} of ${p.vCount}`, icon: "lucide:rotate-ccw" as const, danger: true, onSelect: () => p.onRemoveVersion?.(p.id) }] : []),
      ...(p.onCut ? [{
        id: "delete", label: "Delete", icon: "lucide:trash-2" as const, danger: true,
        submenu: [
          { id: "delete-one", label: "Delete this message", icon: "lucide:trash-2" as const, onSelect: () => p.onCut?.(p.id, "one", false) },
          { id: "delete-from", label: "Delete this & all after", icon: "lucide:trash-2" as const, danger: true, onSelect: () => p.onCut?.(p.id, "from", false) },
        ],
      }] : []),
    ],
  ];
  const out: MenuEntry[] = [];
  for (const g of groups.filter((x) => x.length > 0)) {
    if (out.length) out.push({ id: `sep-${out.length}`, separator: true });
    out.push(...g);
  }
  return out;
}
