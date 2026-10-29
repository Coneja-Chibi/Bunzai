/* Bunzai site: authored content. Plain data, rendered by app.js.
 * Copy rules: warm, short, plain. No em dashes, no emoji.
 * Inline markup allowed in body strings: <b>, <i class="aside">, <a href="#/...">, <kbd>.
 */
window.BUNZAI = window.BUNZAI || {};

BUNZAI.repo = "Coneja-Chibi/Bunzai";
BUNZAI.studioUrl = "studio/"; // Browser Studio lives beside the site on GitHub Pages.

/* ------------------------------------------------------------------ */
/* Features (tour)                                                     */
/* ------------------------------------------------------------------ */
BUNZAI.features = [
  {
    slug: "scenes",
    num: "I",
    accent: "rose",
    eyebrow: "Play",
    title: ["The", "Scenes"],
    line: "Where you sit down with a character and tell a story together.",
    intro:
      "A scene is one conversation with one character. You write, they answer, and the story goes wherever the two of you take it. Nothing about it is locked in.",
    mock: "scenes",
    items: [
      { t: "Chat with any character", b: "Pick a character from your Library and start a scene. Replies appear as they are written, so you can read along." },
      { t: "Swipe for another reply", b: "Not feeling a reply? Swipe for a fresh one. Every version is kept, so you can swipe back to the one you liked." },
      { t: "Branch into takes", b: "Want to see how things go if you had said something else? Start a new take from any message. The first version stays right where it was." },
      { t: "Stop and keep what was written", b: "Stop a reply halfway if it is heading the wrong way. The part already written stays on the page for you to keep or edit." },
      { t: "A preset for each scene", b: "Each scene can follow its own preset. In the Prompting wing you can switch single prompts and settings on or off for just this scene." },
    ],
    guides: ["first-scene", "swipes-takes", "presets"],
  },
  {
    slug: "workbench",
    num: "II",
    accent: "violet",
    eyebrow: "Make",
    title: ["The", "Workbench"],
    line: "The desk where you build characters, worlds, and presets.",
    intro:
      "The Workbench has an editor for each thing you can make. Change a character's greeting, add a place to a lorebook, or tune a preset, and see the result as you go.",
    mock: "workbench",
    items: [
      { t: "Editors for everything", b: "Characters, lorebooks, and presets each get their own editor, laid out so the important fields come first." },
      { t: "See the prompt as it will be sent", b: "Open a preset and read the exact prompt your AI will receive, in order, with nothing hidden." },
      { t: "Macros with live preview", b: "Use macros like {{char}} and {{user}} and watch them fill in beside your writing as you type." },
      { t: "Two pieces side by side", b: "Open a character next to its lorebook, or two presets next to each other, and work across both." },
    ],
    guides: ["lorebooks", "presets"],
  },
  {
    slug: "library",
    num: "III",
    accent: "cyan",
    eyebrow: "Keep",
    title: ["The", "Library"],
    line: "Every character, world, and preset you own, on one shelf.",
    intro:
      "Your Library is the home for everything you bring in or make. It lives on your computer, it is encrypted, and it is yours.",
    mock: "library",
    items: [
      { t: "Import from the apps you already use", b: "Bring character cards from SillyTavern, RoleCall, Chub, and other apps. Lorebooks and presets come along too." },
      { t: "Portrait cards", b: "Characters show up as tall portrait cards, so you can find someone by their face as fast as by their name." },
      { t: "Search", b: "Type a name, a tag, or a word from a description and the shelf narrows as you type." },
      { t: "Encrypted on your machine", b: "Your Library is stored privately and encrypted on your own computer. It does not live on anyone's server." },
      { t: "A Trash that waits three days", b: "Deleted something by accident? It sits in the Trash for three days before it is gone for good." },
    ],
    guides: ["importing", "backups"],
  },
  {
    slug: "press",
    num: "IV",
    accent: "amber",
    eyebrow: "Share",
    title: ["The", "Press"],
    line: "Send your work out in the format another app understands.",
    intro:
      "The Press turns anything in your Library into a file another app can open. Bunzai can export to 11 other apps' formats.",
    mock: "press",
    items: [
      { t: "Export to 11 formats", b: "Pick a character, lorebook, or preset, pick where it is going, and the Press makes the file." },
      { t: "An honest report", b: "Some formats have no room for certain details. Before you export, the Press lists anything that will not make the trip, so nothing goes missing quietly." },
    ],
    guides: ["backups", "importing"],
  },
  {
    slug: "agent",
    num: "V",
    accent: "emerald",
    eyebrow: "Help",
    title: ["The", "Agent"],
    line: "A helper who knows your Library and always asks first.",
    intro:
      "The Agent can look through your Library for you, tidy something up, or write a first draft. It shows you what it wants to change and waits for your yes.",
    mock: "agent",
    items: [
      { t: "Find", b: "Ask for the lorebook with the lighthouse in it, or every character that uses a certain preset." },
      { t: "Fix", b: "Point it at a broken greeting or a messy lorebook entry and it will suggest a repair." },
      { t: "Draft", b: "Ask for a new character, a set of lorebook entries, or a greeting, and it writes a draft for you to shape." },
      { t: "Asks before changing anything", b: "Every change comes to you first. Nothing in your Library changes until you say yes." },
    ],
    guides: ["first-scene", "lorebooks"],
  },
];

/* ------------------------------------------------------------------ */
/* Guides (help center)                                               */
/* ------------------------------------------------------------------ */
BUNZAI.guides = [
  {
    slug: "first-scene",
    title: "Your first scene",
    blurb: "From download to your first reply in a few minutes.",
    tag: "Start here",
    sections: [
      {
        id: "install",
        h: "Get Bunzai",
        body: [
          "Download Bunzai for your computer from the <a href=\"#/download\">Download page</a>. It works on Windows, Mac, and Linux, and it is free.",
          "Open the file you downloaded. On Windows, the first time you open it, Bunzai adds itself to your Start menu so you can find it again later.",
          "Windows may show a blue box that says it does not recognize the app. That is normal for new apps. <a href=\"#/help/something-wrong/windows-warning\">Here is what to do.</a>",
        ],
      },
      {
        id: "key",
        h: "Add your AI key",
        body: [
          "Bunzai does not come with its own AI. You bring a key from the AI service you like, and Bunzai uses it to write your character's replies.",
          "Paste your key when Bunzai asks for it. It is stored encrypted on your computer along with the rest of your Library.",
        ],
      },
      {
        id: "character",
        h: "Bring a character",
        body: [
          "If you already have character cards from SillyTavern, RoleCall, Chub, or another app, import them into your Library. <a href=\"#/help/importing\">Importing cards</a> walks through it.",
          "Starting fresh? Open the Workbench and make one. A name, a short description, and a greeting are enough to begin.",
        ],
      },
      {
        id: "start",
        h: "Start the scene",
        body: [
          "Pick your character in the Library and start a scene. Their greeting appears first. Write your reply and send it.",
          "The character's answer appears as it is written. If you want it to stop, press Stop. Whatever was already written stays.",
        ],
      },
      {
        id: "next",
        h: "When a reply is not quite right",
        body: [
          "Swipe for a different reply, or press Retry. You can always swipe back. To try a whole new direction, start a take. See <a href=\"#/help/swipes-takes\">Swipes, retries, and takes</a>.",
        ],
      },
    ],
  },
  {
    slug: "importing",
    title: "Importing cards",
    blurb: "Bring characters, lorebooks, and presets from other apps.",
    tag: "Library",
    sections: [
      {
        id: "what",
        h: "What you can bring in",
        body: [
          "Character cards from SillyTavern, RoleCall, Chub, and other roleplay apps. Lorebooks and presets can come in too.",
          "Imported presets keep their example dialogue, so characters sound the way they did before.",
        ],
      },
      {
        id: "how",
        h: "How to import",
        body: [
          "Open the Library and choose Import, then pick the files you want. You can also drag files straight onto the Library.",
          "Each character shows up as a portrait card. Lorebooks and presets get their own shelves.",
        ],
      },
      {
        id: "private",
        h: "Where your imports go",
        body: [
          "Everything you import is stored privately and encrypted on your computer. Nothing is uploaded anywhere.",
        ],
      },
      {
        id: "trouble",
        h: "If a card will not import",
        body: [
          "Make sure the file is the card itself, not a web page or a screenshot of it. Cards are usually PNG or JSON files.",
          "Still stuck? See <a href=\"#/help/something-wrong\">Something went wrong</a> for how to tell us about it.",
        ],
      },
    ],
  },
  {
    slug: "presets",
    title: "Presets and the Prompting wing",
    blurb: "Choose how the AI is told to write, scene by scene.",
    tag: "Scenes",
    sections: [
      {
        id: "what",
        h: "What a preset is",
        body: [
          "A preset is a set of instructions and settings that shapes how the AI writes. One preset might keep replies short and snappy. Another might favor long, slow scenes.",
          "The settings that change how the AI picks its words, such as temperature, are called samplers. Presets hold those too.",
        ],
      },
      {
        id: "wing",
        h: "The Prompting wing",
        body: [
          "Every scene has a Prompting wing. Open it to choose which preset the scene follows.",
          "Inside the wing you can switch single prompts on or off and change samplers for just this scene. The preset itself stays as it was, so your other scenes are not affected.",
        ],
      },
      {
        id: "see",
        h: "See exactly what is sent",
        body: [
          "Curious what the AI actually receives? Open the preset in the Workbench to read the full prompt in the order it will be sent.",
        ],
      },
      {
        id: "imported",
        h: "Presets from other apps",
        body: [
          "When you import a preset, its example dialogue comes with it. You can edit anything afterward in the Workbench.",
        ],
      },
    ],
  },
  {
    slug: "swipes-takes",
    title: "Swipes, retries, and takes",
    blurb: "Get a different reply, or try the story another way.",
    tag: "Scenes",
    sections: [
      {
        id: "swipe",
        h: "Swipes",
        body: [
          "A swipe asks for another version of the character's last reply. Swipe again for more. Every version is kept, so you can swipe back to one you liked.",
        ],
      },
      {
        id: "retry",
        h: "Retry",
        body: [
          "The Retry button asks for the reply again from the same spot. It is handy when a reply stopped early or came back empty.",
        ],
      },
      {
        id: "stop",
        h: "Stopping a reply",
        body: [
          "Press Stop while a reply is being written and it halts right there. What was written so far stays, and you can edit it or keep going.",
          "If Bunzai closes unexpectedly while a reply is being written, that reply comes back the next time you open the scene.",
        ],
      },
      {
        id: "takes",
        h: "Takes",
        body: [
          "A take is a branch of your story. Start one from any message to try a different direction. Your first version stays where it was, and you can hop between takes whenever you like.",
        ],
      },
      {
        id: "cut",
        h: "Cut messages",
        body: [
          "Removed a message by mistake? Cut messages can be restored for three days.",
        ],
      },
    ],
  },
  {
    slug: "lorebooks",
    title: "Lorebooks",
    blurb: "Give your characters a world that remembers itself.",
    tag: "Workbench",
    sections: [
      {
        id: "what",
        h: "What a lorebook is",
        body: [
          "A lorebook is a collection of short notes about a world: places, people, history, rules. When one of those things comes up in a scene, the matching note is given to the AI so it remembers.",
        ],
      },
      {
        id: "entries",
        h: "Entries and keywords",
        body: [
          "Each note is an entry. An entry has a few keywords and some text. When a keyword shows up in the conversation, that entry is included.",
          "Keep entries short and focused. One place or one person per entry works best.",
        ],
      },
      {
        id: "edit",
        h: "Editing a lorebook",
        body: [
          "Open the lorebook in the Workbench. You can put it side by side with the character who uses it, so you can check one against the other.",
        ],
      },
      {
        id: "share",
        h: "Bringing lorebooks in and out",
        body: [
          "Lorebooks import from other apps along with character cards. To send one elsewhere, use the <a href=\"#/tour/press\">Press</a>.",
        ],
      },
    ],
  },
  {
    slug: "backups",
    title: "Backups and moving computers",
    blurb: "Keep a spare copy and take your Library with you.",
    tag: "Library",
    sections: [
      {
        id: "where",
        h: "Where your Library lives",
        body: [
          "Your Library is stored only on your computer, encrypted. There is no account and no cloud copy, which also means a spare copy is up to you.",
        ],
      },
      {
        id: "spare",
        h: "Keep a spare copy",
        body: [
          "Use the <a href=\"#/tour/press\">Press</a> to export the characters, lorebooks, and presets you care about. Save the files somewhere safe, like a USB drive or another folder you back up.",
          "The Press tells you if a format cannot carry some detail, so you know exactly what your copy includes.",
        ],
      },
      {
        id: "move",
        h: "Moving to a new computer",
        body: [
          "Install Bunzai on the new computer, then import the files you exported. They come back into your Library as they were.",
          "You will need to add your AI key again on the new computer.",
        ],
      },
    ],
  },
  {
    slug: "something-wrong",
    title: "Something went wrong",
    blurb: "Common hiccups and how to get past them.",
    tag: "Help",
    sections: [
      {
        id: "windows-warning",
        h: "Windows says it does not recognize the app",
        body: [
          "New apps that are not yet signed show a blue box that says Windows protected your PC. Bunzai is free and open source, and you can read every line of it on GitHub.",
          "To open it anyway, choose <b>More info</b>, then <b>Run anyway</b>. You only need to do this once.",
        ],
      },
      {
        id: "no-reply",
        h: "The character is not replying",
        body: [
          "Check that your AI key is added and still active with your AI service. Most of the time, a missing or expired key is the reason.",
          "If a reply stopped halfway, press Retry. If Bunzai closed while writing, the reply comes back when you reopen the scene.",
        ],
      },
      {
        id: "deleted",
        h: "I deleted something by mistake",
        body: [
          "Look in the Trash. Deleted things stay there for three days. Cut messages in a scene can be restored for three days too.",
        ],
      },
      {
        id: "report",
        h: "Tell us about it",
        body: [
          "If something still is not working, open an issue on <a href=\"https://github.com/Coneja-Chibi/Bunzai/issues\" rel=\"noopener\">GitHub</a>. Say what you were doing, what you expected, and what happened instead. A screenshot helps a lot.",
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Sample releases (used when GitHub cannot be reached)               */
/* ------------------------------------------------------------------ */
BUNZAI.sampleReleases = function () {
  const day = 86400000;
  const now = Date.now();
  const page = "https://github.com/Coneja-Chibi/Bunzai/releases";
  const assets = (v) => [
    { name: "Bunzai-" + v + "-windows-x64.exe", size: 81788928, url: page },
    { name: "Bunzai-" + v + "-mac-arm64.dmg", size: 86507520, url: page },
    { name: "Bunzai-" + v + "-mac-x64.dmg", size: 88080384, url: page },
    { name: "Bunzai-" + v + "-linux-x86_64.AppImage", size: 84934656, url: page },
    { name: "Bunzai-" + v + "-linux-amd64.deb", size: 80740352, url: page },
  ];
  return [
    {
      tag_name: "v0.1.42",
      name: "0.1.42",
      published_at: new Date(now - 3 * day).toISOString(),
      html_url: page,
      prerelease: false,
      draft: false,
      body:
        "- Scenes can follow a chosen preset through the new **Prompting wing**.\n" +
        "- Switch single prompts and samplers on or off for each scene.\n" +
        "- Imported presets keep their example dialogue.",
      assets: assets("0.1.42"),
    },
    {
      tag_name: "v0.1.41",
      name: "0.1.41",
      published_at: new Date(now - 7 * day).toISOString(),
      html_url: page,
      prerelease: false,
      draft: false,
      body:
        "- Chat with any character in your Library.\n" +
        "- Swipes, retries, and a **Retry** button.\n" +
        "- Replies cut off by a crash come back when you reopen the scene.",
      assets: assets("0.1.41"),
    },
    {
      tag_name: "v0.1.40",
      name: "0.1.40",
      published_at: new Date(now - 14 * day).toISOString(),
      html_url: page,
      prerelease: false,
      draft: false,
      body:
        "- **Takes**: branch a story and hop between versions.\n" +
        "- Cut messages can be restored for 3 days.\n" +
        "- Portrait cards in the Library.",
      assets: assets("0.1.40"),
    },
  ];
};
