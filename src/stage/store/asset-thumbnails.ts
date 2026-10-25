/** Bounded byte-only WebP thumbnail derivations over the shared sealed cache; codecs run in Bun's image lane. */
import { clearDerivedFamily, defineDerivePolicy, deriveAsync } from "../../core/derive/derive";
import { isSha256Hex } from "../../core/sha256";
import { ASSET_MAX_BYTES } from "../../core/media/limits";

export type ThumbnailSize = 96 | 256 | 512;
const FAMILY = "asset.thumb";
const MAX_PIXELS = 8 * 1024 * 1024;
const MAX_OUTPUT = 1024 * 1024;
const MAX_QUEUED = 64;
const policy = defineDerivePolicy<Uint8Array>(FAMILY, {
  version: "webp-1",
  persist: "always",
  maxBytes: Math.ceil(MAX_OUTPUT / 3) * 4,
  memoryBytes: (input, bytes) => input.length * 2 + bytes.byteLength,
  encode: (bytes) => Buffer.from(bytes).toString("base64"),
  decode: (text) => {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error("invalid thumbnail encoding");
    const bytes = new Uint8Array(Buffer.from(text, "base64"));
    if (bytes.byteLength < 12 || bytes.byteLength > MAX_OUTPUT || Buffer.from(bytes).toString("base64") !== text ||
      Buffer.from(bytes.subarray(0, 4)).toString("ascii") !== "RIFF" || Buffer.from(bytes.subarray(8, 12)).toString("ascii") !== "WEBP") throw new Error("invalid thumbnail encoding");
    return bytes;
  },
});

type Job = { generation: number; run(): Promise<Uint8Array>; resolve(bytes: Uint8Array): void; reject(error: unknown): void };

/** One per open server/library; queued jobs retain selectors only, never keys or image bytes. */
export function createAssetThumbnails(input: {
  ready(): boolean;
  load(sha: string, maxBytes: number): Promise<Uint8Array>;
}) {
  let generation = 0;
  let closed = false;
  let running = false;
  const queued: Job[] = [];
  const pending = new Map<string, Promise<Uint8Array>>();
  const check = (own: number): void => {
    if (closed || own !== generation || !input.ready()) throw new Error("thumbnail library is unavailable");
  };
  const drain = (): void => {
    if (running) return;
    const job = queued.shift();
    if (!job) return;
    running = true;
    void Promise.resolve().then(() => { check(job.generation); return job.run(); }).then(job.resolve, job.reject).finally(() => {
      running = false;
      drain();
    });
  };
  const lock = (): void => {
    generation++;
    clearDerivedFamily(`${FAMILY}@${policy.version}`);
    pending.clear();
    for (const job of queued.splice(0)) job.reject(new Error("thumbnail library is unavailable"));
  };
  return {
    read(sha: string, size: ThumbnailSize): Promise<Uint8Array> {
      const own = generation;
      try {
        check(own);
        if (!isSha256Hex(sha) || ![96, 256, 512].includes(size)) throw new Error("invalid thumbnail identity");
      } catch (error) { return Promise.reject(error); }
      const key = `${sha}:${size}`;
      const active = pending.get(key);
      if (active) return active;
      if (queued.length >= MAX_QUEUED) return Promise.reject(new Error("thumbnail queue is full"));
      const promise = new Promise<Uint8Array>((resolve, reject) => {
        queued.push({ generation: own, resolve, reject, run: async () => {
          const result = await deriveAsync(FAMILY, key, async () => {
            check(own);
            const bytes = await input.load(sha, ASSET_MAX_BYTES);
            check(own);
            if (bytes.byteLength === 0 || bytes.byteLength > ASSET_MAX_BYTES) throw new Error("thumbnail input is too large");
            const image = new Bun.Image(bytes, { maxPixels: MAX_PIXELS });
            const meta = await image.metadata();
            check(own);
            if (!["png", "jpeg", "webp"].includes(meta.format) ||
              !Number.isSafeInteger(meta.width) || !Number.isSafeInteger(meta.height) ||
              meta.width < 1 || meta.height < 1 || meta.width * meta.height > MAX_PIXELS) throw new Error("unsupported thumbnail image");
            const output = await image.resize(size, size, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).bytes();
            check(own);
            if (output.byteLength === 0 || output.byteLength > MAX_OUTPUT) throw new Error("thumbnail output is too large");
            return output;
          }, policy);
          check(own);
          return result;
        } });
        drain();
      });
      pending.set(key, promise);
      const release = (): void => { if (pending.get(key) === promise) pending.delete(key); };
      void promise.then(release, release);
      return promise;
    },
    lock,
    dispose(): void { closed = true; lock(); },
  };
}
