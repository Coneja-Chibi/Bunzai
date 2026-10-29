/**
 * The Library tour - the second drop-in, proving the framework generalizes: another folder, another
 * Tour, discovered and mounted by the same engine with zero new wiring. Points at the library's own
 * data-tour anchors (the rail of decks, the Carousel/Grid switch, each section's view switch, the art dial). Anchors live in the populated browse
 * view; on a brand-new empty studio the intro/import steps still read (the highlights just skip).
 */
import type { Tour } from "../tour-contract";

const libraryTour: Tour = {
  manifest: { appId: "library", title: "The Library" },
  steps: [
    {
      id: "welcome",
      title: "This is the Library",
      body: "Every character, lorebook, persona, and preset you make or import lives here. Send one to the Workbench to edit it.",
    },
    {
      id: "decks",
      anchor: "decks",
      title: "Your decks",
      body: "Every kind of piece is listed here, characters, lorebooks, personas, presets, with how many you have. Click one to show it alone; click it again to see every deck.",
    },
    {
      id: "layout",
      anchor: "layout",
      title: "Rows or a wall",
      body: "Carousel runs each deck in one row that scrolls sideways. Grid lets the cards wrap onto as many rows as they need. Your pick sticks.",
    },
    {
      id: "views",
      anchor: "views",
      title: "Ways to browse a deck",
      body: "Every deck's section has its own switch: Cards for the full cards, Tiles to see them all at a glance, Show to feature one at a time, List to scan quickly. Your pick sticks.",
    },
    {
      id: "size",
      anchor: "size",
      title: "Big art or small",
      body: "Slide this to make every card larger or smaller. Handy when a deck gets crowded.",
    },
    {
      id: "import",
      title: "Bring cards in",
      body: "Drop a card file anywhere on this page to import it, from SillyTavern, RoleCall, and the rest. Bunzai reads it and keeps the original whole.",
    },
    {
      id: "done",
      title: "That is the Library",
      body: "Nothing here can break. Need this again? The ? in the corner replays it any time.",
    },
  ],
};

export default libraryTour;
