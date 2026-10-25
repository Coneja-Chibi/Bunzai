/**
 * Vendor bundle manifest: which stub module ships which externally-shared library, and the externals
 * each one must NOT also bundle (the page's import map supplies those at runtime - two copies of
 * React crash hooks with a null dispatcher). One copy (fold B29): this used to be defined separately
 * in scripts/ui-bundle.ts and src/ui/server-static.ts, and had already drifted (one copy's entry
 * paths carried a leading "./", the other did not - harmless for both of today's resolvers, but
 * nothing stopped a real divergence the next time an entry changed). `entryUrl` is resolved HERE,
 * against this file's own location, so neither consumer needs to know the vendor folder's path.
 */

/** The react family stays OUT of every app/boot bundle; the page's import map resolves these to the
 *  single /vendor copies (one React per page - two copies crash hooks with a null dispatcher). */
export const REACT_EXTERNALS = ["react", "react/jsx-runtime", "react-dom/client", "react-dom"];

export interface VendorSpec {
  entryUrl: URL;
  external: string[];
}

const entry = (file: string): URL => new URL(file, import.meta.url);

export const VENDOR_SPECS: Record<string, VendorSpec> = {
  "react-family": { entryUrl: entry("react-family.ts"), external: [] },
  "react-dom-client": { entryUrl: entry("react-dom-client.ts"), external: ["react"] },
  // the password strength meter: large dictionaries, fetched only when a password is chosen
  strength: { entryUrl: entry("strength.ts"), external: [] },
};
