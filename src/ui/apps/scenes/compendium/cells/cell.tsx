/**
 * One Dashboard cell (RoleCall `BentoDashboard.tsx:172-200`): a raised card, 3px frame, offset shadow, a title row with a dot
 * (a type colour) or the star mark. Also the empty-line helper every cell uses.
 */
import type { JSX, ReactNode } from "react";
import { GLYPH } from "../compendium-core";

export function Cell({ title, dot, wide, children }: { title?: string; dot?: string; wide?: boolean; children: ReactNode }): JSX.Element {
  return (
    <div className={`cp-cell${wide ? " wide" : ""}`} data-part="compendium.cell">
      {title && <div className="ct">{dot ? <span className="dot" style={{ background: dot }} /> : <span className="st">{GLYPH.star}</span>}{title}</div>}
      {children}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }): JSX.Element => <div className="cp-empty">{children}</div>;
