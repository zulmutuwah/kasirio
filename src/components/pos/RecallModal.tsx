import React from 'react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { Clock, ShoppingBag, Trash2, ArrowUpRight, X, User, FileText, AlertCircle } from 'lucide-react';

interface RecallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecallModal: React.FC<RecallModalProps> = ({ isOpen, onClose }) => {
  const { suspendedCarts, recallCart, deleteSuspendedCart, cart } = usePOS();

  if (!isOpen) return null;

  const handleRecall = async (id: string) => {
    await recallCart(id);
    onClose();
  };

  const handleDelete = async (id: string, label: string) => {
    if (window.confirm(`Yakin ingin membatalkan dan menghapus pesanan tertahan "${label}"?`)) {
      await deleteSuspendedCart(id);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full text-slate-900 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <Clock className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                Pesanan Tertahan (Hold / Recall)
                <span className="text-xs bg-amber-200 text-amber-900 font-black px-2 py-0.5 rounded-full">
                  {suspendedCarts.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Panggil kembali antrean belanja yang sebelumnya ditunda
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if current active cart has items */}
        {cart.length > 0 && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Perhatian:</strong> Keranjang kasir saat ini memiliki {cart.length} item. Jika Anda memanggil pesanan di bawah, pesanan aktif saat ini akan <strong>otomatis ditahan</strong> agar tidak hilang.
            </span>
          </div>
        )}

        {/* Body List of Suspended Carts */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-100/50">
          {suspendedCarts.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-xs">
                <ShoppingBag className="w-8 h-8 opacity-40 text-slate-500" />
              </div>
              <p className="font-bold text-slate-700 text-sm">Tidak Ada Pesanan Tertahan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Gunakan tombol <strong>"Tahan"</strong> di keranjang belanja saat pembeli butuh waktu mengambil barang tambahan.
              </p>
            </div>
          ) : (
            suspendedCarts.map((item) => {
              const totalItems = item.items.reduce((sum, i) => sum + i.quantity, 0);
              const subtotal = item.items.reduce((sum, i) => {
                const orig = i.product.sellPrice * i.quantity;
                const disc = i.discountType === 'PERCENT' ? (orig * i.discount) / 100 : i.discount;
                return sum + Math.max(0, orig - disc);
              }, 0);
              const totalNominal = Math.max(0, subtotal - item.cartOrderDiscount);

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 shadow-xs transition-all flex flex-col gap-3"
                >
                  {/* Top: Label, Customer & Time */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        {item.label}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDateIndo(item.createdAt)}
                        </span>
                        {item.selectedCustomer && (
                          <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                            <User className="w-3 h-3" />
                            {item.selectedCustomer.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black font-mono text-slate-900 block">
                        {formatRupiah(totalNominal)}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {totalItems} item
                      </span>
                    </div>
                  </div>

                  {/* Middle: Items Preview */}
                  <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-700 space-y-1">
                    <div className="line-clamp-2 leading-relaxed">
                      {item.items.map((cartItem, idx) => (
                        <span key={idx} className="mr-2">
                          • {cartItem.product.name}{' '}
                          <strong className="text-slate-900">x{cartItem.quantity}</strong>
                          {idx < item.items.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-amber-800 flex items-center gap-1 pt-1 border-t border-slate-200/60 font-medium">
                        <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Catatan: {item.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleDelete(item.id, item.label)}
                      className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Batalkan & Hapus Pesanan Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>

                    <button
                      onClick={() => handleRecall(item.id)}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <span>Ambil ke Kasir</span>
                      <ArrowUpRight className="w-4 h-4 font-bold" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
