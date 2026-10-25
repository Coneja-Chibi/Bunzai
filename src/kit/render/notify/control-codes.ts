/**
 * Raw terminal control bytes shared by the notify channels and the focus sentinel. Built via
 * fromCharCode to keep the raw control bytes out of source.
 */

export const ESC = String.fromCharCode(27);
export const BEL = String.fromCharCode(7);
