/** Exact retained temporary ciphertext, scratch, and artifact write protocols for the storage guard. */
import { stripComments } from "./lib";
import { callsNamed } from "./single-source-syntax";

/** Exact scratch/staging write callsites use newly-created private roots or publish a verified
 *  manual-update artifact. Their protocol is local to one callsite; a second writer invalidates the
 *  exception instead of exempting the rest of the file. */
export function reviewedTemporaryWriteProtocol(path: string, source: string): boolean {
  const clean = stripComments(source);
  const protocols: Readonly<Record<string, { root: RegExp; write: RegExp; calls: number; boundary: RegExp }>> = {
    "src/core/preset/render/scratch.ts": {
      root: /mkdtemp\s*\(\s*join\s*\(\s*tmpdir\s*\(\s*\)\s*,\s*["']bunzai-macro-lab-["']\s*\)\s*\)/,
      write: /await\s+writeFile\s*\(\s*preset\s*,\s*scratchWireFile\s*\(/,
      calls: 1,
      boundary: /const\s+preset\s*=\s*join\s*\(\s*dir\s*,\s*`scratch\.\$\{req\.engine\}\.json`\s*\)/,
    },
    "src/ui/server-staging.ts": {
      root: /mkdtemp\s*\(\s*join\s*\(\s*tmpdir\s*\(\s*\)\s*,\s*["']bunzai-import-staged-["']\s*\)\s*\)/,
      write: /await\s+writeFile\s*\(\s*path\s*,\s*sealed\s*,\s*\{\s*mode\s*:\s*0o600\s*\}\s*\)/,
      calls: 1,
      boundary: /const\s+sealed\s*=\s*JSON\.stringify\s*\(\s*aesSeal\s*\(\s*STAGING_KEY\s*,\s*text\s*,\s*`\$\{token\}:\$\{key\}`\s*\)\s*\)[\s\S]*?const\s+path\s*=\s*join\s*\(\s*dir\s*,\s*`\$\{key\}\.sealed`\s*\)/,
    },
    "src/kit/tools/preset-verify-export.ts": {
      root: /mkdtemp\s*\(\s*join\s*\(\s*tmpdir\s*\(\s*\)\s*,\s*["']hoplight-verify-["']\s*\)\s*\)/,
      write: /await\s+writeFile\s*\(\s*path\s*,\s*text\s*,\s*["']utf8["']\s*\)/,
      calls: 1,
      boundary: /const\s+path\s*=\s*join\s*\(\s*dir\s*,\s*["']preset\.json["']\s*\)/,
    },
    "src/formats/_fixtures/lumiverse-archive/materialize.ts": {
      root: /mkdtemp\s*\(\s*join\s*\(\s*tmpdir\s*\(\s*\)\s*,\s*["']bunzai-lvbak-["']\s*\)\s*\)/,
      write: /await\s+writeFile\s*\(\s*target\s*,\s*data\s*\)/,
      calls: 1,
      boundary: /if\s*\(\s*unsafeName\s*\(\s*name\s*\)\s*\)\s*throw[\s\S]*?const\s+target\s*=\s*join\s*\(\s*root\s*,\s*name\s*\)/,
    },
    "src/kit/providers/claude-cli.ts": {
      root: /mkdtemp\s*\(\s*join\s*\(\s*tmpdir\s*\(\s*\)\s*,\s*["']bunzai-mcp-["']\s*\)\s*\)/,
      write: /await\s+writeFile\s*\(\s*path\s*,\s*JSON\.stringify\s*\(\s*\{\s*mcpServers\s*:[\s\S]*?mode\s*:\s*0o600\s*,\s*flag\s*:\s*["']wx["']/,
      calls: 1,
      boundary: /const\s+path\s*=\s*join\s*\(\s*dir\s*,\s*["']config\.json["']\s*\)/,
    },
    "src/ui/switch/packaged-engine.ts": {
      root: /join\s*\(\s*exeDir\s*,\s*["']\.bunzai-update["']\s*\)/,
      write: /await\s+writeFile\s*\(\s*staged\s*,\s*bytes\s*\)/,
      calls: 1,
      boundary: /if\s*\(\s*!expected\s*\|\|\s*got\s*!==?\s*expected\s*\)[\s\S]*?const\s+staged\s*=\s*join\s*\(\s*stageDir\s*,\s*assetName\s*\)/,
    },
  };
  const protocol = protocols[path];
  if (!protocol) return false;
  const root = protocol.root.exec(clean);
  const boundary = protocol.boundary.exec(clean);
  const write = protocol.write.exec(clean);
  if (!root || !boundary || !write || root.index > boundary.index || boundary.index > write.index) return false;
  return callsNamed(path, source, "writeFile") === protocol.calls;
}

/**
 * src/ui/server-body.ts is the one file that opens upload sinks. Its callers own the private temp root
 * (fileSink: server-engine.ts bunzai-lvbak-upload-; sealedFileSink: server-asset-staging.ts
 * bunzai-asset-staged-; the syntax test pins both callers). Here the file itself is pinned: two
 * owner-only (0o600 default) "w" opens, five handle.write calls and nothing else that writes. Four of
 * them carry sealed bytes (iv, cipher.update, cipher.final, auth tag from an aes-256-gcm cipher built
 * before any of them); the fifth, in fileSink, is the uploaded archive itself, deliberately raw.
 */
export function reviewedHandleSinkProtocol(path: string, source: string): boolean {
  if (path !== "src/ui/server-body.ts") return false;
  const clean = stripComments(source);
  const count = (re: RegExp): number => [...clean.matchAll(re)].length;
  const once = (re: RegExp): boolean => count(re) === 1;
  if (!/^import \{ open, type FileHandle \} from "node:fs\/promises";$/m.test(clean)) return false;
  if (count(/\bfrom\s*["']node:fs/g) !== 1 || /\bimport\s*\(|\brequire\s*\(/.test(clean)) return false;
  if (callsNamed(path, source, "open") !== 2
    || count(/\bconst\s+handle(?:\s*:\s*FileHandle)?\s*=\s*await\s+open\s*\(\s*path\s*,\s*"w"\s*,\s*mode\s*\)/g) !== 2) return false;
  if (count(/\(\s*path:\s*string,\s*(?:key:\s*Buffer,\s*)?mode\s*=\s*0o600\s*\)/g) !== 2) return false;
  for (const name of ["writeFile", "writeFileSync", "appendFile", "createWriteStream", "openSync", "writeSync"]) {
    if (callsNamed(path, source, name) !== 0) return false;
  }
  // Five handle writes, plus hashSink teeing the same chunk into its inner sink.
  if (callsNamed(path, source, "write") !== 6 || count(/\bhandle\.write\s*\(/g) !== 5) return false;
  if (!once(/\bhandle\.write\(chunk\)/g) || !once(/\bhandle\.write\(iv\)/g) || !once(/\bhandle\.write\(cipher\.update\(chunk\)\)/g)
    || !once(/\bhandle\.write\(cipher\.final\(\)\)/g) || !once(/\bhandle\.write\(cipher\.getAuthTag\(\)\)/g)) return false;
  // The sealing boundary: a 12-byte random iv and the AES-256-GCM cipher precede every sealed write.
  const sealing = /const\s+iv\s*=\s*randomBytes\(12\);\s*const\s+cipher\s*=\s*createCipheriv\("aes-256-gcm",\s*key,\s*iv\);\s*await\s+handle\.write\(iv\);/.exec(clean);
  if (!sealing) return false;
  const afterSealing = clean.slice(sealing.index);
  return /handle\.write\(cipher\.update\(chunk\)\)/.test(afterSealing) && /handle\.write\(cipher\.final\(\)\)/.test(afterSealing)
    && /handle\.write\(cipher\.getAuthTag\(\)\)/.test(afterSealing);
}

/** Identity repair moves one damaged file aside; all key publication remains in the atomic owner. */
export function reviewedIdentityQuarantine(path: string, source: string): boolean {
  if (path !== "src/kit/keystore/backends/identity-file.ts") return false;
  const clean = stripComments(source);
  if (!/import\s*\{\s*readFile,\s*rename,\s*stat\s*\}\s*from\s*["']node:fs\/promises["']/.test(clean)) return false;
  if (!/import\s*\{\s*writeIdentityFile\s*\}\s*from\s*["']\.\/identity-write["']/.test(clean)) return false;
  if (/\b(?:rename\s+as|\*\s+as|await\s+import\s*\()/.test(clean)) return false;
  return callsNamed(path, source, "rename") === 1
    && /async function setAside\(path: string\): Promise<string>\s*\{\s*const stamp = new Date\(\)\.toISOString\(\)\.replace\(/.test(clean)
    && /const target = `\$\{path\}\.damaged-\$\{stamp\}-\$\{randomBytes\(3\)\.toString\(["']hex["']\)\}`;\s*await rename\(path, target\);\s*return target;/.test(clean)
    && /await writeIdentityFile\(path, encodeIdentity\(key\)\)/.test(clean);
}
