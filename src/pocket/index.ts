/** Boot the static, tab-scoped Bunzai Studio before mounting the ordinary React shell. */
import { installPocketRuntime } from "./runtime";

installPocketRuntime();
await import("../ui/boot");
