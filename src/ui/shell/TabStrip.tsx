/**
 * Open-piece tabs and the overlay launcher above the canvas.
 */
import type { CSSProperties, JSX, MouseEvent } from "react";
import type { StudioEntitySummary } from "../app-contract";
import { deckMeta } from "../_shared/decks";
import { Stamp } from "../components/stamp";
import { StudioUpdate } from "./StudioUpdate";
import { keyOf, paneKeyOf } from "./store-core";
import { useContextMenu, useShellStore } from "./store";

function Tab({ piece, active, beside }: { piece: StudioEntitySummary; active: boolean; beside: boolean }): JSX.Element {
  const focusPiece = useShellStore((s) => s.focusPiece);
  const requestPieceClose = useShellStore((s) => s.requestPieceClose);
  const dirty = useShellStore((s) => s.dirtyPieces[keyOf(piece.id, piece.kind)] === true);
  const menuRef = useContextMenu(() => ({ type: "entity", label: piece.name, data: piece }));
  const focusHint = piece.params?.focusEntry;
  const label = focusHint ? `${piece.name} · entry` : piece.name;

  const onClose = (e: MouseEvent): void => {
    e.stopPropagation();
    requestPieceClose(piece.id, piece.kind, focusHint);
  };

  return (
    <button
      ref={menuRef}
      data-part="shell.tabs.tab"
      className={`tab${active ? " active" : ""}${beside ? " beside" : ""}`}
      style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}
      onClick={() => focusPiece(piece.id, piece.kind, focusHint)}
      // Delete-to-close is the WAI-ARIA dismissible-tab pattern: the visible x is a mouse
      // affordance (a nested real button inside a button is invalid HTML), so the keyboard path
      // lives on the tab itself.
      onKeyDown={(e) => {
        if (e.key === "Delete") {
          e.stopPropagation();
          requestPieceClose(piece.id, piece.kind, focusHint);
        }
      }}
      title={`${focusHint ? `${piece.name} (focused entry)` : piece.name} · Delete closes`}
    >
      <span className="pip" />
      {label}
      {dirty && <span className="dirty" title="unsaved changes">&#9679;</span>}
      <span className="kind">{deckMeta(piece.kind).short}</span>
      <span className="close" aria-hidden="true" onClick={onClose}>
        &times;
      </span>
    </button>
  );
}

export function TabStrip({ onOpenOverlay }: { onOpenOverlay(): void }): JSX.Element {
  const openPieces = useShellStore((s) => s.openPieces);
  const activeKey = useShellStore((s) => s.activeKey);
  const splitKey = useShellStore((s) => s.splitKey);
  const manifests = useShellStore((s) => s.manifests);
  const mountApp = useShellStore((s) => s.mountApp);

  const openAnother = (): void => {
    const lib = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
    if (lib) mountApp(lib.id);
  };

  return (
    <nav id="tabstrip" data-part="shell.tabs" className={openPieces.length > 0 ? "hastabs" : undefined} aria-label="Open pieces">
      {openPieces.map((p) => (
        <Tab
          key={paneKeyOf(p)}
          piece={p}
          active={paneKeyOf(p) === activeKey}
          beside={paneKeyOf(p) === splitKey}
        />
      ))}
      <button id="tabadd" title="Open another" onClick={openAnother}>
        +
      </button>
      <span className="tabfill" />
      <span id="topact">
        <StudioUpdate compact />
        <Stamp id="appMenuBtn" onClick={onOpenOverlay}>
          Overlay <kbd>Ctrl+K</kbd>
        </Stamp>
      </span>
    </nav>
  );
}
