/**
 * Which part of the scene page is away from the chat, and how a panel asks for a wing: the wing in Full Chat, a numbered request the Messenger honours once in the Messenger (use-messenger-nav.ts).
 * The page owns the open wing (`wing`), so it hands it in with its setter; this holds the Messenger's request counter and whether one of its surfaces is open. `away` is either of them.
 */
import { useCallback, useState } from "react";
import { useStageOpen } from "../use-stage-open";
import type { MessengerRequest } from "./use-messenger-nav";

export function useMessengerOpen(messenger: boolean, wing: string | null, setWing: (id: string | null) => void) {
  const [msnRequest, setMsnRequest] = useState<MessengerRequest | null>(null);
  const [msnOpen, setMsnOpen] = useState(false);
  /** A panel asking for a wing (null closes): the wing in Full Chat, its first program in the Messenger. */
  const openWing = useCallback((id: string | null) => (messenger ? setMsnRequest((r) => ({ n: (r?.n ?? 0) + 1, wing: id })) : setWing(id)), [messenger, setWing]);
  /** A mini player's chevron, a Storyboard's gear and the Story Director's link ask for a wing the same way (use-stage-open.ts). */
  const stageRequest = useStageOpen(openWing);
  return { msnRequest, msnOpen, setMsnOpen, openWing, away: wing !== null || msnOpen, stageRequest };
}
