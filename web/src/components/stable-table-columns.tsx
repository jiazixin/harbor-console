type StableTableColumnsProps = { widths: readonly string[] };

export function StableTableColumns({ widths }: StableTableColumnsProps) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={`${width}-${String(index)}`} style={{ width }} />
      ))}
    </colgroup>
  );
}
