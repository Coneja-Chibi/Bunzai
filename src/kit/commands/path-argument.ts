/** Normalize a typed path argument, including the quotes a pasted shell path often carries. */
export const pathArgument = (arg: string): string => arg.trim().replace(/^['"]|['"]$/g, "");
