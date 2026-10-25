/** Runs the StudioFs contract (fs-contract.ts) against the folder and memory backends: the folder import's reader and the tests' memory stand-in. */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryStudioFs, nodeStudioFs } from "./fs-backend";
import { studioFsContract } from "./fs-contract";
import { tempDirSync } from "./test-temp-dir";

studioFsContract("folder", async () => ({ fs: nodeStudioFs, root: tempDirSync("bunraku-fs-contract-") }));

studioFsContract("memory", async () => ({ fs: memoryStudioFs(), root: join(tmpdir(), "bunraku-memory-studio") }));
