'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, Search, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { useTheme } from '@/contexts/theme-context';
import { exportTableData, type ExportColumn } from '@/lib/export-utils';

interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  exportable?: boolean;
  exportFormat?: (value: any) => string;
}

interface DataTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: DataTableColumn<T>[];
  itemsPerPage?: number;
  className?: string;
  enableSelection?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onSelectAll?: () => void; // Callback for selecting all items across all pages
  isAllSelected?: boolean; // Whether all items across all pages are selected
  bulkActions?: React.ReactNode;
  getRowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  // Server-side pagination props
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  // Server-side sorting props
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  // Server-side filtering props
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // Export props
  enableExport?: boolean;
  exportFilename?: string;
  // Loading state
  isLoading?: boolean;
  // Custom filters (rendered in the same row as search/export)
  customFilters?: React.ReactNode;
}

export function DataTable<T extends { id?: string }>({ 
  data, 
  columns, 
  itemsPerPage = 10, 
  className = '',
  enableSelection = false,
  selectedItems = [],
  onSelectionChange,
  onSelectAll,
  isAllSelected: isAllSelectedProp,
  bulkActions,
  getRowClassName,
  onRowClick,
  // Server-side pagination props
  currentPage: serverCurrentPage,
  totalPages: serverTotalPages,
  totalItems: serverTotalItems,
  onPageChange,
  // Server-side sorting props
  sortBy,
  sortOrder = 'desc',
  onSortChange,
  // Server-side filtering props
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  // Export props
  enableExport = false,
  exportFilename = 'export',
  // Loading state
  isLoading = false,
  // Custom filters
  customFilters,
}: DataTableProps<T>) {
  const { getThemeColor } = useTheme();
  const themeColor = getThemeColor() || '#dc2626'; // Fallback to red if not set
  
  // Use server-side pagination if provided, otherwise use client-side
  const isServerSidePagination = serverCurrentPage !== undefined && serverTotalPages !== undefined;
  
  const [clientCurrentPage, setClientCurrentPage] = useState(1);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  
  const currentPage = isServerSidePagination ? serverCurrentPage : clientCurrentPage;
  const totalPages = isServerSidePagination ? serverTotalPages : Math.ceil(data.length / itemsPerPage);
  const totalItems = isServerSidePagination ? (serverTotalItems || 0) : data.length;
  
  const paginatedData = useMemo(() => {
    if (isServerSidePagination) {
      // For server-side pagination, use data as-is (already paginated)
      return data;
    } else {
      // For client-side pagination, slice the data
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return data.slice(startIndex, endIndex);
    }
  }, [data, currentPage, itemsPerPage, isServerSidePagination]);

  const shouldIgnoreRowClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (!target) return false;
    // Ignore clicks on interactive elements
    const interactive = target.closest('button, a, input, select, textarea, [role="menu"], [role="menuitem"], [role="checkbox"], [data-stop-row-click]');
    return Boolean(interactive);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      if (isServerSidePagination && onPageChange) {
        onPageChange(page);
      } else {
        setClientCurrentPage(page);
      }
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      if (isServerSidePagination && onPageChange) {
        onPageChange(currentPage - 1);
      } else {
        setClientCurrentPage(currentPage - 1);
      }
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      if (isServerSidePagination && onPageChange) {
        onPageChange(currentPage + 1);
      } else {
        setClientCurrentPage(currentPage + 1);
      }
    }
  };

  // Selection handlers
  const handleSelectAll = (selectAllPages: boolean = false) => {
    if (!onSelectionChange) return;
    
    // If selectAllPages is true and onSelectAll is provided, select all across pages
    if (selectAllPages && onSelectAll) {
      onSelectAll();
      setShowSelectDropdown(false);
      return;
    }
    
    // Otherwise, select only current page
    const allIds = paginatedData.map(item => item.id).filter(Boolean) as string[];
    const isAllSelectedOnPage = allIds.length > 0 && allIds.every(id => selectedItems.includes(id));
    
    if (isAllSelectedOnPage) {
      // Deselect all items on current page
      onSelectionChange(selectedItems.filter(id => !allIds.includes(id)));
    } else {
      // Select all items on current page (merge with existing selections)
      const newSelections = [...new Set([...selectedItems, ...allIds])];
      onSelectionChange(newSelections);
    }
    setShowSelectDropdown(false);
  };

  // Handle select all on current page only
  const handleSelectAllOnPage = () => {
    handleSelectAll(false);
  };

  // Handle select all across all pages
  const handleSelectAllInTable = () => {
    handleSelectAll(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(event.target as Node)) {
        setShowSelectDropdown(false);
      }
    };

    if (showSelectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSelectDropdown]);

  const handleSelectItem = (itemId: string) => {
    if (!onSelectionChange) return;
    
    const isSelected = selectedItems.includes(itemId);
    if (isSelected) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  // Use prop if provided (for server-side), otherwise calculate from current page
  const isAllSelected = isAllSelectedProp !== undefined 
    ? isAllSelectedProp 
    : (paginatedData.length > 0 && paginatedData.every(item => item.id && selectedItems.includes(item.id)));
  
  // For server-side, indeterminate means some but not all are selected
  // For client-side, indeterminate means some items on current page are selected but not all
  const isIndeterminate = isServerSidePagination
    ? (selectedItems.length > 0 && !isAllSelected)
    : (selectedItems.length > 0 && !isAllSelected && paginatedData.some(item => item.id && selectedItems.includes(item.id)));

  // Handle column sorting
  const handleSort = (columnKey: string) => {
    if (!onSortChange) return;
    
    const column = columns.find(col => col.key === columnKey);
    if (!column || !column.sortable) return;

    const newSortOrder = 
      sortBy === columnKey && sortOrder === 'asc' 
        ? 'desc' 
        : 'asc';
    
    onSortChange(columnKey, newSortOrder);
  };

  // Handle export
  const handleExport = (format: 'csv' | 'excel' | 'pdf' = 'csv') => {
    const exportColumns: ExportColumn[] = columns
      .filter(col => col.exportable !== false)
      .map(col => ({
        key: col.key,
        label: col.label,
        format: col.exportFormat || col.exportFormat,
      }));

    exportTableData({
      filename: exportFilename,
      columns: exportColumns,
      data: data,
      format,
    });
  };

  // Reset to page 1 when data changes (only for client-side pagination)
  React.useEffect(() => {
    if (!isServerSidePagination) {
      setClientCurrentPage(1);
    }
  }, [data.length, isServerSidePagination]);

  return (
    <div className={className}>
      {/* Search, Filters, and Export Bar - Always show if enabled */}
      {(onSearchChange || enableExport || customFilters) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex-1 flex items-center gap-2 w-full sm:w-auto">
            {/* Custom filters on the left */}
            {customFilters && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {customFilters}
              </div>
            )}
            
            {/* Search bar in the middle (flex-1 to take remaining space) */}
            {onSearchChange && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
            )}
          </div>
          
          {/* Export button on the far right */}
          {enableExport && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2"
                disabled={data.length === 0}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && data.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No data available</p>
        </div>
      )}

      {/* Table Content - Only show if not loading and has data */}
      {!isLoading && data.length > 0 && (
        <>

      {/* Bulk Actions Bar */}
      {enableSelection && selectedItems.length > 0 && bulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              {bulkActions}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-6 sm:mx-0 px-6 sm:px-0">
        <table className="w-full min-w-[640px] sm:min-w-0">
          <thead className="border-b border-gray-200">
            <tr className="bg-gray-50">
              {enableSelection && (
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <div className="relative inline-block" ref={selectDropdownRef}>
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={isAllSelected || (paginatedData.length > 0 && paginatedData.every(item => item.id && selectedItems.includes(item.id)))}
                        ref={(input) => {
                          if (input) {
                            const allOnPageSelected = paginatedData.length > 0 && paginatedData.every(item => item.id && selectedItems.includes(item.id));
                            const someOnPageSelected = paginatedData.some(item => item.id && selectedItems.includes(item.id));
                            input.indeterminate = !isAllSelected && !allOnPageSelected && someOnPageSelected;
                          }
                        }}
                        onChange={() => handleSelectAll(false)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {isServerSidePagination && onSelectAll && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSelectDropdown(!showSelectDropdown);
                          }}
                          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                          title="Select all options"
                        >
                          <ChevronDown className="h-3 w-3 text-gray-500" />
                        </button>
                      )}
                    </div>
                    {showSelectDropdown && isServerSidePagination && onSelectAll && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[180px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllOnPage();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-md"
                        >
                          Select all on this page ({paginatedData.length})
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllInTable();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 last:rounded-b-md border-t border-gray-200"
                        >
                          Select all in table ({totalItems})
                        </button>
                      </div>
                    )}
                  </div>
                </th>
              )}
              {columns.map((column) => {
                const isSortable = column.sortable !== false && onSortChange;
                const isCurrentSort = sortBy === column.key;
                const canSort = isSortable && column.sortable !== false;
                
                return (
                  <th 
                    key={column.key}
                    className={`px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      canSort ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                    }`}
                    onClick={canSort ? () => handleSort(column.key) : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {canSort && (
                        <span className="flex flex-col">
                          {isCurrentSort ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-blue-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-gray-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => {
              const rowClassName = getRowClassName ? getRowClassName(item) : "";
              const baseClassName = "hover:bg-gray-50";
              const finalClassName = rowClassName ? `${rowClassName} ${baseClassName}` : baseClassName;
              
              return (
                <tr 
                  key={item.id || index} 
                  className={`${finalClassName} ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={onRowClick ? (e) => { if (!shouldIgnoreRowClick(e)) { onRowClick(item); } } : undefined}
                >
                {enableSelection && (
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={item.id ? selectedItems.includes(item.id) : false}
                      onChange={() => item.id && handleSelectItem(item.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-t border-gray-200">
          <div className="flex items-center text-xs sm:text-sm text-gray-700">
            <span className="text-center sm:text-left">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="flex items-center"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current page
                const shouldShow = 
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1);
                
                if (!shouldShow) {
                  // Show ellipsis for gaps
                  if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2 text-gray-500">...</span>;
                  }
                  return null;
                }
                
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToPage(page)}
                    className={`w-8 h-8 p-0 ${currentPage === page ? 'text-white border-0 hover:opacity-90' : ''}`}
                    style={currentPage === page ? { backgroundColor: themeColor } : undefined}
                    onMouseEnter={currentPage === page ? undefined : (e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={currentPage === page ? undefined : (e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
