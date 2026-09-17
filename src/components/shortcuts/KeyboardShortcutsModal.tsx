import React from 'react';
import { Keyboard, X, Search, UserCheck, CreditCard, Camera, FileText, RotateCcw } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      key: 'F2',
      label: 'Cari & Scan Produk',
      desc: 'Fokuskan kursor ke kolom pencarian produk atau barcode scanner.',
      icon: Search,
      badge: 'Fokus',
    },
    {
      key: 'F9',
      label: 'Pilih / Tambah Pelanggan',
      desc: 'Buka modal pemilihan pelanggan atau tambahkan data pelanggan baru.',
      icon: UserCheck,
      badge: 'Pelanggan',
    },
    {
      key: 'F10',
      altKey: 'Ctrl + Enter',
      label: 'Bayar / Checkout',
      desc: 'Buka dialog pembayaran langsung dari keranjang yang sedang aktif.',
      icon: CreditCard,
      badge: 'Pembayaran',
    },
    {
      key: 'F4',
      label: 'Buka Kamera Barcode',
      desc: 'Aktifkan kamera perangkat untuk scan barcode fisik produk.',
      icon: Camera,
      badge: 'Scanner',
    },
    {
      key: 'F7',
      label: 'Catatan / Hold Pesanan',
      desc: 'Tambahkan catatan khusus seperti nomor meja atau hold pesanan.',
      icon: FileText,
      badge: 'Catatan',
    },
    {
      key: 'ESC',
      label: 'Tutup / Batal',
      desc: 'Tutup jendela modal yang terbuka atau bersihkan teks kolom pencarian.',
      icon: RotateCcw,
      badge: 'Batal',
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div
        onClick={onClose}
        className="fixed inset-0"
      />

      <div className="relative z-10 bg-white border border-slate-200 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">
                Pintasan Keyboard (Hotkeys)
              </h3>
              <p className="text-[11px] text-slate-400">
                Panduan tombol cepat untuk transaksi kasir kilat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcut List */}
        <div className="p-4 overflow-y-auto space-y-2.5 bg-slate-50/50 flex-1">
          {shortcuts.map((sc, idx) => {
            const Icon = sc.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl p-3 flex items-start gap-3 shadow-2xs hover:border-emerald-300 transition-all"
              >
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h4 className="font-bold text-xs text-slate-900">{sc.label}</h4>
                    <div className="flex items-center gap-1">
                      <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-800 font-mono font-extrabold text-[11px] rounded-md shadow-2xs">
                        {sc.key}
                      </kbd>
                      {sc.altKey && (
                        <>
                          <span className="text-[10px] text-slate-400">/</span>
                          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-800 font-mono font-bold text-[10px] rounded-md shadow-2xs">
                            {sc.altKey}
                          </kbd>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{sc.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <p className="text-[11px] text-slate-500">
            Tekan <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] font-bold text-slate-700">ESC</kbd> untuk keluar
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
