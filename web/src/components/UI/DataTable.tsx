import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  totalRecords?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (searchQuery: string) => void;
  onRefresh?: () => void;
  searchPlaceholder?: string;
  extraHeaderActions?: React.ReactNode;
  getRowStyle?: (item: T) => React.CSSProperties | undefined;
  getRowClassName?: (item: T) => string | undefined;
}

export function DataTable<T extends { _id?: string; id?: string }>({
  columns,
  data,
  loading = false,
  totalRecords = 0,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onSearch,
  onRefresh,
  searchPlaceholder = 'Search records...',
  extraHeaderActions,
  getRowStyle,
  getRowClassName,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearch) onSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, onSearch]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {onSearch && (
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px' }}
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {extraHeaderActions}
          {onRefresh && (
            <button className="btn btn-secondary" onClick={onRefresh} title="Refresh Table">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ width: col.width, whiteSpace: 'nowrap' }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading data...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                  No records found.
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => {
                const rowStyle = getRowStyle ? getRowStyle(row) : undefined;
                const rowClassName = getRowClassName ? getRowClassName(row) : undefined;
                return (
                  <tr key={row._id || row.id || rowIdx} style={rowStyle} className={rowClassName}>
                    {columns.map((col, colIdx) => (
                      <td key={colIdx}>
                        {typeof col.accessor === 'function'
                          ? col.accessor(row)
                          : (col.accessor ? (row[col.accessor] as any) : null)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && onPageChange && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '4px 0' }}>
          <span style={{ fontSize: '13px', color: '#94A3B8' }}>
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalRecords} total records)
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '13px' }}
              disabled={currentPage <= 1 || loading}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '13px' }}
              disabled={currentPage >= totalPages || loading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
