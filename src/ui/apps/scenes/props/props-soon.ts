/** RoleCall's three "Coming Soon" rows, inert (builtin-catalog.ts:21-23; tooltips StagecraftExtensions.tsx:151-175): its own roadmap, shown the same way. */
import type { SoonRow } from "./prop-row";

export const SOON_PROPS: readonly SoonRow[] = [
  { id: "immersive-weather", name: "Immersive Weather", icon: "lucide:cloud-sun", tone: "var(--stage-var)", tip: {
    description: "Planned ambience prop for weather, atmosphere, and environmental pressure.",
    bullets: ["Coming soon; this is not the Calendar storyboard.", "Will be opt-in so normal scenes do not gain extra moving parts."] } },
  { id: "vn-additionals", name: "VN Additionals", icon: "lucide:panels-top-left", tone: "var(--stage-warn)", tip: {
    description: "Planned add-on controls for Visual Novel extras that do not belong in the base VN mode toggle.",
    bullets: ["Coming soon; VN mode remains its own scene mode.", "This slot is for optional VN-adjacent props, not the core VN switch."] } },
  { id: "web-search", name: "Web Search", icon: "mdi:web", tone: "var(--stage-macro)", tip: {
    description: "Planned browser/research prop for scenes that should be able to fetch current outside information.",
    bullets: ["Coming soon; shown here so the future toggle has a predictable home.", "Will stay opt-in because it changes privacy, latency, and provider behavior."] } },
];
