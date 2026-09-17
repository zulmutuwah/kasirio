import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import { X, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

interface StockAdjustmentModalProps {
  product: Product | null;
  initialQuantity?: number;
  initialType?: 'IN' | 'OUT' | 'SET';
  onClose: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  product,
  initialQuantity,
  initialType,
  onClose,
}) => {
  const { adjustStock } = usePOS();

  const [type, setType] = useState<'IN' | 'OUT' | 'SET'>(initialType || 'IN');
  const [quantityInput, setQuantityInput] = useState<number | ''>(
    initialQuantity !== undefined && initialQuantity > 0 ? initialQuantity : ''
  );
  const [reason, setReason] = useState(
    initialType === 'IN' || initialQuantity ? 'Kulakan Restock (Saran AI Kasirio)' : ''
  );

  if (!product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantityInput);
    if (isNaN(qty) || qty <= 0) return;

    let delta = 0;
    if (type === 'IN') {
      delta = qty;
    } else if (type === 'OUT') {
      delta = -qty;
    } else {
      // SET opname
      delta = qty - product.stock;
    }

    adjustStock(
      product.id,
      delta,
      reason || (type === 'IN' ? 'Barang Masuk / Restock' : type === 'OUT' ? 'Barang Rusak / Kadaluarsa' : 'Opname Stok Fisik')
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full text-slate-100 shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-bold text-lg text-slate-100 mb-1">
          Penyesuaian Stok Produk
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Produk: <strong className="text-teal-400">{product.name}</strong> (Stok Sekarang: {product.stock} {product.unit})
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Adjustment Type Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType('IN')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                type === 'IN'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-850 border-slate-800 text-slate-400'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>Stok Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => setType('OUT')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                type === 'OUT'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-850 border-slate-800 text-slate-400'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
              <span>Stok Keluar</span>
            </button>

            <button
              type="button"
              onClick={() => setType('SET')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                type === 'SET'
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                  : 'bg-slate-850 border-slate-800 text-slate-400'
              }`}
            >
              <RefreshCw className="w-4 h-4 text-teal-400" />
              <span>Stok Opname</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {type === 'SET' ? 'Set Total Stok Baru' : 'Jumlah Perubahan Stok'} ({product.unit})
            </label>
            <input
              type="number"
              required
              min="1"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value ? Number(e.target.value) : '')}
              placeholder="Contoh: 10"
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alasan / Catatan Penyesuaian
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Restock Supplier A / Kemasan Rusak"
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md"
            >
              Simpan Stok
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
