/**
 * Starting the MCP server: `bunzai mcp [studio-dir] [--read-only]`.
 *
 * Nothing here is a hardcoded tool list. The belt comes from discoverTools(), the same folders-as-schema
 * loader Kit's own loop uses, so a tool dropped into src/kit/tools appears to every connected client
 * with no edit here. The schemas come from the tools' own zod definitions. Adding a capability to Kit
 * adds it to every coding client that has this registered.
 *
 * Registered clients control tool approval through their own settings, including auto-approval.
 * This server does not supply an interactive confirmation gate. The default offers write tools;
 * use --read-only when the client should receive only read capabilities. Kit's subscription-provider
 * subprocess uses that read-only posture because Kit's in-process approval gate cannot authorize
 * writes in another process. Provider SDK permission settings are owned by claude-cli.ts.
 *
 * stdout carries protocol frames and nothing else. Diagnostics go to stderr, because one stray line
 * on stdout is a malformed frame and the client drops the session.
 */
import { createBridge } from "../kit/bridge";
import { discoverTools } from "../kit/tools/discover";
import { makeDispatch, toolSpecs } from "../kit/loop/dispatch";
import { readOnlyTools, serve } from "./server";
import { openLibrary } from "../ui/library-root";

export interface McpRunOptions {
  /** Absolute studio path; defaults to the usual location. */
  readonly studioDir?: string;
  /**
   * Offer only `effect: "read"` tools. Set when nothing else will ask before a write runs, which
   * today means the provider spawn.
   */
  readonly readOnly?: boolean;
}

/** Serve until stdin closes. */
export async function runMcpServer(options: McpRunOptions = {}): Promise<void> {
  const bridge = createBridge(options.studioDir);
  // The encrypted library opens first; while locked, every tool reports that and does nothing else.
  const library = await openLibrary(bridge.studioDir);
  const discovered = await discoverTools();
  const tools = options.readOnly ? readOnlyTools(discovered) : discovered;

  const log = (message: string): void => {
    process.stderr.write(`bunzai mcp: ${message}\n`);
  };
  log(
    options.readOnly
      ? `serving ${tools.length} read-only tools from ${bridge.studioDir}`
      : `serving ${tools.length} tools from ${bridge.studioDir};`
        + " tool approvals depend on your MCP client settings; use --read-only to disable writes",
  );
  if (library?.state === "locked") log("the library is locked: every tool will say so until it is unlocked in Bunzai");
  await serve({ tools: toolSpecs(tools), dispatch: makeDispatch(tools, { bridge }), log });
}
