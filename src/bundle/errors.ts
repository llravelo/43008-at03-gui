/** A bundle file is missing, malformed or breaks the contract. `file` is relative to the bundle root. */
export class BundleError extends Error {
  constructor(
    message: string,
    readonly file: string,
  ) {
    super(`${file}: ${message}`);
    this.name = 'BundleError';
  }
}
