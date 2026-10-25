/** Browser entry for the harness: the real apply pipeline, reachable as window.Mod. */
import * as Mod from "../../src/ui/shell/theme-mod";
(window as unknown as { Mod: typeof Mod }).Mod = Mod;
