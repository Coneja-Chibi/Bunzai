/* Site content. Plain objects so the page works from file:// with no fetches. */
window.BUNRAKU_DATA = {
  repo: "Coneja-Chibi/Bunraku",
  releasesPage: "https://github.com/Coneja-Chibi/Bunraku/releases",

  sampleReleases: [
    {
      tag_name: "v0.1.42",
      name: "The Prompting wing",
      published_at: "2026-09-25T12:00:00Z",
      html_url: "https://github.com/Coneja-Chibi/Bunraku/releases",
      body: "- Pick a preset for each scene.\n- Switch prompts and samplers on and off per scene.\n- Imported presets keep their example dialogue.",
      assets: [],
      sample: true
    },
    {
      tag_name: "v0.1.41",
      name: "Scenes can talk",
      published_at: "2026-09-18T12:00:00Z",
      html_url: "https://github.com/Coneja-Chibi/Bunraku/releases",
      body: "- Chat with any character.\n- Swipes and retries.\n- Replies cut off by a crash come back.",
      assets: [],
      sample: true
    },
    {
      tag_name: "v0.1.40",
      name: "Takes and cuts",
      published_at: "2026-09-11T12:00:00Z",
      html_url: "https://github.com/Coneja-Chibi/Bunraku/releases",
      body: "- Branch scenes into takes.\n- Cut messages can be restored for 3 days.\n- Portrait cards in the Library.",
      assets: [],
      sample: true
    }
  ],

  /* Sample download sizes, shown only when live release data is not available. */
  sampleSizes: { windows: "94 MB", mac: "108 MB", linux: "101 MB" },

  systems: {
    windows: { name: "Windows", detail: "Windows 10 and 11", file: "Installer (.exe)", exts: [".exe", ".msi"] },
    mac: { name: "Mac", detail: "macOS 12 or newer", file: "Disk image (.dmg)", exts: [".dmg"] },
    linux: { name: "Linux", detail: "Most 64-bit distributions", file: "AppImage", exts: [".appimage", ".deb", ".rpm"] }
  },

  demo: {
    character: "Marigold",
    role: "keeper of the night market lanterns",
    you: "The last lantern just went out. Is that... bad?",
    replies: [
      "Marigold snaps her fingers and a tiny flame hops onto her thumb. \"Bad? Only for the moths. Hold this, and whatever you do, don't let it hear you whisper.\"",
      "She goes very still, then laughs. \"Oh, it's not out. It's hiding. Lanterns get shy when strangers stare. Turn around and count to three with me.\"",
      "\"It means the market is closing early tonight.\" She tugs your sleeve toward the dark stalls. \"Which means the good stuff comes out. Stay close, and keep your coins in your shoe.\""
    ]
  },

  features: [
    {
      slug: "scenes",
      name: "Scenes",
      kicker: "Play",
      short: "Chat with your characters. Swipe for another reply, or branch the story into takes.",
      lead: "A scene is one story with one or more characters. You write, they answer, and you stay in charge of where it goes.",
      points: [
        { t: "Chat that feels like a story", d: "Write as yourself or as your persona. Replies arrive as they are written, so you can read along." },
        { t: "Swipe for another reply", d: "Not feeling it? Swipe to see a different answer. Every version stays, so you can flip back any time." },
        { t: "Branch into takes", d: "Want to see what happens if you had said something else? Start a new take from any message. The original stays safe." },
        { t: "Stop a reply and keep it", d: "Hit stop halfway through and keep what was written. Good for cutting a ramble short." },
        { t: "A preset for each scene", d: "Every scene can use its own preset. Switch single prompts on and off without touching your other scenes." }
      ],
      guide: "swipes-retries-takes"
    },
    {
      slug: "workbench",
      name: "Workbench",
      kicker: "Make",
      short: "Editors for characters, lorebooks and presets, with live previews as you go.",
      lead: "The Workbench is where you make and fix things. Characters, lorebooks and presets each get an editor that shows you what you are doing.",
      points: [
        { t: "Character editor", d: "Name, description, personality, first message, example dialogue. Everything a card holds, in plain fields." },
        { t: "Lorebook editor", d: "Write world entries and the words that bring them up in a scene." },
        { t: "Preset editor", d: "Arrange prompts, set samplers, and see the whole prompt exactly as it will be sent." },
        { t: "Macros with live preview", d: "Use things like {{char}} and {{user}} and see what they turn into while you type." },
        { t: "Two pieces side by side", d: "Open a character next to its lorebook, or two presets next to each other, and copy between them." }
      ],
      guide: "presets-prompting"
    },
    {
      slug: "library",
      name: "Library",
      kicker: "Keep",
      short: "Every card, world and preset you own, as portrait cards you can search.",
      lead: "Your Library holds everything you bring in or make. It lives on your computer, encrypted, and nobody else can read it.",
      points: [
        { t: "Imports from many apps", d: "Bring cards from SillyTavern, RoleCall, Chub and other apps. Drag files in and Bunraku sorts them out." },
        { t: "Portrait cards", d: "Characters show up as tall cards with their art, so you can find them by face." },
        { t: "Search", d: "Type a name, a tag or a word from a description and the Library narrows down as you type." },
        { t: "Encrypted on your machine", d: "Your library is stored privately and encrypted on your own computer. No account and no cloud." },
        { t: "A Trash that waits", d: "Deleted something by mistake? The Trash keeps it for 3 days before it is gone for good." }
      ],
      guide: "importing-cards"
    },
    {
      slug: "press",
      name: "Press",
      kicker: "Share",
      short: "Export to 11 other apps' formats, with a clear note about anything that won't fit.",
      lead: "The Press turns your work into files other apps can open, so you are never locked in.",
      points: [
        { t: "11 formats", d: "Export characters, lorebooks and presets for 11 other apps, including SillyTavern and RoleCall." },
        { t: "A report, not a surprise", d: "Some formats can't carry everything. Before you save, the Press lists exactly what will be left out." },
        { t: "Your original stays whole", d: "Exporting never changes the copy in your Library." }
      ],
      guide: "backups-moving"
    },
    {
      slug: "agent",
      name: "Agent",
      kicker: "Help",
      short: "A helper that finds, fixes or drafts things in your library, and asks before changing anything.",
      lead: "The Agent is a helper that knows your Library. Ask it to find something, tidy something, or draft something new.",
      points: [
        { t: "Find", d: "\"Which of my characters mention a lighthouse?\" The Agent looks through your Library and shows you." },
        { t: "Fix", d: "Spot a broken macro or a lorebook entry that never fires, and suggest a fix." },
        { t: "Draft", d: "Sketch a new character or a world entry from a few lines you give it." },
        { t: "Asks first", d: "The Agent never changes anything on its own. You see every change and say yes or no." }
      ],
      guide: "first-scene"
    }
  ],

  guides: [
    {
      slug: "first-scene",
      title: "Your first scene",
      blurb: "From opening the app to your first reply, in about five minutes.",
      sections: [
        { id: "add-a-key", h: "Add your AI key", p: ["Bunraku uses your own AI key to write replies. Open Settings, choose your provider, and paste your key. It is stored encrypted on your computer and only sent to the provider you picked."] },
        { id: "pick-a-character", h: "Pick a character", p: ["Open the Library and choose a character. If your Library is empty, import a card first (see Importing cards) or make one in the Workbench."] },
        { id: "start", h: "Start the scene", p: ["Press Start a scene. The character's first message appears. Type your reply at the bottom and press Enter to send."] },
        { id: "next", h: "What to try next", p: ["Swipe on a reply to see a different one. Start a take from any message to try another path. Everything saves as you go."] }
      ]
    },
    {
      slug: "importing-cards",
      title: "Importing cards",
      blurb: "Bring characters, worlds and presets in from other apps.",
      sections: [
        { id: "what-works", h: "What you can bring in", p: ["Character cards from SillyTavern, RoleCall, Chub and other apps. PNG cards with the character tucked inside work, and so do JSON files. Lorebooks and presets come in too."] },
        { id: "how", h: "How to import", p: ["Drag files onto the Library, or press Import and pick them. You can bring in many at once."] },
        { id: "after", h: "After importing", p: ["Each import becomes a portrait card in your Library. If something in a file could not be read, Bunraku tells you what it was and keeps the rest."] }
      ]
    },
    {
      slug: "presets-prompting",
      title: "Presets and the Prompting wing",
      blurb: "What presets do, and how to change them for one scene.",
      sections: [
        { id: "what", h: "What a preset is", p: ["A preset is the set of instructions and settings sent with every message. It shapes how the AI writes: length, tone, what it pays attention to."] },
        { id: "per-scene", h: "A preset per scene", p: ["Open the Prompting wing inside a scene to pick which preset it uses. Changing it here only affects this scene."] },
        { id: "toggles", h: "Switching prompts on and off", p: ["Each preset is made of small prompts. Flip any of them on or off for the current scene, and adjust samplers like temperature without editing the preset itself."] },
        { id: "preview", h: "See what gets sent", p: ["In the Workbench, the preset editor shows the full prompt exactly as it will be sent, with macros filled in."] }
      ]
    },
    {
      slug: "swipes-retries-takes",
      title: "Swipes, retries, and takes",
      blurb: "Three ways to get a different answer, and when to use each.",
      sections: [
        { id: "swipes", h: "Swipes", p: ["Swipe on the latest reply to ask for another version. Every version is kept. Swipe back to return to an earlier one."] },
        { id: "retries", h: "Retries", p: ["If a reply fails or stops early, press Retry. If the app closed in the middle of a reply, the part that was written comes back when you reopen the scene."] },
        { id: "takes", h: "Takes", p: ["A take is a branch of your story. Start one from any message to try a different path. Switch between takes whenever you like; none of them are lost."] },
        { id: "stop", h: "Stopping a reply", p: ["Press Stop while a reply is being written. What was written so far stays in the scene."] }
      ]
    },
    {
      slug: "lorebooks",
      title: "Lorebooks",
      blurb: "Give your world a memory with entries that appear when they matter.",
      sections: [
        { id: "what", h: "What a lorebook is", p: ["A lorebook is a set of notes about your world. Each entry has a few trigger words. When one of those words comes up in the scene, the entry is added to what the AI sees."] },
        { id: "writing", h: "Writing good entries", p: ["Keep entries short and specific. One place, person or thing per entry works best."] },
        { id: "attach", h: "Attaching a lorebook", p: ["Attach a lorebook to a character or to a single scene from the Workbench or the scene's side panel."] }
      ]
    },
    {
      slug: "backups-moving",
      title: "Backups and moving computers",
      blurb: "Keep a copy of your Library and take it with you.",
      sections: [
        { id: "backup", h: "Making a backup", p: ["Open Settings and choose Back up library. You get one file with everything in it. Keep it somewhere safe, like a USB drive."] },
        { id: "restore", h: "Moving to a new computer", p: ["Install Bunraku on the new computer, open Settings, and choose Restore from backup. Pick your backup file and your Library comes back."] },
        { id: "export", h: "Exporting single pieces", p: ["To share one character or move it to another app, use the Press. It exports to 11 formats and tells you if anything won't fit."] }
      ]
    },
    {
      slug: "something-wrong",
      title: "Something went wrong",
      blurb: "Common hiccups and how to get past them.",
      sections: [
        { id: "windows-warning", h: "Windows says it doesn't recognize the app", p: ["Bunraku is new, so Windows may show a blue box saying it protected your PC. Click More info, then Run anyway. You only need to do this once."] },
        { id: "no-reply", h: "The character doesn't reply", p: ["Check that your AI key is added in Settings and that your provider account has credit. The error message in the scene says which one it is."] },
        { id: "import-failed", h: "A card won't import", p: ["Some files are damaged or use a format Bunraku doesn't know yet. The import report says what went wrong. The rest of your files still come in."] },
        { id: "lost-something", h: "I deleted something by mistake", p: ["Look in the Trash. Deleted things stay there for 3 days and can be restored in one click."] }
      ]
    }
  ]
};
