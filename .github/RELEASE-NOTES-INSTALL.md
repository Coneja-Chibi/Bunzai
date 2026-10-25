## Install

| You are on | Take this file | Then |
|---|---|---|
| **Windows** | `Bunraku.exe` | Double-click it. That is the whole install. |
| **Windows, terminal** | `bunraku-cli-windows-x64.exe` | Optional. Run it from a terminal with a command; it has no window. |
| **macOS** | `bunraku-cli-darwin-arm64` (Apple Silicon) or `bunraku-cli-darwin-x64` (Intel) | Terminal tool: `chmod +x` it, run `./bunraku-cli-darwin-arm64 ui`, open the printed address |
| **Linux** | `bunraku-cli-linux-x64` (Intel/AMD) or `bunraku-cli-linux-arm64` (ARM, Raspberry Pi) | Terminal tool: `chmod +x` it, run `./bunraku-cli-linux-x64 ui`, open the printed address |

- **Windows warns once**: SmartScreen shows "Windows protected your PC" because the exe is new and
  unsigned, not because anything is wrong. Click **More info**, then **Run anyway**. `SHA256SUMS`
  is right here if you want to verify the download first.
- **App starts but no window?** Install Microsoft's
  [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) and launch again
  (Windows 11 already has it).
- The `bunraku-cli-*` files are terminal tools with no window. Double-clicking one on Windows now
  prints the help and waits for Enter instead of flashing shut. The double-click app is `Bunraku.exe`.
- **Kit** (`bunraku-kit-*`) is the terminal companion: your whole studio as a conversation, in a
  terminal. Optional, and a separate download from the app. Windows x64, Linux x64, Linux arm64 and
  Apple Silicon.
- **Renamed this release**: the CLI downloads gained a `-cli` in their names
  (`bunraku-windows-x64.exe` is now `bunraku-cli-windows-x64.exe`, and the same for macOS and
  Linux). If you update the CLI from inside itself, grab this one manually once; the desktop app is
  unaffected.
- **You do not need to download the `sidecar-*` files yourself.** They are the optional remote-access
  helper for the private-mesh link. Open **Settings → Remote access** and press **Download the extra
  piece**; Bunraku picks the right one for your machine, checks it against a fingerprint built into the
  app, and throws away anything that does not match. They are listed here so the checksums are public.
  LAN mode is on the same page and needs no download at all.
- Launching `Bunraku.exe` while Bunraku is already running just opens another window onto the
  same studio. Your pieces live in `Documents/Bunraku Studio` as plain files.
