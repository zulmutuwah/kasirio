import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Barcode, Search, X, CheckCircle2, Camera } from 'lucide-react';

export const BarcodeScannerModal: React.FC = () => {
  const { isScannerOpen, setIsScannerOpen, products, addToCart, showToast } = usePOS();
  const [skuInput, setSkuInput] = useState('');

  if (!isScannerOpen) return null;

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuInput.trim()) return;

    const matchedProduct = products.find(
      (p) =>
        p.sku.toLowerCase() === skuInput.trim().toLowerCase() ||
        p.name.toLowerCase().includes(skuInput.trim().toLowerCase())
    );

    if (matchedProduct) {
      addToCart(matchedProduct);
      setSkuInput('');
      showToast(`Scan Barcode: ${matchedProduct.name} ditambahkan!`);
    } else {
      showToast(`Produk dengan SKU / Barcode "${skuInput}" tidak ditemukan`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full text-slate-100 shadow-2xl p-6 relative">
        <button
          onClick={() => setIsScannerOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-teal-400 font-bold text-lg mb-2">
          <Barcode className="w-6 h-6" />
          <span>Scanner Barcode Kasir</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Arahkan kamera ke barcode produk atau masukkan nomor SKU / Kode Barcode secara manual.
        </p>

        {/* Camera simulation viewport */}
        <div className="relative w-full h-44 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center mb-4">
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)] animate-pulse" />
          <Camera className="w-10 h-10 text-slate-700 mb-2" />
          <p className="text-[11px] text-slate-500 font-mono">
            Kamera Aktif • Menunggu Barcode...
          </p>
        </div>

        {/* Manual SKU input form */}
        <form onSubmit={handleScanSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Atau Ketik Kode Barcode / SKU
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  autoFocus
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  placeholder="Contoh: MNM-1001"
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Cari & Tambah</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center pt-2">
            Tip: Coba ketik <code className="text-teal-400">MNM-1001</code> atau <code className="text-teal-400">MKN-2001</code>
          </p>
        </form>
      </div>
    </div>
  );
};
