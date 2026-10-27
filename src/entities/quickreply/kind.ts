/** The quick-reply kind: pages of prepared-message buttons. */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyQuickReplyBody, type QuickReplyBody } from "./schema";

export default defineKind<"quickreply", QuickReplyBody>({
  id: "quickreply", order: 70, singular: "Quick reply", plural: "Quick replies", short: "qr", receiptWord: "quick-reply set",
  blurb: "One-tap lines", icon: "lucide:zap", accent: "var(--deck-preset)", libraryDeck: true,
  blank: () => emptyQuickReplyBody("Untitled quick replies"), blankId: "quick-replies",
  editor: { id: "quickreply", label: "Quick reply editor", load: "light" },
  describe: (b) => {
    const labels = b.replies.map((r) => r.label || "(icon)").slice(0, 6).join(", ");
    return [
      `name     ${b.name || "(unnamed)"}`,
      `replies  ${b.replies.length}`,
      ...(labels ? [`buttons  ${labels}${b.replies.length > 6 ? ", ..." : ""}`] : []),
    ];
  },
});
