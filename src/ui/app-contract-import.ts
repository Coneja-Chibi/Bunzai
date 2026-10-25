/** Import completion notification shared by local import surfaces. */
export interface ImportCompletionApi {
  importCompleted(pieceCount: number): Promise<void>;
}
