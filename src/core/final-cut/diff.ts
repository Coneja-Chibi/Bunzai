/**
 * A word diff of a pass's input and output, kept with the run so the badge can show what changed. RoleCall's (rc lib/post-gen-actions/diff.ts)
 * fills an (n+1) x (m+1) table whatever the size, so a 4,000-word reply allocates tens of millions of cells; this one cuts the common start and
 * end first and only runs the table when what is left fits CELL_BUDGET, else it answers the middle as one removal and one addition.
 */
export interface DiffSegment { type: "equal" | "added" | "removed"; text: string }

export const CELL_BUDGET = 4_000_000;
const tokenize = (text: string): string[] => text.match(/\s+|[^\s]+/g) ?? [];

function merge(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const s of segments) {
    if (s.text === "") continue;
    const last = out[out.length - 1];
    if (last?.type === s.type) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

export function buildWordDiff(original: string, revised: string, budget = CELL_BUDGET): DiffSegment[] {
  if (original === revised) return original ? [{ type: "equal", text: original }] : [];
  const a = tokenize(original);
  const b = tokenize(revised);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const out: DiffSegment[] = [{ type: "equal", text: a.slice(0, head).join("") }];
  if ((midA.length + 1) * (midB.length + 1) > budget) {
    out.push({ type: "removed", text: midA.join("") }, { type: "added", text: midB.join("") });
  } else {
    const cols = midB.length + 1;
    const table = new Uint32Array((midA.length + 1) * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        table[i * cols + j] = midA[i] === midB[j] ? table[(i + 1) * cols + j + 1]! + 1 : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) { out.push({ type: "equal", text: midA[i++]! }); j++; }
      else if (table[(i + 1) * cols + j]! >= table[i * cols + j + 1]!) out.push({ type: "removed", text: midA[i++]! });
      else out.push({ type: "added", text: midB[j++]! });
    }
    while (i < midA.length) out.push({ type: "removed", text: midA[i++]! });
    while (j < midB.length) out.push({ type: "added", text: midB[j++]! });
  }
  out.push({ type: "equal", text: a.slice(a.length - tail).join("") });
  return merge(out);
}
