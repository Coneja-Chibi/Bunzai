/** Data and backups: Back up now is the existing backup call; the copy list with Restore, and Security with the health check, are protected pages (deep.tsx). */
import { useState, type JSX } from "react";
import { agoLabel, backupsApi, type BackupsState } from "../../../../settings/sections/backups-core";
import { plural } from "../../../../../../core/text";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { ActionRow, DrillRow } from "../../frames/settings-rows";
import { useSettingsNav } from "../../frames/settings-window";
import { useLibraryExport } from "../../../../settings/sections/library-export";
import { useLoaded } from "./use-loaded";
import { isRecord } from "../../../../../../core/guards";

export function DataRows(): JSX.Element {
  const nav = useSettingsNav();
  const state = useLoaded(backupsApi.state, (v): v is BackupsState => isRecord(v) && Array.isArray(v["snapshots"]));
  const [note, setNote] = useState<string | undefined>(undefined);
  const s = state.value;
  const backUp = (): void => {
    setNote("copying...");
    backupsApi.take().then(() => { setNote(undefined); state.reload(); }, (e: unknown) => setNote(toErrorMessage(e, "the copy could not be made")));
  };
  const exp = useLibraryExport();
  const count = s ? s.snapshots.length : null;
  return (
    <div data-part="scene.messenger.settings.rows">
      <ActionRow label="Back up now" description="Writes a copy of every character, scene and setting." {...(note ? { value: note } : {})} action="Back up" variant="primary" onAction={backUp} />
      <ActionRow label="Export library" description="Writes everything to a plain folder beside your studio folder. The folder is not encrypted." {...(exp.note ? { value: exp.note } : {})} action="Export" onAction={exp.run} />
      <DrillRow label="Copies" description={s?.last ? `Last: ${agoLabel(s.last.takenAt)}.` : "Restore one, or remove one you no longer need."}
        {...(count !== null ? { value: count === 0 ? "None yet" : plural(count, "copy", "copies") } : {})} onOpen={() => nav.open("user.backups")} />
      <DrillRow label="Security and health" description="Password, recovery lines, other computers, lock, and the library check." onOpen={() => nav.open("user.security")} />
    </div>
  );
}
