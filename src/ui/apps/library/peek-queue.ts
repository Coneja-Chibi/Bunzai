/**
 * Card close-ups on demand, a few at a time.
 *
 * A peek reads the whole piece, and for a lorebook that means decrypting and parsing the book. A
 * carousel of every deck asking for all of them at mount is a studio-sized burst of reads for cards
 * nobody has scrolled to. So a card asks only once it is near the screen, and at most LIMIT reads
 * run at once; the rest wait their turn.
 *
 * A FAILURE IS NEVER REMEMBERED. The likeliest failure is the library locking mid-read (a 423). A
 * cached null would leave those cards blank after the person unlocks again, with nothing to say why.
 */
import { useEffect, useState, type RefCallback } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { pieceKey, type PiecePeek } from "./view-contract";

const LIMIT = 3;

export interface PeekQueue {
  /** the cached peek, when one has arrived */
  cached(e: StudioEntitySummary): PiecePeek | undefined;
  /** ask for a piece's peek; resolves null on failure (and forgets it, so the next ask retries) */
  request(e: StudioEntitySummary): Promise<PiecePeek | null>;
  /** discard every cache and reject any read started before a Library lifetime change */
  reset(lifetime: number | null): void;
}

export function createPeekQueue(
  peek: (e: StudioEntitySummary) => Promise<PiecePeek | null>,
  isCurrent: (e: StudioEntitySummary, lifetime: number) => boolean = () => true,
): PeekQueue {
  const done = new Map<string, { identity: string; value: PiecePeek }>();
  const current = new Map<string, string>();
  const inFlight = new Map<string, Promise<PiecePeek | null>>();
  const waiting: (() => void)[] = [];
  let running = 0;
  let lifetime: number | null = 0;
  let epoch = 0;

  const identityOf = (e: StudioEntitySummary): string =>
    JSON.stringify([e.writeId ?? 0, e.version ?? 0, e.revision ?? ""]);
  const requestKeyOf = (key: string, identity: string): string => `${epoch}\0${key}\0${identity}`;

  const currentIdentity = (e: StudioEntitySummary): { key: string; identity: string } => {
    const key = pieceKey(e);
    const identity = identityOf(e);
    if (current.get(key) !== identity) {
      current.set(key, identity);
      if (done.get(key)?.identity !== identity) done.delete(key);
    }
    return { key, identity };
  };

  /** Reserved synchronously: counting after the await let every caller see a free slot at once. */
  const slot = (): Promise<void> => {
    if (running < LIMIT) {
      running += 1;
      return Promise.resolve();
    }
    return new Promise<void>((go) => waiting.push(go));
  };

  /** A finished read hands its slot straight to the next waiter, so the count never dips and refills. */
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  };

  return {
    reset(nextLifetime) {
      if (lifetime === nextLifetime) return;
      lifetime = nextLifetime;
      epoch++;
      done.clear();
      current.clear();
    },
    cached(e) {
      if (lifetime === null || !isCurrent(e, lifetime)) return undefined;
      const { key, identity } = currentIdentity(e);
      const entry = done.get(key);
      return entry?.identity === identity ? entry.value : undefined;
    },
    request(e) {
      const requestedLifetime = lifetime;
      if (requestedLifetime === null || !isCurrent(e, requestedLifetime)) return Promise.resolve(null);
      const key = pieceKey(e);
      const identity = identityOf(e);
      if (current.has(key) && current.get(key) !== identity) return Promise.resolve(null);
      current.set(key, identity);
      const cache = done.get(key);
      if (cache?.identity === identity) return Promise.resolve(cache.value);
      const requestKey = requestKeyOf(key, identity);
      const pending = inFlight.get(requestKey);
      if (pending) return pending;
      const requestedEpoch = epoch;
      const run = (async () => {
        await slot();
        try {
          if (requestedEpoch !== epoch || lifetime !== requestedLifetime || current.get(key) !== identity || !isCurrent(e, requestedLifetime)) return null;
          const got = await peek(e);
          if (got && requestedEpoch === epoch && lifetime === requestedLifetime && current.get(key) === identity && isCurrent(e, requestedLifetime)) {
            done.set(key, { identity, value: got });
            return got;
          }
          return null;
        } finally {
          release();
          inFlight.delete(requestKey);
        }
      })();
      inFlight.set(requestKey, run);
      return run;
    },
  };
}

/**
 * The peek for one card, fetched once the card comes within a screen of view. Returns the ref to
 * put on the card, and the peek (undefined until it arrives, or while a failed one waits to retry).
 */
export function useCardPeek(
  queue: PeekQueue,
  e: StudioEntitySummary,
): [RefCallback<HTMLElement>, PiecePeek | undefined] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [peek, setPeek] = useState<PiecePeek | undefined>(() => queue.cached(e));

  useEffect(() => {
    const cached = queue.cached(e);
    if (peek !== cached) setPeek(cached);
    if (!el || cached) return;
    let live = true;
    const seen = new IntersectionObserver(
      (entries) => {
        if (!live || !entries.some((x) => x.isIntersecting)) return;
        seen.disconnect();
        void queue.request(e).then((got) => {
          if (live && got) setPeek(got);
        });
      },
      { rootMargin: "100% 100%" },
    );
    seen.observe(el);
    return () => {
      live = false;
      seen.disconnect();
    };
  }, [queue, e, el, peek]);

  return [setEl, peek];
}
