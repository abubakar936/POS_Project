import type { ReactNode } from 'react';

interface TableProps {
  headers: string[];
  children: ReactNode;
  caption?: string;
}

export function Table({ headers, children, caption }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-y border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 first:pl-5 last:pr-5">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
