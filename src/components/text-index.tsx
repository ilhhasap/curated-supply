import type { ReactNode } from "react";
import type { TextRow } from "@/lib/held/types";

export function TextIndex({ rows, name }: { rows: TextRow[]; name: (row: TextRow) => ReactNode }) {
  if (!rows.length) return <p className="text-quiet">Nothing here yet.</p>;
  return (
    <ul data-annotate="text-index">
      {rows.map((row) => (
        <li key={row.slug} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          {name(row)}
          <span className="font-mono text-sm text-quiet tabular-nums">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}
