/** AI connection: the vault's keys and the MCP connections live on their own protected deep pages (deep.tsx); this page is a status line, a real test request and drill rows. */
import { useState, type JSX } from "react";
import { listProviders, testProvider, testWords } from "../../../../settings/sections/models-api";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { ActionRow, DrillRow } from "../../frames/settings-rows";
import { useSettingsNav } from "../../frames/settings-window";
import type { OpenProgram } from "../scopes";
import { isList, useLoaded } from "./use-loaded";
import type { SafeProvider } from "../../../../settings/sections/models-core";

export function ConnectionRows({ open }: { open: OpenProgram }): JSX.Element {
  const nav = useSettingsNav();
  const providers = useLoaded(listProviders, isList<SafeProvider>).value;
  const active = providers?.find((p) => p.active);
  const [said, setSaid] = useState<string | undefined>(undefined);
  const test = (): void => {
    if (!active) return;
    setSaid("asking...");
    testProvider(active.id).then((r) => setSaid(testWords(r)), (e: unknown) => setSaid(toErrorMessage(e, "no answer")));
  };
  const summary = providers === null ? undefined : active ? `${active.name ?? active.kind}, ${active.model}` : providers.length ? "None chosen" : "None saved";
  return (
    <div data-part="scene.messenger.settings.rows">
      <DrillRow label="Providers and keys" description="Where requests are sent. A saved key is never shown again." {...(summary ? { value: summary } : {})} onOpen={() => nav.open("user.models")} />
      {active && <ActionRow label="Test connection" description="Sends one tiny request to the active provider." {...(said ? { value: said } : {})} action="Test" onAction={test} />}
      <DrillRow label="Connections" description="Tools this studio shares with other programs, and tools it reaches." onOpen={() => nav.open("user.connections")} />
      <DrillRow label="This scene's model" description="The per-scene pick is in the AI connection panel." onOpen={() => open("model")} />
    </div>
  );
}
