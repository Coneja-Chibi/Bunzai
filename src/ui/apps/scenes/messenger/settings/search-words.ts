/**
 * What the settings search can find inside a section. A section's title and description are always searched; this table adds the words a person would type for what is in its body: the labels
 * of its rows, and a few names for the tool-shaped sections (editors, lists, drill pages) that hold no row of their own to index. Keys are `scope:sectionId`. The user scope's preference rows
 * come straight from the row tables in rows.ts and user/pref-rows.ts, so a renamed row is still found; the rest is written by hand and `search-words.test.ts` fails on a key no section has.
 */
import type { SettingsScope } from "../frames/settings-window";
import { USER_ROWS as R, type RowDef } from "./rows";
import { ACCESS_ROWS, MUSIC_ROWS, WORKBENCH_ROWS } from "./user/pref-rows";

const rowWords = (...defs: readonly RowDef[]): string[] => defs.flatMap((d) => (d.description ? [d.label, d.description] : [d.label]));

export const SECTION_WORDS: Readonly<Record<string, readonly string[]>> = {
  "user:persona": ["name", "persona", "who you play", "profile", "avatar", "default persona", "new scenes"],
  "user:providers": ["provider", "api key", "keys", "connection", "model", "test connection", "openrouter", "anthropic", "openai", "local"],
  "user:away": rowWords(R.chime, R.typing),
  "user:backups": ["backup", "export library", "copies", "restore", "security", "health", "remote access"],
  "user:layout": rowWords(R.layout),
  "user:message": rowWords(R.avatars, R.timestamps, R.opacity, R.gap),
  "user:type": rowWords(R.font, R.size, R.lineHeight).concat(["text colour", "dialogue colour", "your text colour", "character text colour"]),
  "user:motion": rowWords(R.autoScroll, R.fadeIn, R.autoOpenReasoning, R.capReasoning),
  "user:chrome": rowWords(R.compact),
  "user:accent": ["custom accent", "scene accent", "your colour", "colour", "color"],
  "user:theme": ["theme", "theme packages", "dark", "light"],
  "user:reading": rowWords(...ACCESS_ROWS),
  "user:mood": rowWords(R.volume, ...MUSIC_ROWS).concat(["track library", "player"]),
  "user:spotify": ["spotify", "spotify link", "player"],
  "user:studio": ["home", "library opens on", "reopen where you left off", "editor layout", "autosave", "grid", "bento", "playbill"],
  "user:publish": ["publish", "formats", "export"],
  "user:workbench": rowWords(...WORKBENCH_ROWS),
  "user:memory": ["summary", "summaries", "automatic summaries", "summarize every", "summary method", "rolling recap", "growing timeline", "keep recent messages", "summary model", "messages included", "enable reasoning", "truncate messages", "prompt template"],
  "user:machine": ["updates", "about", "engine checkouts", "built-in defaults", "this computer"],

  "character:card": ["name", "tagline", "description", "personality", "scenario", "first message", "greeting", "example dialogue", "content rating", "tags", "look", "variant"],
  "character:version": ["update", "previous version", "revert", "full editor", "workbench"],

  "scene:scene": ["rename", "title", "scene name", "fan favorite", "favourite", "star", "story folder", "folder", "delete scene", "playing as", "cast persona", "play as", "persona details"],
  "scene:right-now": ["model", "narrator model", "favorite models", "starred models", "star", "preset", "quick play", "stream", "loadout", "persona", "lorebooks", "tool rounds", "prefill"],
  "scene:booth-lorebooks": ["lorebook", "world info", "switch on", "switch off"],
  "scene:booth-summary": ["summary", "saved summary", "context"],
  "scene:runtime": ["runtime", "tool rounds", "show prefill", "streaming", "regenerate"],
  "scene:loadouts": ["loadout", "save setup", "load setup", "undo"],
  "scene:preset": ["preset", "prompt blocks", "prompt switches", "choices", "save as default", "prompt editor", "prompt inspector", "debug", "prompts", "prompt order", "marker", "context mode", "post-processing", "template", "workbench"],
  "scene:samplers": ["reset to preset", "changed for this chat", "own tags", "catch tags", "opening tag", "closing tag", "temperature", "top p", "top k", "min p", "repetition", "frequency penalty", "presence penalty", "max tokens", "seed", "logit bias", "stop sequences", "parameters"],
  "scene:guides": ["guide", "writing guide", "injection", "placement", "depth"],
  "scene:note": ["author note", "scene note", "depth", "role", "interval"],
  "scene:helpers": ["rewrite", "fix", "polish", "expand", "draft", "writing tools"],
  "scene:regex": ["regex", "pattern", "script", "find and replace", "rewrite messages"],
  "scene:final-cut": ["final cut", "post production", "pass", "narrator", "polish", "after the narrator"],
  "scene:summary": ["summary", "summarize", "recap", "memory", "context window"],
  "scene:summary-controls": ["summary controls", "every", "keep recent", "hide covered", "method", "automatic"],
  "scene:advanced": ["summary model", "model", "advanced"],
  "scene:opening": ["opening message", "greeting", "first message", "opening text"],
  "scene:prop-tooltips": ["prop tooltips", "tooltips", "props list"],
  "scene:inspector": ["context pressure", "warning mark", "danger mark", "critical mark", "context target", "context inspector", "tokens", "prompt preview", "what the model sees", "macros", "state"],
  "scene:lorebooks": ["lorebook", "world info", "books", "entries", "scan depth", "budget"],
  "scene:compendium": ["compendium", "filed notes", "canon", "access", "chip"],
  "scene:comp-master": ["compendium", "master switch", "use compendium", "model", "narrator explore tool", "lookup", "output language", "language"],
  "scene:comp-books": ["compendium", "books", "access", "read only", "read and write", "write only", "default write book", "make a book"],
  "scene:comp-recall": ["compendium", "recall", "before a reply", "prioritize", "guidance", "guide"],
  "scene:comp-tuning": ["compendium", "retrieval tuning", "max entries", "minimum entries", "detail level", "context messages", "collapsed depth", "multi-book display"],
  "scene:comp-filing": ["compendium", "filing", "after a reply", "file lasting changes", "preserve", "how often", "when to file"],
  "scene:comp-allow": ["compendium", "may file", "entry types", "characters", "locations", "items"],
  "scene:comp-tree": ["compendium", "tree", "granularity", "refine", "placement", "constraints", "locked", "forbidden"],
  "scene:comp-historian": ["compendium", "historian", "interval", "overlap", "summary-aware", "truncation"],
  "scene:comp-ingest": ["compendium", "import chat history", "ingest", "chunk", "tokens per chunk", "continuity", "search", "facts", "narrative"],
  "scene:comp-standardize": ["compendium", "standardize", "batch size", "model source", "auto-retry", "revert"],
  "scene:participants": ["participants", "cast", "on stage", "npc", "members", "mute"],
  "scene:director-style": ["story director", "personality", "patient", "pacing"],
  "scene:director-model": ["story director", "model", "narrator model", "commands", "tool access"],
  "scene:director-runtime": ["story director", "runtime", "tool rounds", "frequency"],
  "scene:director-rules": ["story director", "rules", "guidance"],
  "scene:director-panel": ["story director", "arcs", "analysis", "trace", "story so far"],
  "scene:backdrop": ["backdrop", "background", "picture", "image", "wallpaper", "blur", "dim"],
  "scene:gallery": ["pictures", "gallery", "images", "backdrop"],
  "scene:wardrobe": ["wardrobe", "outfit", "clothes", "looks"],
  "scene:trackers": ["ai context", "every n replies", "update automatically", "trackers", "inventory", "stats", "quests"],
};

/** The scope with each section's search words attached; sections the table does not name keep only their title and description. */
export function withSearchWords(scope: SettingsScope): SettingsScope {
  return {
    ...scope,
    categories: scope.categories.map((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        const words = SECTION_WORDS[`${scope.id}:${s.id}`];
        return words ? { ...s, keywords: words } : s;
      }),
    })),
  };
}
