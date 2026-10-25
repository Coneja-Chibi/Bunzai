/**
 * AnimatedThemeToggler adapts Magic UI's circular View Transition reveal to Bunraku's controlled
 * paper/stage theme store and existing Stamp control. Unsupported browsers and reduced-motion users
 * get the same immediate theme switch without animation.
 * Source inspiration: https://magicui.design/docs/components/animated-theme-toggler (MIT).
 */
import { Ic } from "../../_shared/ic";
import { useCallback, useRef } from "react";
import type { JSX } from "react";
import { flushSync } from "react-dom";
import { Stamp } from "../stamp";
import { DEFAULT_THEME_NAME, nextStudioTheme, type BuiltinStudioTheme, type StudioTheme } from "../../../studio/settings-shape";
import { canvasColorFor, runOverlayReveal } from "./overlay-reveal";
import {
  circleTransitionClipPaths,
  themeRevealStrategy,
  transitionOrigin,
} from "./transition-core";
import styles from "./styles.module.css";

/** Display names for the bundled themes the toggle cycles. */
const BUILTIN_THEME_NAMES: Readonly<Record<BuiltinStudioTheme, string>> = { greenroom: DEFAULT_THEME_NAME, theater: "Theater", paper: "Paper", stage: "GirliePop" };

interface ThemeViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
}

type ThemeDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeViewTransition;
};

export interface AnimatedThemeTogglerProps {
  theme: StudioTheme;
  onToggle: () => void;
  duration?: number;
  fromCenter?: boolean;
  id?: string;
}

/** Switch between paper and stage with a reveal that grows from the control. */
export function AnimatedThemeToggler({
  theme,
  onToggle,
  duration = 400,
  fromCenter = false,
  id,
}: AnimatedThemeTogglerProps): JSX.Element {
  const transitioning = useRef(false);
  const nextTheme = nextStudioTheme(theme);
  // theme-key-ok: this toggle cycles only the bundled themes, and Paper is the one light one
  const isDark = theme !== "paper";

  const toggle = useCallback(
    (button: HTMLButtonElement): void => {
      const root = document.documentElement;
      const viewDocument = document as ThemeDocument;
      const strategy = themeRevealStrategy({
        supported: typeof viewDocument.startViewTransition === "function",
        reduceMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
        userAgent: navigator.userAgent,
      });
      if (strategy === "none") {
        onToggle();
        return;
      }
      if (transitioning.current || root.dataset.vaudeThemeTransition === "active") return;

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = button.getBoundingClientRect();
      const origin = transitionOrigin(rect, viewport, fromCenter);
      const clipPath = circleTransitionClipPaths(origin, viewport);

      if (strategy === "overlay") {
        const incomingColour = canvasColorFor(nextTheme, root);
        if (!incomingColour) {
          // No readable page colour means no honest sweep to draw; switch rather than flash a wrong one.
          onToggle();
          return;
        }
        transitioning.current = true;
        void runOverlayReveal({
          origin,
          clipPath,
          incomingColour,
          durationMs: duration,
          commit: onToggle,
        }).finally(() => {
          transitioning.current = false;
        });
        return;
      }

      transitioning.current = true;
      root.dataset.vaudeThemeTransition = "active";
      root.style.setProperty("--vaude-theme-transition-duration", `${duration}ms`);
      root.style.setProperty("--vaude-theme-transition-clip-from", clipPath[0]);

      const cleanup = (): void => {
        transitioning.current = false;
        delete root.dataset.vaudeThemeTransition;
        root.style.removeProperty("--vaude-theme-transition-duration");
        root.style.removeProperty("--vaude-theme-transition-clip-from");
      };

      let transition: ThemeViewTransition;
      try {
        transition = viewDocument.startViewTransition(() => flushSync(onToggle));
      } catch {
        cleanup();
        onToggle();
        return;
      }

      void transition.finished.then(cleanup, cleanup);
      void transition.ready.then(
        () => {
          root.animate(
            { clipPath },
            {
              duration,
              easing: "ease-in-out",
              fill: "forwards",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        },
        () => undefined,
      );
    },
    [duration, fromCenter, nextTheme, onToggle],
  );

  const label = `Switch to ${BUILTIN_THEME_NAMES[nextTheme as BuiltinStudioTheme] ?? nextTheme} theme`;
  return (
    <Stamp id={id} onClick={(event) => toggle(event.currentTarget)} title={label} aria-label={label}>
      <span className={styles.iconStack} aria-hidden="true">
        <Ic name="lucide:moon" className={isDark ? styles.hidden : styles.shown} size={16} />
        <Ic name="lucide:sun" className={isDark ? styles.shown : styles.hidden} size={16} />
      </span>
    </Stamp>
  );
}
