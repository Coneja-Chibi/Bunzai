/** Boot the static, tab-scoped Bunraku Studio before mounting the ordinary React shell. */
import { installPocketRuntime } from "./runtime";

installPocketRuntime();
await import("../ui/boot");
