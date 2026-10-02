import type { ReactNode } from "react";

export function DefinitionList({
  rows,
}: {
  rows: { label: ReactNode; value: ReactNode; title?: string }[];
}) {
  return (
    <dl className="definition-list">
      {rows.map((row, index) => (
        <div key={String(index)}>
          <dt>{row.label}</dt>
          <dd title={row.title}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
