export function createSortValues(
  fields: readonly string[],
): ReadonlySet<string> {
  return new Set(fields.flatMap((field) => [field, `-${field}`]));
}
