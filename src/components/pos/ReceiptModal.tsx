import React from 'react';
import { usePOS } from '../../context/POSContext';
import { Transaction } from '../../types';
import { formatDateIndo, formatRupiah } from '../../utils/formatters';
import { Printer, Share2, X, CheckCircle2, Download } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  onClose,
}) => {
  const { settings } = usePOS();

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*NOTA PEMBAYARAN - ${settings.storeName}*\nNo: ${transaction.id}\nTanggal: ${formatDateIndo(transaction.date)}\n--------------------------------\n${transaction.items
      .map(
        (i) => `${i.productName} x${i.quantity} = ${formatRupiah(i.subtotal)}`
      )
      .join('\n')}\n--------------------------------\n*TOTAL: ${formatRupiah(
      transaction.total
    )}*\nBayar (${transaction.paymentMethod}): ${formatRupiah(
      transaction.amountPaid
    )}\nKembali: ${formatRupiah(transaction.change)}\n\nTerima kasih atas kunjungan Anda!`;

    const encodedText = encodeURIComponent(text);
    const phone = transaction.customer?.phone
      ? transaction.customer.phone.replace(/[^0-9]/g, '')
      : '';
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full text-slate-100 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Top Actions */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Transaksi Sukses</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Paper Receipt Container */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/50 flex flex-col items-center">
          
          {/* Thermal Paper Simulation Box (Class 'printable-receipt' for print CSS) */}
          <div
            id="printable-receipt"
            className={`bg-white text-slate-900 p-5 rounded-lg shadow-xl font-mono text-xs w-full max-w-[320px] select-text border border-slate-200 ${
              settings.paperSize === '80mm' ? 'max-w-[380px]' : 'max-w-[300px]'
            }`}
          >
            {/* Header Store Profile */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
              <h2 className="font-extrabold text-base tracking-tight text-slate-950 uppercase">
                {settings.storeName}
              </h2>
              <p className="text-[10px] text-slate-600 leading-tight">
                {settings.address}
              </p>
              <p className="text-[10px] text-slate-600">Telp: {settings.phone}</p>
            </div>

            {/* Invoice Metadata */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-0.5 text-[10px] text-slate-700">
              <div className="flex justify-between">
                <span>No. Nota:</span>
                <span className="font-bold">{transaction.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{formatDateIndo(transaction.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{transaction.cashierName}</span>
              </div>
              {transaction.customer && (
                <div className="flex justify-between font-bold text-slate-900 pt-0.5">
                  <span>Pelanggan:</span>
                  <span>{transaction.customer.name}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="font-bold text-slate-900 text-xs leading-tight">
                    {item.productName}
                  </p>
                  <div className="flex justify-between text-[11px] text-slate-700">
                    <span>
                      {item.quantity} x {formatRupiah(item.sellPrice)}
                      {item.discount > 0 && ` (-${formatRupiah(item.discount)})`}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Totals Breakdown */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span>{formatRupiah(transaction.subtotal)}</span>
              </div>

              {transaction.tax > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>PPN:</span>
                  <span>{formatRupiah(transaction.tax)}</span>
                </div>
              )}

              {transaction.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Diskon Nota:</span>
                  <span>-{formatRupiah(transaction.discount)}</span>
                </div>
              )}

              <div className="flex justify-between font-extrabold text-sm text-slate-950 pt-1 border-t border-slate-200">
                <span>TOTAL:</span>
                <span>{formatRupiah(transaction.total)}</span>
              </div>

              <div className="flex justify-between text-slate-700 pt-1">
                <span>Bayar ({transaction.paymentMethod}):</span>
                <span>{formatRupiah(transaction.amountPaid)}</span>
              </div>

              {transaction.paymentMethod === 'TUNAI' && (
                <div className="flex justify-between text-slate-700">
                  <span>Kembali:</span>
                  <span>{formatRupiah(transaction.change)}</span>
                </div>
              )}
            </div>

            {/* Footer Notes */}
            <div className="pt-3 text-center space-y-1 text-[10px] text-slate-600">
              <p className="font-medium">{settings.receiptHeaderNote}</p>
              <p>{settings.receiptFooterNote}</p>
              <div className="pt-2 font-mono text-[9px] tracking-widest text-slate-400">
                === Kasir Pintar POS ===
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
              title="Bagikan Nota via WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Struk</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors ml-auto"
          >
            Selesai / Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
};
