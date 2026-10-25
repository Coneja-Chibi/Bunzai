/**
 * The memory ChatStore's own-setting fields: the scene's
 * connection, preset, lorebook choices, and switched-on Props. Split from chat-store.ts for the
 * file-size cap; each setter merges or clears one field on the chat record, bumping no version and
 * moving no updatedAt (rules 18 to 21).
 */
import type { Chat, ChatStore } from "../../contracts/chat-store";
import { checkVariantId, turnOpenConflict } from "../cast-rules";
import { checkConnection, checkLore, checkProps } from "../chat-rules";
import { checkPreset } from "../preset-rules";
import { checkOpening } from "../opening-rules";
import { checkBackdrop } from "../backdrop-rules";
import { checkPrompting, mergePrompting } from "../prompting-rules";
import { checkCompendium, mergeCompendium } from "../compendium-rules";
import { applyParticipantChange, checkParticipantChange } from "../participant-rules";
import { checkRegex, mergeRegex } from "../regex-rules";
import { checkFinalCut, mergeFinalCut } from "../final-cut-rules";
import { checkTracker, checkTrackerModule, mergeTrackers } from "../tracker-rules";
import type { ChatRecord } from "./chat-records";

export interface SettingsDeps {
  chats: Map<string, ChatRecord>;
  /** Whether a live take of the chat has an open checkpoint (rule 26). */
  turnOpen: (chatId: string) => boolean;
  clock: () => number;
  newId: () => string;
}

type SettingsMethods = Pick<ChatStore, "setConnection" | "setPreset" | "setLore" | "setProps" | "setOpening" | "setPrompting" | "setCompendium" | "updateParticipants" | "setRegex" | "setFinalCut" | "setTracker" | "setBackdrop" | "setVariant">;

export function settingsMethods(d: SettingsDeps): SettingsMethods {
  const setOwnField = (chatId: string, merge: (chat: Chat) => Chat): Chat | null => {
    const record = d.chats.get(chatId);
    if (!record || record.deletedAt !== null) return null;
    record.chat = merge(record.chat);
    return structuredClone(record.chat);
  };

  return {
    async setConnection(chatId, connectionRaw) {
      const connection = checkConnection(connectionRaw);
      return setOwnField(chatId, ({ connection: _old, ...rest }) => (connection ? { ...rest, connection } : rest));
    },
    async setPreset(chatId, presetRaw) {
      const preset = checkPreset(presetRaw);
      return setOwnField(chatId, ({ preset: _old, ...rest }) => (preset ? { ...rest, preset } : rest));
    },
    async setLore(chatId, loreRaw) {
      const lore = checkLore(loreRaw);
      return setOwnField(chatId, ({ lore: _old, ...rest }) => (lore ? { ...rest, lore } : rest));
    },
    async setVariant(chatId, variantRaw) {
      const variantId = checkVariantId(variantRaw);
      if (d.turnOpen(chatId) && d.chats.get(chatId)?.deletedAt === null) throw turnOpenConflict();
      return setOwnField(chatId, ({ variantId: _old, ...rest }) => (variantId ? { ...rest, variantId } : rest));
    },
    async setProps(chatId, propsRaw) {
      const props = checkProps(propsRaw);
      return setOwnField(chatId, ({ props: _old, ...rest }) => (props ? { ...rest, props } : rest));
    },
    async setPrompting(chatId, patchRaw) {
      const patch = checkPrompting(patchRaw);
      return setOwnField(chatId, ({ prompting: old, ...rest }) => {
        const prompting = mergePrompting(old, patch);
        return prompting ? { ...rest, prompting } : rest;
      });
    },
    async setCompendium(chatId, patchRaw) {
      const patch = checkCompendium(patchRaw);
      return setOwnField(chatId, ({ compendium: old, ...rest }) => {
        const compendium = mergeCompendium(old, patch);
        return compendium ? { ...rest, compendium } : rest;
      });
    },
    async updateParticipants(chatId, changeRaw) {
      const change = checkParticipantChange(changeRaw);
      const record = d.chats.get(chatId);
      if (!record || record.deletedAt !== null) return null;
      const { participants: old, ...rest } = record.chat;
      const participants = applyParticipantChange(old, change, d.clock(), d.newId);
      record.chat = participants ? { ...rest, participants } : rest;
      return structuredClone(record.chat);
    },
    async setRegex(chatId, patchRaw) {
      const patch = checkRegex(patchRaw);
      return setOwnField(chatId, ({ regex: old, ...rest }) => {
        const regex = mergeRegex(old, patch);
        return regex ? { ...rest, regex } : rest;
      });
    },
    async setFinalCut(chatId, patchRaw) {
      const patch = checkFinalCut(patchRaw);
      return setOwnField(chatId, ({ finalCut: old, ...rest }) => {
        const finalCut = mergeFinalCut(old, patch);
        return finalCut ? { ...rest, finalCut } : rest;
      });
    },
    async setTracker(chatId, moduleRaw, patchRaw) {
      const module = checkTrackerModule(moduleRaw);
      const patch = checkTracker(module, patchRaw);
      return setOwnField(chatId, ({ trackers: old, ...rest }) => {
        const trackers = mergeTrackers(old, module, patch);
        return trackers ? { ...rest, trackers } : rest;
      });
    },
    async setBackdrop(chatId, backdropRaw) {
      const backdrop = checkBackdrop(backdropRaw);
      return setOwnField(chatId, ({ backdrop: _old, ...rest }) => (backdrop ? { ...rest, backdrop } : rest));
    },
    async setOpening(chatId, openingRaw) {
      const opening = checkOpening(openingRaw);
      return setOwnField(chatId, ({ opening: _old, ...rest }) => (opening ? { ...rest, opening } : rest));
    },
  };
}
