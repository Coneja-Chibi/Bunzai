/** Fetch, JSON response, stream, and rejection helpers shared by provider tests. */
export type Sent = { url: string; init: RequestInit };

export function fakeFetch(reply: () => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return reply();
  };
  return { fetch, sent };
}

export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

export function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (value) => void (controller = value) });
  const encoder = new TextEncoder();
  return {
    response: new Response(stream, { status: 200 }),
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}
