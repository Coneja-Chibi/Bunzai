/** Whether a theme's editor.frame variant is in charge of the layout; "core" keeps each editor's own arrangement. */
import type { ReactNode } from "react";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import { EditorField } from "./layout/editor-field";
import type { EditorSection, FieldMeter } from "./layout/editor-layout-core";
import framedStyles from "./framed.module.css";

export const useFramed = (): boolean => useSurfaceVariant("editor.frame") !== "core";

/** Hosts that give a virtualized list the definite height it needs inside a section. */
export const framed = framedStyles;

interface FieldSpec {
  label: string;
  wide?: boolean;
  hint?: string;
  meter?: FieldMeter;
}

/**
 * One field of a framed editor: under a theme frame the control is labelled by EditorField (so every editor.fields
 * variant reaches it); in core `plain` wraps the same control in the editor's own label markup, unchanged.
 */
export function fieldOr(themed: boolean, spec: FieldSpec, control: ReactNode, plain: (control: ReactNode) => ReactNode): ReactNode {
  return themed ? <EditorField label={spec.label} wide={spec.wide} hint={spec.hint} meter={spec.meter}>{control}</EditorField> : plain(control);
}

/**
 * Where an editor's tool rail goes under the current frame. The document-like frames (long-form, card-stack) put a
 * rail first, which pushes the editor's real work below the fold, so there the rail becomes the last section.
 */
export const useRailLast = (): boolean => {
  const frame = useSurfaceVariant("editor.frame");
  return frame === "long-form" || frame === "card-stack";
};

export function useRail(rail: ReactNode, title: string): { rail: ReactNode; tail: EditorSection[] } {
  const last = useRailLast();
  if (rail == null || !last) return { rail, tail: [] };
  return { rail: undefined, tail: [{ id: "tools", title, node: rail }] };
}

/** Bring a panel the person just asked for into view and put the cursor in its first field; no smooth scroll when motion is reduced. */
export function revealAndFocus(panel: HTMLElement | null): void {
  if (!panel) return;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  panel.scrollIntoView?.({ block: "start", behavior: reduced ? "auto" : "smooth" });
  panel.querySelector<HTMLElement>("input:not([type=checkbox]), textarea, select")?.focus({ preventScroll: true });
}
