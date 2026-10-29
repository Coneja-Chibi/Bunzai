/*
 * The site's content. Releases here are only the fallback: app.js asks GitHub first
 * (api.github.com/repos/Coneja-Chibi/Bunzai/releases) and uses these when it cannot answer.
 */
window.SITE = {
  repo: "Coneja-Chibi/Bunzai",
  fallbackReleases: [
    { tag: "v0.1.42", date: "2026-09-25", title: "The Prompting wing", notes: ["Pick a preset for any scene from the new Prompting wing.", "Switch prompts and samplers for one scene without touching the preset.", "Imported presets keep your character's example dialogue."] },
    { tag: "v0.1.41", date: "2026-09-18", title: "Scenes can talk", notes: ["Chat with any character in the Scenes app.", "Swipe for another reply, and flip back to any version.", "A Retry button when a reply fails, and replies cut off by a crash come back."] },
    { tag: "v0.1.40", date: "2026-09-11", title: "Takes and cuts", notes: ["Branch a scene into takes and switch between them.", "Cut messages and bring them back for 3 days.", "Portrait cards in the Library."] },
  ],
  features: [
    { id: "scenes", rn: "I", name: "Scenes", genre: "Play", c1: "var(--brand)", c2: "var(--brand-deep)", cs: "var(--brand-soft)", tag: "Where your characters come alive.",
      lede: "Pick a character, pick any AI model you like, and start talking. Every reply can be swapped, retried, or branched, and nothing you write is ever thrown away.",
      proves: ["Swipe for another reply and flip back to any version.", "Branch a story into takes and switch between them.", "Stop a reply mid-sentence and keep what was written.", "Choose a preset per scene and switch its prompts on and off.", "A reply cut off by a crash comes back when you reopen."] },
    { id: "workbench", rn: "II", name: "Workbench", genre: "Make", c1: "var(--accent)", c2: "var(--accent-deep)", cs: "var(--accent-soft)", tag: "Your writing desk, backstage.",
      lede: "A proper editor for everything you make: characters, lorebooks, personas, presets. Open two side by side and see exactly what the AI will read.",
      proves: ["An editor for every kind of piece.", "See a preset's prompt the way it will be sent.", "Macros with a live preview.", "Two pieces side by side."] },
    { id: "library", rn: "III", name: "Library", genre: "Keep", c1: "var(--cat-pink)", c2: "var(--cat-fuchsia)", cs: "var(--cat-pink-soft)", tag: "Your whole cast, in one place.",
      lede: "Bring characters in from SillyTavern, RoleCall, Chub, and more. They live together on your computer, encrypted, sorted, and easy to find.",
      proves: ["Imports cards from many apps.", "Portrait cards, shelves, and search.", "Encrypted on your own computer.", "A Trash that keeps things for 3 days."] },
    { id: "press", rn: "IV", name: "Press", genre: "Share", c1: "var(--gold)", c2: "var(--cat-amber)", cs: "var(--gold-soft)", tag: "Send your work out into the world.",
      lede: "When you want to share or move something, the Press prints it in the format you need, and tells you plainly about anything that format cannot carry.",
      proves: ["Exports to 11 formats.", "A report of anything a format cannot hold.", "Bundles keep linked pieces together."] },
    { id: "agent", rn: "V", name: "Agent", genre: "Help", c1: "var(--cat-cyan)", c2: "var(--cat-blue)", cs: "var(--cat-cyan-soft)", tag: "A stagehand who knows your library.",
      lede: "Ask it to find a character, tidy a lorebook, or draft a preset. It shows you what it wants to change, and asks before it touches anything.",
      proves: ["Finds, fixes, and drafts things in your library.", "Asks before changing anything.", "Uses your own AI connection."] },
  ],
  guideCats: [
    { name: "Getting started", c: "var(--brand)", guides: ["start", "import"] },
    { name: "In a scene", c: "var(--cat-pink)", guides: ["presets", "swipes"] },
    { name: "Making things", c: "var(--accent)", guides: ["lore"] },
    { name: "Your library", c: "var(--gold)", guides: ["backup", "trouble"] },
  ],
  guides: {
    start: { title: "Your first scene", about: "Install Bunzai, bring in a character, connect an AI, and say hello.",
      sections: [
        { h: "Install Bunzai", p: "Download the version for your computer and open it. The first time, it adds itself to your Start menu so you can find it again.", steps: ["Go to the Download page.", "Open the file you downloaded.", "If Windows warns you, choose More info, then Run anyway."] },
        { h: "Bring in a character", p: "Drag a character card onto the Library. PNG cards and JSON files both work.", tip: "No card yet? The Library can make a blank one for you to fill in." },
        { h: "Connect an AI", p: "Bunzai talks to the AI you choose, with your own key. Add one in Settings under Connections." },
        { h: "Say hello", p: "Open Scenes, pick your character, choose a greeting, and type your first line." } ] },
    import: { title: "Importing cards", about: "Bring characters in from SillyTavern, RoleCall, Chub, and more.",
      sections: [ { h: "Drag and drop", p: "Drop any card onto the Library. Bunzai works out where it came from." }, { h: "What comes along", p: "Lorebooks, greetings, and art that live inside the card come with it." }, { h: "If something did not import", p: "Bunzai tells you exactly what it could not read, and keeps the rest." } ] },
    presets: { title: "Presets and the Prompting wing", about: "Choose a preset for a scene and switch its prompts on and off.",
      sections: [ { h: "Pick a preset", p: "Open the Prompting wing in any scene and choose a preset from your library.", tip: "No preset? The scene still works, using a simple, sensible order." }, { h: "Switch prompts for one scene", p: "Every prompt has its own switch. Flipping one only changes this scene." }, { h: "Change samplers", p: "Temperature, response length, and the rest live in the sampler bar. A dot marks anything this scene changed." }, { h: "Edit the preset itself", p: "Text you type in a prompt saves to the preset, so every scene that uses it gets the change." } ] },
    swipes: { title: "Swipes, retries, and takes", about: "Get another reply, go back to an old one, and branch your story.",
      sections: [ { h: "Swipe for another reply", p: "Use the arrows under the last reply, or your arrow keys, to ask for another version." }, { h: "Retry after a failure", p: "If a reply fails, the card shows what happened and a Retry button." }, { h: "Takes", p: "Branch from any message to start a new take, and switch between takes any time." } ] },
    lore: { title: "Lorebooks", about: "Give your world facts that show up exactly when they matter.",
      sections: [ { h: "Entries and keywords", p: "Each entry is a fact with words that wake it up. When those words come up, the fact joins the scene." }, { h: "Where entries go", p: "Put an entry before the story, deep in it, or right at the end." }, { h: "Testing your lore", p: "The Workbench shows which entries would fire for any message you try." } ] },
    backup: { title: "Backups and moving computers", about: "Keep your library safe, and take it with you.",
      sections: [ { h: "Where your library lives", p: "Your library is one encrypted file in Documents, in the Bunzai Studio folder." }, { h: "Making a backup", p: "Copy that folder somewhere safe. That is the whole backup." }, { h: "Moving to a new computer", p: "Copy the folder over, install Bunzai, and open it with your password." } ] },
    trouble: { title: "Something went wrong", about: "Replies that fail, windows that do not open, and what to do.",
      sections: [ { h: "A reply failed", p: "The failure card says what the AI answered. Check your key and model in Connections, then press Retry." }, { h: "The window does not open", p: "On Windows, install Microsoft WebView2, then open Bunzai again." }, { h: "Asking for help", p: "Open an issue on GitHub with what you tried. Screenshots help a lot." } ] },
  },
  formats: [["SillyTavern", "var(--brand)", "var(--brand-soft)"], ["RoleCall", "var(--cat-pink)", "var(--cat-pink-soft)"], ["Chub", "var(--accent)", "var(--accent-soft)"], ["RisuAI", "var(--cat-cyan)", "var(--cat-cyan-soft)"], ["Agnai", "var(--cat-emerald)", "var(--cat-emerald-soft)"], ["Backyard", "var(--gold)", "var(--gold-soft)"], ["NovelAI", "var(--cat-blue)", "var(--cat-blue-soft)"], ["Pygmalion", "var(--cat-fuchsia)", "var(--cat-fuchsia-soft)"], ["Lumiverse", "var(--cat-amber)", "var(--cat-amber-soft)"], ["Marinara", "var(--cat-rose)", "var(--cat-rose-soft)"], ["Plain JSON", "var(--line)", "var(--ink-soft)"]],
  faq: [
    ["Is it really free?", "Yes. Bunzai is free and open source, with no account and no subscription."],
    ["Do I need to be online?", "Only to talk to the AI you connect. Your library and all your editing stay on your computer."],
    ["Which AI can I use?", "Any service you have a key for, plus AI running on your own computer."],
    ["Can I bring my SillyTavern cards?", "Yes. Drop them in. Presets, lorebooks, and regex come too."],
    ["Where are my characters stored?", "In one encrypted file in your Documents folder. Nobody else can read it."],
    ["Can I move my stuff back out?", "Any time. The Press exports to 11 formats and tells you if anything will not fit."],
  ],
  demo: [
    { who: "Vera", c1: "var(--gold)", c2: "var(--cat-amber)", me: false, versions: ["*Vera looks up from the lamp.* You came up the stairs without a lantern. Brave, or foolish?", "*Vera does not turn around.* Close the door. The wind has opinions tonight.", "*She sets the lamp down.* A visitor. The storm brings me so few."] },
    { who: "You", c1: "var(--brand)", c2: "var(--brand-deep)", me: true, versions: ["A little of both. Will the storm hold?"] },
    { who: "Vera", c1: "var(--gold)", c2: "var(--cat-amber)", me: false, versions: ["*She taps the glass.* Until midnight. After that, you had better like my company."] },
  ],
};
