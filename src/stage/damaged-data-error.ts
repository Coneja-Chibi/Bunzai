/** Name the encrypted or persisted value that failed integrity decoding. */
export class DamagedDataError extends Error {
  readonly where: string;
  constructor(where: string, reason: string) {
    super(`damaged data in ${where}: ${reason}`);
    this.name = "DamagedDataError";
    this.where = where;
  }
}
