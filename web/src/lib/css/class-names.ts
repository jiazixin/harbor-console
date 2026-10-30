/** Resolves primitive and component classes through their CSS Module exports. */
export function createClassNames(mapping: Readonly<Record<string, string>>) {
  return (value: string | undefined): string =>
    (value ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => mapping[name] ?? name)
      .join(" ");
}
