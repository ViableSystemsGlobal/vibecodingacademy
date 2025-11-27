/**
 * Export utilities for table data
 * Supports CSV, Excel, and PDF exports
 */

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename?: string;
  columns: ExportColumn[];
  data: any[];
  format: 'csv' | 'excel' | 'pdf';
}

/**
 * Export data to CSV
 */
export function exportToCSV(options: ExportOptions): void {
  const { filename = 'export', columns, data } = options;

  // Build CSV header
  const headers = columns.map(col => col.label).join(',');
  
  // Build CSV rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col.key];
      const formatted = col.format ? col.format(value) : String(value ?? '');
      // Escape commas and quotes in CSV
      if (formatted.includes(',') || formatted.includes('"') || formatted.includes('\n')) {
        return `"${formatted.replace(/"/g, '""')}"`;
      }
      return formatted;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export data to Excel (using CSV format with .xlsx extension)
 * For full Excel support, you'd need a library like xlsx
 */
export function exportToExcel(options: ExportOptions): void {
  // For now, use CSV format but with .xlsx extension
  // In production, you'd use a library like 'xlsx' for proper Excel formatting
  const { filename = 'export', columns, data } = options;
  
  // Build CSV content (Excel can open CSV files)
  const headers = columns.map(col => col.label).join('\t');
  
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col.key];
      const formatted = col.format ? col.format(value) : String(value ?? '');
      return formatted.replace(/\t/g, ' '); // Replace tabs to avoid breaking columns
    }).join('\t');
  });

  const content = [headers, ...rows].join('\n');
  
  // Create blob and download
  const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xlsx`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export data to PDF
 * For full PDF support, you'd need a library like jsPDF or pdfmake
 */
export function exportToPDF(options: ExportOptions): void {
  // This is a placeholder - for production, use jsPDF or pdfmake
  console.warn('PDF export requires a library like jsPDF. Falling back to CSV.');
  exportToCSV(options);
}

/**
 * Main export function
 */
export function exportTableData(options: ExportOptions): void {
  switch (options.format) {
    case 'csv':
      exportToCSV(options);
      break;
    case 'excel':
      exportToExcel(options);
      break;
    case 'pdf':
      exportToPDF(options);
      break;
    default:
      exportToCSV(options);
  }
}
