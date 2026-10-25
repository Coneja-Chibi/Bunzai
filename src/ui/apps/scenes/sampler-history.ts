/**
 * The messages the Max Messages estimate reads (scene-preset-parts.tsx's SamplerBar): the page of the take the
 * scene has loaded, and the take's live count. The scene page provides it around its wings, so the bar
 * reads the chat without three components passing it down; absent, the bar says it is estimating.
 */
import { createContext } from "react";
import type { Message } from "../../../stage/contracts/chat-store";

export interface SamplerHistory { messages: readonly Message[]; total: number }

export const SamplerHistoryContext = createContext<SamplerHistory | undefined>(undefined);
