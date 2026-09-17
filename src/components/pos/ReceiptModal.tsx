import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Transaction } from '../../types';
import { formatDateIndo, formatRupiah } from '../../utils/formatters';
import { Printer, Share2, X, CheckCircle2, QrCode, FileText, Smartphone, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  onClose,
}) => {
  const { settings, showToast } = usePOS();
  const [activeMode, setActiveMode] = useState<'thermal' | 'qr'>('thermal');
  const [selectedPaperSize, setSelectedPaperSize] = useState<'58mm' | '80mm'>(
    (settings.paperSize as '58mm' | '80mm') || '58mm'
  );
  const [copiedPayload, setCopiedPayload] = useState(false);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  // Compact Offline Receipt Payload for QR Code (No Cloud Server required)
  const qrReceiptPayload = JSON.stringify({
    app: 'Kasirio',
    trx: transaction.id,
    toko: settings.storeName,
    tgl: transaction.date.slice(0, 10),
    items: transaction.items.map((i) => `${i.productName} (${i.quantity}x)`),
    tot: transaction.total,
    bayar: transaction.paymentMethod,
    status: 'LUNAS',
  });

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(qrReceiptPayload);
    setCopiedPayload(true);
    showToast('Data struk berhasil disalin!', 'success');
    setTimeout(() => setCopiedPayload(false), 2000);
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
    )}\nKembali: ${formatRupiah(transaction.change)}\n\nTerima kasih atas kunjungan Anda!\n_Kasirio POS - Kasir Pintar, UMKM Naik Kelas_`;

    const encodedText = encodeURIComponent(text);
    const phone = transaction.customer?.phone
      ? transaction.customer.phone.replace(/[^0-9]/g, '')
      : '';
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');
  };

  return (
    <>
      {/* Pure CSS Print Isolation for Thermal Printers (58mm/80mm, zero browser margins/headers) */}
      <style>{`
        @media print {
          @page {
            margin: 0 !important;
            size: ${selectedPaperSize === '80mm' ? '80mm auto' : '58mm auto'} !important;
          }
          body * {
            visibility: hidden !important;
          }
          #kasirio-thermal-receipt, #kasirio-thermal-receipt * {
            visibility: visible !important;
          }
          #kasirio-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${selectedPaperSize === '80mm' ? '76mm' : '54mm'} !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full text-slate-100 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
          
          {/* Modal Top Actions */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Transaksi Berhasil</span>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher: Cetak Thermal vs QR Digital */}
          <div className="px-4 pt-3 pb-2 bg-slate-950/60 flex items-center justify-between border-b border-slate-800 gap-2 shrink-0">
            <div className="flex items-center bg-slate-800 p-1 rounded-xl text-xs font-bold w-full max-w-[280px]">
              <button
                type="button"
                onClick={() => setActiveMode('thermal')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeMode === 'thermal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('qr')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeMode === 'qr'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Struk Mandiri</span>
              </button>
            </div>

            {activeMode === 'thermal' && (
              <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl text-[11px] font-bold text-slate-300">
                <button
                  type="button"
                  onClick={() => setSelectedPaperSize('58mm')}
                  className={`px-1.5 py-0.5 rounded ${
                    selectedPaperSize === '58mm' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400'
                  }`}
                >
                  58mm
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedPaperSize('80mm')}
                  className={`px-1.5 py-0.5 rounded ${
                    selectedPaperSize === '80mm' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400'
                  }`}
                >
                  80mm
                </button>
              </div>
            )}
          </div>

          {/* Modal Body Container */}
          <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/50 flex flex-col items-center">
            
            {activeMode === 'thermal' ? (
              /* Thermal Paper Simulation Box */
              <div
                id="kasirio-thermal-receipt"
                className={`bg-white text-slate-900 p-5 rounded-lg shadow-xl font-mono text-xs w-full select-text border border-slate-200 transition-all ${
                  selectedPaperSize === '80mm' ? 'max-w-[360px]' : 'max-w-[290px]'
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
                    === Kasirio POS ===
                  </div>
                </div>
              </div>
            ) : (
              /* QR Code Digital Receipt Screen */
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center space-y-4 max-w-sm w-full animate-in fade-in-50 zoom-in-95 duration-200">
                <div className="p-3 bg-white rounded-2xl shadow-lg border-2 border-emerald-400">
                  <QRCodeSVG
                    value={qrReceiptPayload}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm flex items-center justify-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Scan untuk Simpan Struk</span>
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Pembeli dapat memindai QR ini langsung dengan kamera HP. <strong>100% Offline</strong> tanpa nomor WhatsApp atau kuota internet.
                  </p>
                </div>

                <div className="bg-slate-950 rounded-xl p-2.5 w-full border border-slate-800 text-left text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ID Nota:</span>
                    <span className="font-bold text-white">{transaction.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Belanja:</span>
                    <span className="font-bold text-emerald-400">{formatRupiah(transaction.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pembayaran:</span>
                    <span>{transaction.paymentMethod}</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyPayload}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  {copiedPayload ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Payload Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Payload JSON Nota</span>
                    </>
                  )}
                </button>
              </div>
            )}

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
                className="px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Thermal</span>
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
    </>
  );
};
