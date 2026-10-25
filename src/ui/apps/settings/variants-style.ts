/** Every settings.shape variant's stylesheet (variants/settings.shape/<variant>.ts), mounted once by the Settings room. */
import bigToggles from "./variants/settings.shape/big-toggles";
import contentsPage from "./variants/settings.shape/contents-page";
import optionsMenu from "./variants/settings.shape/options-menu";
import programSections from "./variants/settings.shape/program-sections";

export const SETTINGS_VARIANTS_STYLE = [programSections, optionsMenu, bigToggles, contentsPage].join("\n");
