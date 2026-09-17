import React, { useEffect, useState } from 'react';
import { usePOS } from '../context/POSContext';
import { formatDateIndo } from '../utils/formatters';
import {
  Menu,
  RotateCcw,
  Wallet,
  AlertCircle,
  X,
  Wifi,
  Sparkles,
  Barcode
} from 'lucide-react';

interface HeaderProps {
  onOpenShiftModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenShiftModal }) => {
  const {
    activeTab,
    activeShift,
    setIsScannerOpen,
    resetDemoData,
    toggleSidebar,
    toasts
  } = usePOS();

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTitle = () => {
    switch (activeTab) {
      case 'kasir':
        return 'Transaksi Kasir';
      case 'produk':
        return 'Produk & Inventori Stok';
      case 'pelanggan':
        return 'Pelanggan & Buku Kasbon';
      case 'laporan':
        return 'Laporan Penjualan & Keuangan';
      case 'pengaturan':
        return 'Pengaturan Toko & Struk';
      default:
        return 'Transaksi';
    }
  };

  return (
    <>
      {/* Toast Notifications container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-200 ${
              toast.type === 'error'
                ? 'bg-rose-900 border-rose-700 text-rose-100'
                : toast.type === 'info'
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-emerald-900 border-emerald-700 text-emerald-100'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${
              toast.type === 'error' ? 'bg-rose-400' : toast.type === 'info' ? 'bg-cyan-400' : 'bg-emerald-400'
            }`} />
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-30 shadow-xs select-none">
        <div className="w-full px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          
          {/* Left: Hamburger Menu & Title */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              title="Toggle Menu Sidebar"
            >
              <Menu className="w-5 h-5 text-emerald-600 font-bold" />
            </button>

            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                {getTitle()}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Fast POS
              </span>
            </div>
          </div>

          {/* Right Status Badges & Quick Tools */}
          <div className="flex items-center gap-2">
            
            {/* Online Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="w-3 h-3 text-emerald-600" />
              <span>Online</span>
            </div>

            {/* Barcode Scanner Tool */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
              title="Kamera Scanner Barcode"
            >
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Scan Barcode</span>
            </button>

            {/* Shift Kasir Status Pill */}
            <button
              onClick={onOpenShiftModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
              title="Shift Kasir"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{activeShift ? activeShift.cashierName.split(' ')[0] : 'Shift'}</span>
            </button>

            {/* Reset Demo Data */}
            <button
              onClick={() => setShowConfirmReset(true)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-slate-200 transition-colors"
              title="Reset Data Demo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
                <AlertCircle className="w-5 h-5" />
                <span>Reset Data Demo?</span>
              </div>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 my-4 leading-relaxed">
              Tindakan ini akan mengembalikan seluruh data produk, kategori, pelanggan, transaksi, dan pengaturan ke data contoh Kasir Pintar POS.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  resetDemoData();
                  setShowConfirmReset(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md transition-colors"
              >
                Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
