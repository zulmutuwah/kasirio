import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { PaymentMethod } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { soundbox } from '../../utils/soundbox';
import { QRCodeSVG } from 'qrcode.react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  QrCode,
  UserCheck,
  X,
  AlertTriangle,
  Copy,
  Check,
  Clock,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomerModal: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onOpenCustomerModal,
}) => {
  const {
    cart,
    selectedCustomer,
    cartOrderDiscount,
    settings,
    processCheckout,
    showToast,
  } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TUNAI');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [transactionNotes, setTransactionNotes] = useState<string>('');
  const [copiedBank, setCopiedBank] = useState<boolean>(false);
  const [qrisVerified, setQrisVerified] = useState<boolean>(false);

  // Dynamic QRIS states
  const [qrisOrder, setQrisOrder] = useState<{
    orderId: string;
    qrisString: string;
    expiresAt: number;
  } | null>(null);
  const [isCreatingQris, setIsCreatingQris] = useState(false);
  const [qrisTimeLeft, setQrisTimeLeft] = useState<number>(300);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  if (!isOpen) return null;

  // Calculate Total
  const subtotal = cart.reduce((acc, item) => {
    const originalPrice = item.product.sellPrice * item.quantity;
    let discVal = 0;
    if (item.discountType === 'PERCENT') {
      discVal = (originalPrice * item.discount) / 100;
    } else {
      discVal = item.discount;
    }
    return acc + Math.max(0, originalPrice - discVal);
  }, 0);

  const taxAmount = settings.enableTax ? (subtotal * settings.taxPercentage) / 100 : 0;
  const grandTotal = Math.max(0, subtotal + taxAmount - cartOrderDiscount);

  // Dynamic QRIS Creation & Auto-Detection Polling
  useEffect(() => {
    let countdownTimer: any;
    let pollTimer: any;

    if (isOpen && paymentMethod === 'QRIS' && grandTotal > 0) {
      let isMounted = true;
      setIsCreatingQris(true);
      setQrisVerified(false);

      const baseUrl = settings.apiBaseUrl || 'http://localhost:3001';
      fetch(`${baseUrl}/api/payment/qris/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: grandTotal,
          customerName: selectedCustomer?.name,
          merchantName: settings.qrisMerchantName || settings.storeName,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!isMounted) return;
          setIsCreatingQris(false);
          if (data.success) {
            setQrisOrder({
              orderId: data.orderId,
              qrisString: data.qrisString,
              expiresAt: data.expiresAt,
            });
            const initialSeconds = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
            setQrisTimeLeft(initialSeconds);

            countdownTimer = setInterval(() => {
              setQrisTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
            }, 1000);

            pollTimer = setInterval(async () => {
              try {
                const statusRes = await fetch(`${baseUrl}/api/payment/qris/status/${data.orderId}`);
                const statusData = await statusRes.json();
                if (statusData.status === 'PAID') {
                  clearInterval(pollTimer);
                  clearInterval(countdownTimer);
                  setQrisVerified(true);

                  if (settings.soundboxEnabled) {
                    soundbox.announcePayment(grandTotal, 'QRIS');
                  }

                  showToast(`Pembayaran QRIS ${formatRupiah(grandTotal)} Berhasil Diterima!`, 'success');

                  setTimeout(() => {
                    processCheckout('QRIS', grandTotal, transactionNotes);
                    onClose();
                  }, 1200);
                }
              } catch (e) {
                // Ignore network blips during polling
              }
            }, 1500);
          }
        })
        .catch((err) => {
          if (isMounted) setIsCreatingQris(false);
          console.warn('[QRIS Setup Error]', err);
        });

      return () => {
        isMounted = false;
        if (countdownTimer) clearInterval(countdownTimer);
        if (pollTimer) clearInterval(pollTimer);
      };
    }
  }, [isOpen, paymentMethod, grandTotal]);

  const handleSimulateWebhook = async () => {
    if (!qrisOrder) return;
    setIsSimulatingPayment(true);
    const baseUrl = settings.apiBaseUrl || 'http://localhost:3001';
    try {
      await fetch(`${baseUrl}/api/payment/simulate-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: qrisOrder.orderId }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const parsedAmountPaid = Number(amountPaidInput.replace(/\D/g, '')) || 0;
  const change = Math.max(0, parsedAmountPaid - grandTotal);
  const isInsufficientCash = paymentMethod === 'TUNAI' && parsedAmountPaid < grandTotal;

  // Quick cash preset amounts
  const quickCashPresets = [
    grandTotal, // Uang Pas
    Math.ceil(grandTotal / 10000) * 10000, // Round up 10k
    Math.ceil(grandTotal / 20000) * 20000, // Round up 20k
    Math.ceil(grandTotal / 50000) * 50000, // Round up 50k
    100000, // 100k
  ].filter((v, i, a) => v >= grandTotal && a.indexOf(v) === i);

  const handleQuickCash = (amount: number) => {
    setAmountPaidInput(amount.toString());
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setAmountPaidInput('');
    } else if (val === 'BACK') {
      setAmountPaidInput((prev) => prev.slice(0, -1));
    } else if (val === 'PAS') {
      setAmountPaidInput(grandTotal.toString());
    } else {
      setAmountPaidInput((prev) => {
        if (prev === '0') return val;
        return prev + val;
      });
    }
  };

  const handleCopyBank = () => {
    if (settings.bankAccountInfo) {
      navigator.clipboard.writeText(settings.bankAccountInfo);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'TUNAI' && parsedAmountPaid < grandTotal) {
      showToast('Jumlah pembayaran tunai kurang!', 'error');
      return;
    }

    if (paymentMethod === 'KASBON' && !selectedCustomer) {
      showToast('Harap pilih Pelanggan terlebih dahulu untuk metode Kasbon!', 'error');
      onOpenCustomerModal();
      return;
    }

    // Process checkout
    processCheckout(
      paymentMethod,
      paymentMethod === 'TUNAI' ? parsedAmountPaid : grandTotal,
      transactionNotes
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full text-slate-100 shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h3 className="font-bold text-lg text-slate-100">Pembayaran Kasir</h3>
            <p className="text-xs text-slate-400">Pilih metode dan selesaikan transaksi</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmitPayment} className="p-4 sm:p-6 space-y-5">
          
          {/* Total Amount Card */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Total Tagihan Nota</p>
              <p className="text-2xl font-extrabold text-teal-400 font-mono">
                {formatRupiah(grandTotal)}
              </p>
            </div>
            {selectedCustomer && (
              <div className="text-right bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <p className="text-[10px] text-slate-400">Pelanggan</p>
                <p className="text-xs font-semibold text-slate-200">{selectedCustomer.name}</p>
              </div>
            )}
          </div>

          {/* Payment Method Selector Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Metode Pembayaran
            </label>
            <div className="relative">
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const method = e.target.value as PaymentMethod;
                  setPaymentMethod(method);
                  if (method === 'TUNAI') {
                    setAmountPaidInput(grandTotal.toString());
                  }
                }}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-teal-300 focus:outline-none focus:border-teal-500 cursor-pointer appearance-none shadow-sm"
              >
                <option value="TUNAI">💵 Tunai / Cash</option>
                <option value="QRIS">📱 QRIS Instan</option>
                <option value="TRANSFER">🏦 Transfer Bank</option>
                <option value="KASBON">📝 Kasbon / Piutang</option>
              </select>
              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Payment Method Specific Input Sections */}

          {/* 1. TUNAI / CASH */}
          {paymentMethod === 'TUNAI' && (
            <div className="space-y-4 bg-slate-850 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1.5">
                  Nominal Diterima (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    value={
                      amountPaidInput
                        ? Number(amountPaidInput).toLocaleString('id-ID')
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setAmountPaidInput(raw);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xl font-black font-mono text-teal-300 focus:outline-none focus:border-teal-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Quick Cash Nominal Presets */}
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5 font-medium">
                  Pilihan Nominal Cepat:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickCashPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickCash(preset)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-teal-600/30 text-xs font-bold font-mono text-teal-300 border border-slate-700 transition-colors"
                    >
                      {preset === grandTotal ? 'Uang Pas' : formatRupiah(preset)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Numeric Keypad (Papan Angka Input) */}
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5 font-medium">
                  Papan Angka (Keypad Numpad Kasir):
                </p>
                <div className="grid grid-cols-4 gap-1.5 select-none">
                  {['7', '8', '9', 'C'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className={`py-2.5 rounded-xl text-sm font-extrabold font-mono transition-all active:scale-[0.96] ${
                        k === 'C'
                          ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                      }`}
                    >
                      {k}
                    </button>
                  ))}

                  {['4', '5', '6', '00'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-extrabold font-mono border border-slate-700 transition-all active:scale-[0.96]"
                    >
                      {k}
                    </button>
                  ))}

                  {['1', '2', '3', '000'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-extrabold font-mono border border-slate-700 transition-all active:scale-[0.96]"
                    >
                      {k}
                    </button>
                  ))}

                  {['0', 'PAS', 'BACK'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className={`py-2.5 rounded-xl text-sm font-extrabold font-mono transition-all active:scale-[0.96] ${
                        k === 'PAS'
                          ? 'col-span-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-black'
                          : k === 'BACK'
                          ? 'bg-slate-750 hover:bg-slate-700 text-amber-300 border border-slate-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                      }`}
                    >
                      {k === 'PAS' ? 'UANG PAS' : k === 'BACK' ? '⌫ Hapus' : k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Calculation */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Kembalian</span>
                <span
                  className={`text-xl font-mono font-extrabold ${
                    isInsufficientCash ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isInsufficientCash ? 'Uang Kurang' : formatRupiah(change)}
                </span>
              </div>
            </div>
          )}

          {/* 2. QRIS DINAMIS & WEBHOOK AUTO-DETECT */}
          {paymentMethod === 'QRIS' && (
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 text-center space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-slate-300 font-medium">
                  QRIS Dinamis Nasional (ASPI / BI)
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 ${
                  qrisTimeLeft <= 60 ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{formatTimer(qrisTimeLeft)}</span>
                </span>
              </div>

              {/* Dynamic QR Code Box */}
              <div className="bg-white p-4 rounded-2xl inline-block shadow-xl mx-auto border-2 border-emerald-500/30">
                {isCreatingQris ? (
                  <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-slate-600">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-[11px] font-semibold">Menyiapkan QRIS...</span>
                  </div>
                ) : qrisOrder?.qrisString ? (
                  <div className="relative p-1 bg-white rounded-xl">
                    <QRCodeSVG
                      value={qrisOrder.qrisString}
                      size={176}
                      level="M"
                      includeMargin={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white px-2 py-0.5 rounded text-[9px] font-black tracking-widest text-slate-900 border border-slate-300 shadow-md">
                        QRIS
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-44 h-44 bg-slate-950 p-2 rounded flex flex-col items-center justify-center relative">
                    <QrCode className="w-36 h-36 text-white" />
                  </div>
                )}
                
                <p className="text-[11px] font-extrabold text-slate-900 mt-2">
                  {settings.qrisMerchantName || settings.storeName || 'KASIRIO POS'}
                </p>
                <p className="text-xs font-black text-emerald-600 font-mono">
                  {formatRupiah(grandTotal)}
                </p>
              </div>

              {/* Auto-Detection Status Indicator */}
              <div className="space-y-2">
                <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  qrisVerified
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700 animate-pulse'
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                }`}>
                  {qrisVerified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Pembayaran Terverifikasi Webhook! Memproses nota...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span>Menunggu Notifikasi Pembayaran dari Bank / e-Wallet...</span>
                    </>
                  )}
                </div>

                {/* Sandbox / Testing Simulator Button */}
                {!qrisVerified && qrisOrder && (
                  <button
                    type="button"
                    onClick={handleSimulateWebhook}
                    disabled={isSimulatingPayment}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isSimulatingPayment ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Simulasikan Pembeli Scan & Bayar (Webhook Sandbox)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3. TRANSFER BANK */}
          {paymentMethod === 'TRANSFER' && (
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
              <p className="text-xs text-slate-300">
                Informasi Rekening Bank Toko untuk Pembayaran Transfer:
              </p>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {settings.bankAccountInfo || 'BCA 883012983 a/n Toko Sejahtera'}
                  </p>
                  <p className="text-[10px] text-slate-400">Nominal: {formatRupiah(grandTotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBank}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1"
                >
                  {copiedBank ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 4. KASBON / PIUTANG */}
          {paymentMethod === 'KASBON' && (
            <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-800/50 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Transaksi Kasbon / Hutang Pelanggan</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nilai nota sebesar <strong className="text-amber-400">{formatRupiah(grandTotal)}</strong> akan dicatat sebagai hutang pelanggan.
              </p>

              {selectedCustomer ? (
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">{selectedCustomer.name}</p>
                    <p className="text-[11px] text-slate-400">{selectedCustomer.phone}</p>
                    <p className="text-[11px] text-amber-400 mt-1">
                      Hutang Saat Ini: {formatRupiah(selectedCustomer.totalDebt)}
                    </p>
                  </div>
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenCustomerModal}
                  className="w-full py-2.5 px-3 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow"
                >
                  Pilih / Tambah Pelanggan Dulu
                </button>
              )}
            </div>
          )}

          {/* Notes field */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">
              Catatan Transaksi (Opsional)
            </label>
            <input
              type="text"
              value={transactionNotes}
              onChange={(e) => setTransactionNotes(e.target.value)}
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              placeholder="Contoh: Meja 4 / Bungkus terpisah / Catatan khusus"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={paymentMethod === 'TUNAI' && isInsufficientCash}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
                paymentMethod === 'TUNAI' && isInsufficientCash
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesaikan & Cetak Struk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
