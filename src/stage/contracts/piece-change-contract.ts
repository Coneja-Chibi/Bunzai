/** Backend wire shapes for row identities and ordered committed piece-change receipts. */
/** One live row identity captured with its summary listing. */
export interface DocumentVersionRow {
  kind: string;
  id: string;
  version: number;
  writeId: number;
}

export interface PieceChangeReceipt {
  kind: string;
  id: string;
  version?: number;
  writeId?: number;
  revision?: string;
  action?: "upsert" | "delete";
}

export interface PieceChangeEvent extends PieceChangeReceipt {
  version: number;
  writeId: number;
  revision: string;
  sequence: number;
  action: "upsert" | "delete";
}

export interface PieceChangeBatch {
  events: PieceChangeEvent[];
  latest: number;
  gap: boolean;
}
