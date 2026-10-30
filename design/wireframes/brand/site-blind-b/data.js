/* Site content. Plain objects so the site works from file:// and GitHub Pages alike. */
window.BK = window.BK || {};

BK.REPO = "Coneja-Chibi/Bunzai";
BK.RELEASES_PAGE = "https://github.com/Coneja-Chibi/Bunzai/releases";

BK.SAMPLE_RELEASES = [
  {
    tag_name: "v0.1.42",
    name: "The Prompting wing",
    published_at: "2026-09-25T16:00:00Z",
    html_url: "https://github.com/Coneja-Chibi/Bunzai/releases",
    body: "- Pick a preset per scene.\n- Switch prompts and samplers per scene.\n- Imported presets keep their example dialogue.",
    assets: [
      { name: "Bunzai-0.1.42-setup.exe", size: 96888832 },
      { name: "Bunzai-0.1.42.dmg", size: 108527616 },
      { name: "Bunzai-0.1.42.AppImage", size: 102760448 }
    ]
  },
  {
    tag_name: "v0.1.41",
    name: "Scenes can talk",
    published_at: "2026-09-18T16:00:00Z",
    html_url: "https://github.com/Coneja-Chibi/Bunzai/releases",
    body: "- Chat with any character.\n- Swipes and retries.\n- Replies cut off by a crash come back.",
    assets: [
      { name: "Bunzai-0.1.41-setup.exe", size: 96260096 },
      { name: "Bunzai-0.1.41.dmg", size: 107950080 },
      { name: "Bunzai-0.1.41.AppImage", size: 102236160 }
    ]
  },
  {
    tag_name: "v0.1.40",
    name: "Takes and cuts",
    published_at: "2026-09-11T16:00:00Z",
    html_url: "https://github.com/Coneja-Chibi/Bunzai/releases",
    body: "- Branch scenes into takes.\n- Cut messages can be restored for 3 days.\n- Portrait cards in the Library.",
    assets: [
      { name: "Bunzai-0.1.40-setup.exe", size: 95420416 },
      { name: "Bunzai-0.1.40.dmg", size: 107216896 },
      { name: "Bunzai-0.1.40.AppImage", size: 101711872 }
    ]
  }
];

BK.DEMO = {
  character: "Wren",
  role: "Ticket-taker at the Moonlit Playhouse",
  user: "I think I lost my ticket. Can I still come in?",
  replies: [
    "Wren taps the brim of her cap. “Lost it? Then we’ll find you a new one.” She tears a fresh stub from the roll and presses it into your hand. “Row C. Best view of the stage, if you don’t mind the draft.”",
    "Wren squints at you over the counter. “Everyone says that. Tell me what tonight’s play is about and I’ll believe you.” Her smile gives her away before you can even answer.",
    "Wren leans in and lowers her voice. “Between us, the best seats are the ones nobody bought. Follow me, and mind the third step. It squeaks.”"
  ]
};

BK.PILLARS = [
  { key: "play", title: "Play scenes", text: "Chat with characters, try another reply, and branch a story when you want to see what else could happen.", route: "#/tour/scenes" },
  { key: "make", title: "Make things", text: "Write your own characters, worlds, and presets, and see exactly what your AI will be sent.", route: "#/tour/workbench" },
  { key: "keep", title: "Keep your library", text: "Bring cards in from other apps, keep them private and encrypted, and take them anywhere you like.", route: "#/tour/library" }
];

BK.FEATURES = [
  {
    slug: "scenes",
    name: "Scenes",
    tagline: "Where you play.",
    intro: "A scene is a chat with one of your characters. It remembers everything, and it lets you rewind, retry, and wander off in new directions.",
    points: [
      ["Chat", "Talk to any character in your library, using your own AI key."],
      ["Swipe for another reply", "Not quite right? Swipe to see a different answer. Your earlier ones stay right there."],
      ["Takes", "Branch a story at any message. Each branch is a take, and you can hop between them."],
      ["Stop and keep", "Stop a reply halfway and keep what was written so far."],
      ["Presets per scene", "Give each scene its own preset, and switch single prompts on or off without touching the others."]
    ],
    guide: "swipes-takes"
  },
  {
    slug: "workbench",
    name: "Workbench",
    tagline: "Where you make things.",
    intro: "Editors for characters, lorebooks, and presets, built for people who like to tinker a little but not a lot.",
    points: [
      ["Three editors", "Characters, lorebooks (your worlds), and presets each get an editor made for them."],
      ["See the real prompt", "Look at a preset exactly as it will be sent, before you ever send it."],
      ["Macros with live preview", "Type a macro like the character's name and watch it fill in as you write."],
      ["Side by side", "Open two pieces next to each other, like a character and the world they live in."]
    ],
    guide: "presets"
  },
  {
    slug: "library",
    name: "Library",
    tagline: "Where your things live.",
    intro: "Every character, world, and preset you own, on your computer and nowhere else.",
    points: [
      ["Imports from many apps", "Bring cards from SillyTavern, RoleCall, Chub, and other apps."],
      ["Portrait cards", "Your characters show up as tall portrait cards, so you can find them by face."],
      ["Search", "Find anything by name, tag, or the words inside it."],
      ["Encrypted", "Your library is stored privately and encrypted on your machine."],
      ["Trash", "Deleted something? It waits in the Trash for 3 days before it is gone."]
    ],
    guide: "importing"
  },
  {
    slug: "press",
    name: "Press",
    tagline: "Where things leave.",
    intro: "Send your characters, worlds, and presets out into the world, in the format another app expects.",
    points: [
      ["11 formats", "Export to the formats of 11 other apps."],
      ["An honest report", "If a format can't carry something, Press tells you what will be left behind before you export."]
    ],
    guide: "backups"
  },
  {
    slug: "agent",
    name: "Agent",
    tagline: "A helper for your library.",
    intro: "Ask the Agent to find something, fix something, or draft something new. It shows you the change and asks first.",
    points: [
      ["Find", "“Which of my characters live in the harbor town?”"],
      ["Fix", "Spot typos, broken macros, or lorebook entries that never trigger."],
      ["Draft", "Start a new character or world entry from a few lines of notes."],
      ["Asks before changing", "Nothing in your library changes until you say yes."]
    ],
    guide: "first-scene"
  }
];

BK.GUIDES = [
  {
    slug: "first-scene",
    title: "Your first scene",
    summary: "From a fresh install to your first reply.",
    sections: [
      ["add-key", "Add your AI key", ["Bunzai uses your own AI key to write replies. Open Settings, choose your provider, and paste your key.", "Your key is stored encrypted on your computer. It is only sent to the provider you picked."]],
      ["pick-character", "Pick a character", ["Open the Library and choose a character. No characters yet? Import a card or make one in the Workbench."]],
      ["start", "Start the scene", ["Press Start a scene. The character's first message appears, and you can write back.", "Press Enter to send. Press Shift and Enter together for a new line."]],
      ["next", "What to try next", ["Swipe on a reply to see another one. Branch into a take when you want to try a different path."]]
    ]
  },
  {
    slug: "importing",
    title: "Importing cards",
    summary: "Bring characters in from other apps.",
    sections: [
      ["where", "Where cards come from", ["Bunzai reads cards made in SillyTavern, RoleCall, Chub, and other apps. Most cards are PNG images or JSON files."]],
      ["how", "How to import", ["Drag the file into the Library, or press Import and choose it. You can bring in many files at once."]],
      ["check", "Check what came in", ["Each import shows a short note if anything looked unusual. Open the character in the Workbench to look it over."]],
      ["worlds", "Cards with worlds attached", ["If a card carries a lorebook, Bunzai imports it too and links it to the character."]]
    ]
  },
  {
    slug: "presets",
    title: "Presets and the Prompting wing",
    summary: "Change how your AI writes, scene by scene.",
    sections: [
      ["what", "What a preset is", ["A preset is a bundle of prompts and settings that shapes how replies are written: tone, length, style, and more."]],
      ["per-scene", "A preset for each scene", ["Open a scene, then the Prompting wing. Pick a preset for just this scene. Other scenes keep theirs."]],
      ["toggles", "Switching prompts on and off", ["Every prompt in a preset has a switch. Turn one off for this scene and the others stay as they were."]],
      ["preview", "See what will be sent", ["In the Workbench, open a preset and choose Preview to read the prompt exactly as your AI will get it."]]
    ]
  },
  {
    slug: "swipes-takes",
    title: "Swipes, retries, and takes",
    summary: "Three ways to get a different reply.",
    sections: [
      ["swipes", "Swipes", ["Swipe left or right on the latest reply to flip between versions. Swiping past the last one asks for a new one."]],
      ["retries", "Retries", ["Retry replaces the reply with a fresh attempt, while keeping the old ones among your swipes."]],
      ["takes", "Takes", ["A take is a branch of the story. Start one from any message and the scene splits there. Switch takes from the scene header."]],
      ["stop", "Stopping a reply", ["Press Stop while a reply is being written. Whatever was written so far stays."]],
      ["cuts", "Cut messages", ["Cut a message and it can be restored for 3 days."]]
    ]
  },
  {
    slug: "lorebooks",
    title: "Lorebooks",
    summary: "Build worlds your characters remember.",
    sections: [
      ["what", "What a lorebook is", ["A lorebook is a set of entries about your world: places, people, history. Entries are shared with the AI when they come up."]],
      ["entries", "Writing entries", ["Give each entry a few keywords. When those words show up in the scene, the entry is included."]],
      ["attach", "Attaching a lorebook", ["Link a lorebook to a character, or to a single scene."]],
      ["test", "Testing an entry", ["Use the preview in the Workbench to check that an entry shows up when you expect."]]
    ]
  },
  {
    slug: "backups",
    title: "Backups and moving computers",
    summary: "Keep a copy, and take your library with you.",
    sections: [
      ["backup", "Making a backup", ["Open Settings, then Backups, and press Make a backup. Keep the file somewhere safe, like a USB drive."]],
      ["password", "Your backup password", ["Backups are encrypted. Write the password down. Without it, nobody can open the backup, including us."]],
      ["move", "Moving to a new computer", ["Install Bunzai on the new computer, choose Restore from backup, and pick your file."]],
      ["export", "Exporting to other apps", ["To use your things in another app, open Press and pick the format. Press lists anything that format can't carry."]]
    ]
  },
  {
    slug: "trouble",
    title: "Something went wrong",
    summary: "Common hiccups and how to fix them.",
    sections: [
      ["windows", "Windows doesn't recognize this app", ["This Windows build is unsigned, so Windows may show a reputation warning. The warning does not establish whether the file is safe. Check the release page for a checksum for this exact file and compare it if published. If no checksum is published or it does not match, do not open the download; use the repository's build-from-source instructions."]],
      ["no-reply", "No reply arrives", ["Check that your AI key is added and still has credit. Then try Retry on the scene."]],
      ["cut-off", "A reply was cut off", ["If the app closed while a reply was being written, open the scene again. The reply comes back where it stopped."]],
      ["deleted", "I deleted something by mistake", ["Look in the Trash. Things stay there for 3 days."]],
      ["help", "Still stuck?", ["Open an issue on GitHub and tell us what happened. Screenshots help a lot."]]
    ]
  }
];
