/**
 * The keyring's refusals, each with a name the server and the stores recognize.
 * Their messages are fixed or written for the person, and never
 * carry a password or recovery words.
 */
/** The library is locked: nothing can be read or written until it is unlocked. */
export class LockedError extends Error {
  constructor(message = "the library is locked") {
    super(message);
    this.name = "LockedError";
  }
}

/** A change to a secret needs the password or recovery words again first. */
export class ProofRequiredError extends Error {
  constructor(message = "enter your password or recovery words to change this") {
    super(message);
    this.name = "ProofRequiredError";
  }
}

/** Another change landed first; nothing was written, and the person can simply try again. */
export class KeyChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyChangedError";
  }
}

/** A key change the rules refuse. Nothing was changed, and the message is written for the person. */
export class KeyringRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyringRuleError";
  }
}
