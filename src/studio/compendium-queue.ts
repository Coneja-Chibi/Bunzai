/**
 * One lane per scene for everything the Compendium does to books on a scene's behalf (04b D5): filing, Undo, "File again" and
 * Reconcile run one after another, so "undo the old version, then file the new one" is ordered by construction and no two passes
 * of one scene race each other. A task that throws reaches only its own caller; the lane carries on (F5: nothing here can wedge).
 * Model calls are I/O, so this stays on the main thread. Nothing holds an SSE stream: callers enqueue after `done` and return.
 */
const lanes = new Map<string, Promise<unknown>>();

export function enqueue<T>(chatId: string, task: () => Promise<T>): Promise<T> {
  const run = (lanes.get(chatId) ?? Promise.resolve()).catch(() => undefined).then(task);
  lanes.set(chatId, run);
  void run.then(() => undefined, () => undefined).then(() => lanes.get(chatId) === run && lanes.delete(chatId));
  return run;
}

/** Resolves when everything enqueued for the scene so far has finished; for tests and a graceful close. */
export const settled = (chatId: string): Promise<void> => (lanes.get(chatId) ?? Promise.resolve()).then(() => undefined, () => undefined);

/** Whether anything is queued or running for the scene in this process; a receipt still in flight with the lane idle is a crash's. */
export const busy = (chatId: string): boolean => lanes.has(chatId);
