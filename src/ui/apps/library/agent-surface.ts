/**
 * What the Library tells the agent window about itself.
 *
 * Pure, and separate from the room, because this is the text a model reads before it answers a
 * question about somebody's studio. A wrong count or a missing "this listing may be stale" is a
 * confidently wrong answer with nothing to trace it back to, so it is worth being able to check
 * without a browser.
 */
import { useEffect, useRef } from "react";
import type { AgentState, AgentSurfaceSpec } from "../../agent/surface";
import type { AppContext, StudioDamagedEntry, StudioEntitySummary } from "../../app-contract";

/**
 * The static half, which the manifest carries.
 *
 * Beside the live half on purpose: the description and the state it describes drift apart the
 * moment they live in different files, and this room's whole job is being accurate about what is
 * in somebody's studio.
 */
export const LIBRARY_AGENT_SURFACE: AgentSurfaceSpec = {
  describe:
    "Every piece in the studio, sorted into decks, plus anything on disk that would not open.",
  actions: [
    {
      id: "open-piece",
      label: "Open a piece",
      describe: "Put a piece on the Workbench so it can be read or edited.",
    },
    {
      id: "explain-unreadable",
      label: "Explain an unreadable file",
      describe: "Say why a file in the studio folder did not open and what would actually fix it.",
    },
  ],
};

export function libraryAgentState(input: {
  /**
   * The deck's plural display name ("Characters"), or null when every deck is on screen at once
   * (the Carousel), where naming one deck would tell an agent the rest are missing.
   */
  readonly deck: string | null;
  /** The pieces on the shelf being looked at. */
  readonly inDeck: readonly StudioEntitySummary[];
  /** Every piece in the studio, for the total. */
  readonly total: number;
  readonly damaged: readonly StudioDamagedEntry[];
  /** Keys of pieces the user has staged. */
  readonly staged: ReadonlySet<string>;
  /** The studio could not be reached, which is NOT the same as an empty studio. */
  readonly loadFailed: boolean;
  /** The search text filtering this shelf, when one is running. */
  readonly filter?: string;
}): AgentState {
  const notes: string[] = [];

  /**
   * SAID FIRST, because everything after it is unreliable. An agent that read an empty listing as
   * "your studio is empty" when the truth was "the server did not answer" would be telling somebody
   * their work is gone.
   */
  if (input.loadFailed) {
    notes.push("The studio could not be reached, so this listing may be empty or out of date.");
  }

  notes.push(`The studio holds ${String(input.total)} pieces in total.`);

  /**
   * SAID BEFORE THE LISTING IT EXPLAINS. A search hides pieces; it does not remove them. Without
   * this line an agent reading a filtered shelf of three off a deck of forty has every reason to
   * answer "you have three characters", which is the same lie the no-match notice exists to stop
   * the screen from telling.
   */
  if (input.filter) {
    notes.push(
      `A search for "${input.filter}" is filtering this shelf. Pieces that do not match are ` +
        "hidden, not missing, so this listing is not the whole deck.",
    );
  }

  /**
   * Named, not counted. These are the single most likely thing to be asked about in this room, and
   * the reason attached to each one is now specific enough to act on.
   */
  if (input.damaged.length > 0) {
    notes.push(
      `${String(input.damaged.length)} file(s) in the studio folder did not open: ` +
        input.damaged.map((d) => `${d.kind}/${d.id}.json (${d.reason})`).join(", "),
    );
  }

  return {
    headline:
      `${input.deck === null ? "Every deck" : `The ${input.deck} shelf`}, showing ${String(input.inDeck.length)} of ` +
      `${String(input.total)} pieces in the studio.`,
    /**
     * THE SHELF, NOT THE STUDIO. What is in front of somebody is the deck they are looking at.
     * Handing over all 164 pieces on every screen would bury the answer to "what is this" under a
     * catalogue, and the total is already in the notes where a count belongs.
     */
    items: input.inDeck.map((e) => ({
      kind: e.kind,
      id: e.id,
      name: e.name,
      ...(input.staged.has(`${e.kind}:${e.id}`) ? { focused: true } : {}),
    })),
    notes,
  };
}

/**
 * Publish the shelf, and LEAVE IT PUBLISHED.
 *
 * The effect returns nothing on purpose. It used to return the publish call's own result as a
 * cleanup, which withdrew the snapshot when this room unmounted - and since the shell swaps apps
 * through one slot, opening the agent window is exactly what unmounts this room. The window then
 * read null on the one navigation it exists for. See live-state.ts.
 *
 * The dependency list is compared by VALUE where it can be. `inDeck` is rebuilt on every render of
 * the room, so it is reduced to a fingerprint rather than passed by identity; without that this
 * effect re-ran and republished on every keystroke anywhere in the app.
 */
export function usePublishLibrarySurface(
  ctx: AppContext,
  input: Parameters<typeof libraryAgentState>[0],
): void {
  const { deck, inDeck, total, damaged, staged, loadFailed, filter } = input;
  /** Cheap and stable: what is on the shelf, not the array that happens to hold it this render. */
  const shelfKey = inDeck.map((e) => `${e.kind}:${e.id}`).join(",");
  const damagedKey = damaged.map((d) => `${d.kind}:${d.id}:${d.reason}`).join(",");

  /** What is staged, not how much: swapping one selection for another keeps the size identical. */
  const stagedKey = [...staged].sort().join(",");

  /**
   * `ctx` is held rather than depended on. It is rebuilt on EVERY shell store write - a status-bar
   * message, a workbench tab, a deck chip - and having it in the dependency list meant this effect
   * re-ran during app switches, republishing the outgoing screen under the incoming app's name.
   */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    ctxRef.current.agent.publish(
      libraryAgentState({ deck, inDeck, total, damaged, staged, loadFailed, filter }),
    );
    // The keys stand in for inDeck, damaged and staged, which are new objects on every render.
    // Comparing those by identity fired this on every keystroke anywhere in the app. `filter` is a
    // string and belongs here on its own: typing in the search box IS a change of what is on
    // screen, unlike the render echo the keys exist to absorb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, shelfKey, damagedKey, stagedKey, total, loadFailed, filter]);
}
