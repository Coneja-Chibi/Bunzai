/**
 * The agent, floating over whatever you are actually doing.
 *
 * THE POINT. A dock app is mounted into the shell's one slot, so opening the agent unmounts the
 * screen it is describing - you have to leave the Workbench to ask about the Workbench. This panel
 * sits above the canvas instead, so the piece you are asking about stays on screen and stays live
 * underneath while the answer arrives. Orison's shape, and the reason it is the right one.
 *
 * IT IS THE SAME ROOM. `AgentRoom` renders inside; there is no second agent, no second transcript
 * and no second conversation. Opening the dock tile and opening this panel show the same thing,
 * because they are the same component reading the same session.
 *
 * NOT MODAL, deliberately. Nothing behind it is blocked or dimmed. A modal agent would be the dock
 * app's problem again wearing an overlay's clothes: you could not click the thing you were asking
 * about while asking about it.
 */
import { useState, type JSX } from "react";
import { useEscapeKey } from "../_shared/use-escape-key";
import type { AppContext } from "../app-contract";
import { AgentRoom } from "../apps/agent/room";
import { useFloatingPanel } from "./use-floating";
import type { Edge } from "./dock-position";
import { useKitVars } from "./kit-vars";
import { PREF_PANEL_MINIMISED } from "../apps/agent/styles";
import { Button, IconButton } from "../components/button";
import styles from "./floating-agent.module.css";

/** Every edge and corner, in one place, so the handles and the geometry cannot disagree. */
const EDGES: readonly Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export function FloatingAgent({
  ctx,
  open,
  onClose,
}: {
  ctx: AppContext;
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const panel = useFloatingPanel();
  const kitStyle = useKitVars();
  /** Parked as a tab rather than thrown away. Remembered, so a reload does not reopen it over you. */
  const [minimised, setMinimised] = useState(() => ctx.prefs.get(PREF_PANEL_MINIMISED) === true);

  /**
   * Escape closes through the shared arbiter (_shared/use-escape-key.ts), so a dialog on top keeps the press and a
   * press an inner control already spent does not close the panel. Not from a text box: the panel is mostly a
   * composer, and a person half way through typing a question who hits escape to dismiss an autocomplete would
   * otherwise lose the question instead.
   */
  useEscapeKey(onClose, open, { outsideFields: true });

  if (!open) return null;

  /**
   * MINIMISED IS NOT CLOSED. Closing throws the panel away; this parks it as a tab in the corner
   * that opens again on a click, so the conversation, the queue and the draft are all still there
   * when you come back. It stays minimised across a reload, because the alternative is a window
   * that keeps reopening itself over whatever you were looking at.
   */
  if (minimised) {
    return (
      <div className={styles.tab} style={kitStyle}>
        <Button
          size="sm"
          data-agent-panel="min"
          title="Open the agent"
          onClick={() => { setMinimised(false); ctx.prefs.set(PREF_PANEL_MINIMISED, false); }}
        >
          <span className={styles.grip} aria-hidden="true" />
          {"THE AGENT"}
        </Button>
      </div>
    );
  }

  return (
    <section
      data-agent-panel=""
      className={panel.dragging || panel.resizing ? `${styles.panel} ${styles.panelDrag}` : styles.panel}
      /**
       * KIT PALETTE AT THE PANEL ROOT, not only on the room inside it. The chrome - the drag bar,
       * the close key, the frame - is styled in --kit-* too, and variables set on the inner room
       * would not reach outward to it. The panel would have kept the studio theme while its
       * contents wore Kit.
       */
      style={{
        ...kitStyle,
        left: `${String(panel.spot.x)}px`,
        top: `${String(panel.spot.y)}px`,
        width: `${String(panel.size.width)}px`,
        height: `${String(panel.size.height)}px`,
      }}
      aria-label="The Agent"
    >
      {/* The whole header is the grab handle, minus the close button. */}
      <header className={styles.bar} onPointerDown={panel.onGrab}>
        <span className={styles.grip} aria-hidden="true" />
        <span className={styles.title}>{"THE AGENT"}</span>
        <IconButton
          size="sm"
          icon="lucide:minus"
          label="Minimise the agent"
          title="Shrink to a tab; nothing is lost"
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={() => { setMinimised(true); ctx.prefs.set(PREF_PANEL_MINIMISED, true); }}
        />
        <IconButton
          size="sm"
          icon="lucide:x"
          label="Close the agent"
          // Stopped, or pressing close would start a drag on the way down.
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={onClose}
        />
      </header>

      <div className={styles.body}>
        {/* The same close the corner key runs, handed inward so `/quit` means something: a browser
            cannot exit, and the nearest true thing this command can do is shut the panel. */}
        <AgentRoom ctx={ctx} onClose={onClose} />
      </div>

      {/*
        EIGHT HANDLES, GENERATED. Written out one by one they drift: somebody fixes the south-east
        corner and the south-west keeps the old behaviour, and nobody notices because nobody pulls
        every edge. The geometry is one function; so is the markup.
      */}
      {EDGES.map((edge) => (
        <span
          key={edge}
          className={`${styles.handle} ${styles[`h${edge}`] ?? ""}`}
          data-edge={edge}
          onPointerDown={(e) => { panel.onResize(edge, e); }}
        />
      ))}
    </section>
  );
}
