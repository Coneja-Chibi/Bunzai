/** My profile: the persona is a whole card editor, so it is one drill row to its Messenger program. */
import type { JSX } from "react";
import { bodyOf, str } from "../../../../../../core/guards";
import { DrillRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";

export function ProfileRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const name = str(bodyOf(a.scene.snapshot.persona)["name"]);
  return (
    <div data-part="scene.messenger.settings.rows">
      <DrillRow label="Persona" description="Name, description and art of who you play. Pick one per scene in the scene's own settings." value={name || "You"} onOpen={() => open("persona")} />
    </div>
  );
}
