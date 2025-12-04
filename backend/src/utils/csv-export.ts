/**
 * CSV Export Utility
 * Converts data arrays to CSV format
 */

export class CsvExport {
  /**
   * Convert array of objects to CSV string
   */
  static toCSV(data: any[], headers?: string[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    // If headers not provided, use object keys from first item
    const csvHeaders = headers || Object.keys(data[0]);

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV rows
    const rows: string[] = [];

    // Header row
    rows.push(csvHeaders.map(escapeCSV).join(','));

    // Data rows
    data.forEach((item) => {
      const row = csvHeaders.map((header) => {
        // Handle nested properties (e.g., "parent.user.email")
        const value = header.split('.').reduce((obj, key) => obj?.[key], item);
        return escapeCSV(value);
      });
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Convert CSV string to downloadable format with BOM for Excel compatibility
   */
  static toCSVWithBOM(csvString: string): Buffer {
    const BOM = '\uFEFF';
    return Buffer.from(BOM + csvString, 'utf8');
  }

  /**
   * Format date for CSV
   */
  static formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Format datetime for CSV
   */
  static formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:mm:ss format
  }

  /**
   * Format currency for CSV
   */
  static formatCurrency(cents: number | null | undefined, currency: string = 'GHS'): string {
    if (cents === null || cents === undefined) return '';
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

