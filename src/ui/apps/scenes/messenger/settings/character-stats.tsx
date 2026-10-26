/**
 * The character page's hero (wireframe SCOPES.char, "3 scenes, 1 lorebook"): real counts. Scenes are the Scenes list's own rows for this character (`scenesOfCharacter` over the one
 * cached `listScenes` read); lorebooks are the books the card bundles (source "character" in the scene's lore list). A count that could not be read is left out, never shown as zero.
 */
import { useEffect, useState, type JSX } from "react";
import { plural } from "../../../../../core/text";
import type { SceneSummary } from "../../../../../studio/scenes";
import type { SceneLoreBook } from "../../../../app-contract-scenes";
import { scenesOfCharacter, useRecentCharacters } from "../use-recent-characters";
import type { WingArgs } from "../wing-props";


/** "3 scenes, 1 lorebook"; a null count is not named, and nothing known gives an empty line. */
export function characterCounts(scenes: readonly SceneSummary[] | null, characterId: string, books: readonly SceneLoreBook[] | null): string {
  const parts: string[] = [];
  if (scenes) parts.push(plural(scenesOfCharacter(scenes, characterId).length, "scene"));
  if (books) parts.push(plural(books.filter((b) => b.source === "character").length, "lorebook"));
  return parts.join(", ");
}

export function CharacterHero({ a }: { a: WingArgs }): JSX.Element {
  const { recents } = useRecentCharacters(a.ctx.api);
  const [books, setBooks] = useState<SceneLoreBook[] | null>(null);
  const chatId = a.scene.chat.id;
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => a.ctx.api.getSceneLore(chatId)).then((l) => { if (live) setBooks(l.books); }, () => { if (live) setBooks(null); });
    return () => { live = false; };
  }, [a.ctx.api, chatId]);
  const line = characterCounts(recents.state === "ready" ? recents.scenes : null, a.scene.chat.cast.character.id, books);
  return <><h2 className="msn-st-h1">{a.name}</h2>{line !== "" && <p className="msn-st-secd" data-part="scene.messenger.settings.hero.counts">{line}</p>}</>;
}
