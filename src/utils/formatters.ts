/**
 * Utility functions for Rupiah formatting, date formatting, and receipt utilities
 */

export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(amount);
}

export function formatDateIndo(dateString: string | Date): string {
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateShort(dateString: string | Date): string {
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatTimeOnly(dateString: string | Date): string {
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomStr = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${year}${month}${day}-${randomStr}`;
}

export function generateSKU(categoryName: string): string {
  const prefix = categoryName.substring(0, 3).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${random}`;
}
