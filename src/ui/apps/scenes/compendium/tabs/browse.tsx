/**
 * The Browse tab (RoleCall `BrowsePanel.tsx:46-141`): the Catalogue on the left (30%, 260 to 380px), the entry's page on the
 * right, and "Select an entry" until one is chosen. Below 600px the pane is one at a time, with "Back to list". The open entry,
 * the sub-tab and the search live in the wing, so the Dashboard can open an entry here and the choice survives a tab change.
 */
import type { JSX } from "react";
import { Ic } from "../../../../_shared/ic";
import type { BookModel } from "../compendium-core";
import { Catalogue, type SubTab, type TreeUi } from "../browse/catalogue";
import { EntryPage } from "../entry-page";

export interface BrowseState { sub: SubTab; query: string; entryId: string | null }

export function Browse({ model, bookName, state, onState, tree }: { model: BookModel; bookName: string; state: BrowseState; onState(next: Partial<BrowseState>): void; tree?: TreeUi }): JSX.Element {
  const open = state.entryId !== null && model.byId.has(state.entryId);
  return (
    <div className={`cp-browse${open ? " has" : ""}`} data-part="compendium.browse">
      <div className="side">
        <Catalogue model={model} sub={state.sub} onSub={(sub) => onState({ sub })} query={state.query} onQuery={(query) => onState({ query })} selectedId={state.entryId} onOpen={(entryId) => onState({ entryId })} {...(tree ? { tree } : {})} />
      </div>
      <div className="main">
        {open ? (
          <>
            <button type="button" className="back" onClick={() => onState({ entryId: null })}><Ic name="lucide:chevron-left" size={14} />Back to list</button>
            <EntryPage m={model} id={state.entryId!} bookName={bookName} onOpen={(entryId) => onState({ entryId })} />
          </>
        ) : (
          <div className="cp-sel"><Ic name="lucide:book-open" size={40} /><b>Select an entry</b><p>Choose any entry from the sidebar to read its compendium page.</p></div>
        )}
      </div>
    </div>
  );
}
