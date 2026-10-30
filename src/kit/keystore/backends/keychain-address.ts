/** The canonical OS-keychain service/account names, with a bounded token safe for security's stdin command language. */
export function keychainAddress(service = "bunzai-kit") {
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(service)) throw new Error("keystore: invalid keychain service name");
  return { service, accounts: { key: "vault-key", marker: "vault-key-made" } } as const;
}
