/**
 * DPAPI keystore backend (Windows): encrypts at rest with the user's login secret via ProtectedData
 * (CurrentUser scope), so the vault is useless on any other machine or account and needs no
 * passphrase. The secret is piped through PowerShell over stdin as base64, never on the command
 * line, so it cannot leak to process listings. Base64 in and out with a pinned ASCII output
 * encoding avoids the binary-through-PowerShell corruption traps. Available on win32 only.
 */
import type { KeystoreBackend, Unlock } from "../types";
import { spawnCollect } from "./spawn-collect";

const PROTECT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
$in = [Console]::In.ReadToEnd()
$bytes = [Convert]::FromBase64String($in)
$out = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
[Console]::Out.Write([Convert]::ToBase64String($out))
`;

const UNPROTECT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
$in = [Console]::In.ReadToEnd()
$bytes = [Convert]::FromBase64String($in)
$out = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser')
[Console]::Out.Write([Convert]::ToBase64String($out))
`;

const encodeCommand = (script: string): string => Buffer.from(script, "utf16le").toString("base64");

/** Run a PowerShell DPAPI script, feeding base64 over stdin and reading base64 from stdout. */
function runPs(script: string, inputB64: string): Promise<string> {
  return spawnCollect(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodeCommand(script)],
    { stdin: inputB64, stdoutEncoding: "ascii" },
  ).then(({ code, stdout, stderr }) => {
    if (code === 0) return stdout.trim();
    throw new Error(`keystore: dpapi powershell exited ${code}: ${stderr.trim()}`);
  });
}

export const dpapiBackend: KeystoreBackend = {
  id: "dpapi",
  label: "Windows login (DPAPI)",
  available: async (): Promise<boolean> => process.platform === "win32",
  seal: async (plaintext: string, _unlock: Unlock): Promise<string> => {
    const inputB64 = Buffer.from(plaintext, "utf8").toString("base64");
    return runPs(PROTECT, inputB64);
  },
  open: async (payload: string, _unlock: Unlock): Promise<string> => {
    const outB64 = await runPs(UNPROTECT, payload);
    return Buffer.from(outB64, "base64").toString("utf8");
  },
};
