import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    if (totalPages <= 5 || page <= 3) return index + 1;
    if (page >= totalPages - 2) return totalPages - 4 + index;
    return page - 2 + index;
  });

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 px-5 py-3">
      <p className="text-xs text-slate-500">
        Showing{' '}
        <span className="font-medium text-slate-700">
          {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, totalItems)}
        </span>{' '}
        of <span className="font-medium text-slate-700">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((number, index) => (
          <span key={number} className="flex items-center">
            {index === 4 && totalPages > 5 && page < totalPages - 2 && (
              <MoreHorizontal size={15} className="mx-1 text-slate-400" />
            )}
            <button
              type="button"
              aria-current={number === page ? 'page' : undefined}
              onClick={() => onPageChange(number)}
              className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium ${
                number === page
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {number}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
