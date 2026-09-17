import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah } from '../../utils/formatters';
import {
  Minus,
  Plus,
  Trash2,
  UserPlus,
  ShoppingBag,
  UserCheck,
  ChevronRight,
  X,
  Tag,
  Info,
  FileText,
  CreditCard
} from 'lucide-react';

interface CartPanelProps {
  onOpenPaymentModal: () => void;
  onOpenCustomerModal: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  onOpenPaymentModal,
  onOpenCustomerModal,
}) => {
  const {
    cart,
    removeFromCart,
    updateCartQuantity,
    updateCartItemDiscount,
    clearCart,
    selectedCustomer,
    setSelectedCustomer,
    cartOrderDiscount,
    setCartOrderDiscount,
    settings,
    showToast,
  } = usePOS();

  const [editingItemDiscountId, setEditingItemDiscountId] = useState<string | null>(null);
  const [showOrderDiscountInput, setShowOrderDiscountInput] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Subtotal calculation
  const subtotal = cart.reduce((acc, item) => {
    const originalPrice = item.product.sellPrice * item.quantity;
    let discAmount = 0;
    if (item.discountType === 'PERCENT') {
      discAmount = (originalPrice * item.discount) / 100;
    } else {
      discAmount = item.discount;
    }
    return acc + Math.max(0, originalPrice - discAmount);
  }, 0);

  const taxAmount = settings.enableTax ? (subtotal * settings.taxPercentage) / 100 : 0;
  const totalAmount = Math.max(0, subtotal + taxAmount - cartOrderDiscount);
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Get initial letters for thumbnail badge
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Calculate estimated profit (Laba) from cart items
  const totalProfit = cart.reduce((acc, item) => {
    const profitMargin = (item.product.sellPrice - (item.product.buyPrice || 0));
    return acc + (profitMargin * item.quantity);
  }, 0) - cartOrderDiscount;

  return (
    <div className="bg-white border-l border-slate-200 flex flex-col h-full min-h-0 overflow-hidden select-none relative shadow-xs">
      
      {/* Header Cart */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <ShoppingBag className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              Daftar Pesanan
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {totalItemsCount} item
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">Transaksi Aktif Kasir</p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Cart Items List (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 space-y-2.5 bg-slate-50/50">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200 shadow-inner">
              <ShoppingBag className="w-10 h-10 opacity-40 text-slate-500" />
            </div>
            <p className="font-bold text-slate-700 text-sm max-w-xs leading-relaxed">
              Transaksi kosong, silahkan lakukan transaksi dengan menginputkan nama barang atau kode barang
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Klik produk di panel kiri atau scan kode barcode untuk menambah item.
            </p>
          </div>
        ) : (
          cart.map((item, index) => {
            const originalPrice = item.product.sellPrice * item.quantity;
            let discVal = 0;
            if (item.discountType === 'PERCENT') {
              discVal = (originalPrice * item.discount) / 100;
            } else {
              discVal = item.discount;
            }
            const lineSubtotal = Math.max(0, originalPrice - discVal);

            return (
              <div
                key={item.product.id}
                className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2 transition-all shadow-xs hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Index Badge & Initial Avatar */}
                    <span className="text-xs font-bold font-mono text-slate-400 shrink-0 w-4">
                      {index + 1}.
                    </span>

                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {getInitials(item.product.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {item.quantity} x {formatRupiah(item.product.sellPrice)} ={' '}
                        <strong className="text-slate-900 font-bold">{formatRupiah(lineSubtotal)}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Delete Item Button */}
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200"
                    title="Hapus item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline Discount Control */}
                {editingItemDiscountId === item.product.id ? (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center gap-2 text-xs">
                    <span className="text-slate-600 font-medium shrink-0">Diskon:</span>
                    <input
                      type="number"
                      min="0"
                      value={item.discount || ''}
                      onChange={(e) =>
                        updateCartItemDiscount(
                          item.product.id,
                          Number(e.target.value),
                          item.discountType
                        )
                      }
                      className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 text-xs font-mono font-bold"
                      placeholder="0"
                    />
                    <select
                      value={item.discountType}
                      onChange={(e) =>
                        updateCartItemDiscount(
                          item.product.id,
                          item.discount,
                          e.target.value as 'NOMINAL' | 'PERCENT'
                        )
                      }
                      className="bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-slate-900 text-xs font-medium"
                    >
                      <option value="NOMINAL">Rp</option>
                      <option value="PERCENT">%</option>
                    </select>
                    <button
                      onClick={() => setEditingItemDiscountId(null)}
                      className="bg-emerald-600 text-white font-bold px-2 py-1 text-xs rounded-lg shadow-xs"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  item.discount > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 w-fit">
                      <Tag className="w-3 h-3" />
                      <span>
                        Diskon: {item.discountType === 'PERCENT' ? `${item.discount}%` : formatRupiah(item.discount)}
                      </span>
                    </div>
                  )
                )}

                {/* Qty Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        updateCartQuantity(item.product.id, item.quantity - 1)
                      }
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-extrabold text-slate-900 font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateCartQuantity(item.product.id, item.quantity + 1)
                      }
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        setEditingItemDiscountId(
                          editingItemDiscountId === item.product.id
                            ? null
                            : item.product.id
                        )
                      }
                      className="ml-2 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      + Diskon Item
                    </button>
                  </div>

                  <p className="font-extrabold text-slate-900 text-sm font-mono">
                    {formatRupiah(lineSubtotal)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FLOATING BOTTOM BAR WRAPPER (Sticky at the bottom, never disappears on scroll) */}
      <div className="shrink-0 sticky bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-2xl">
        
        {/* Quick Actions Row: Laba, Pakai Promo, Hold/Catatan, and Selected Customer indicator */}
        <div className="px-3 py-2 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 flex items-center justify-between gap-1.5 text-xs select-none overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            {/* Laba Button */}
            <button
              onClick={() =>
                showToast(
                  `Estimasi Laba Bersih Transaksi: ${formatRupiah(Math.max(0, totalProfit))}`,
                  'info'
                )
              }
              className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-700 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs transition-colors"
              title="Lihat Estimasi Laba/Keuntungan"
            >
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>Laba</span>
            </button>

            {/* Pakai Promo Button */}
            <button
              onClick={() => setShowOrderDiscountInput(!showOrderDiscountInput)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-amber-700 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs transition-colors"
              title="Gunakan Promo / Diskon Nota"
            >
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              <span>
                Promo {cartOrderDiscount > 0 ? `(-${formatRupiah(cartOrderDiscount)})` : ''}
              </span>
            </button>

            {/* Hold / Catatan Button */}
            <button
              onClick={() => {
                setShowNotesModal(true);
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-sky-700 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs transition-colors"
              title="Catatan Transaksi / Simpan Sementara"
            >
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span>Hold / Catatan</span>
            </button>
          </div>

          {/* Active Customer Tag if Selected */}
          {selectedCustomer && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
              <UserCheck className="w-3 h-3 text-emerald-600" />
              <span className="truncate max-w-[85px]">{selectedCustomer.name}</span>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                title="Hapus Pelanggan dari Transaksi"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Order Level Discount Input Drawer */}
        {showOrderDiscountInput && (
          <div className="bg-amber-50/90 backdrop-blur-xs p-3 border-b border-amber-200 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-900 font-bold shrink-0">Diskon Nota (Rp):</span>
            <input
              type="number"
              min="0"
              value={cartOrderDiscount || ''}
              onChange={(e) => setCartOrderDiscount(Number(e.target.value))}
              className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-slate-900 text-xs font-mono font-bold"
              placeholder="Masukkan nominal diskon..."
            />
            <button
              onClick={() => setShowOrderDiscountInput(false)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 text-xs rounded-lg shadow-xs"
            >
              Simpan
            </button>
          </div>
        )}

        {/* Main Checkout Bar (Small User Icon Button + Elongated Full-Width Pay Button with Total Item & Rupiah) */}
        <div className="p-2.5 sm:p-3 bg-white flex items-center gap-2">
          {/* Small Customer / User Icon Button */}
          <button
            type="button"
            onClick={onOpenCustomerModal}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border transition-all relative ${
              selectedCustomer
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            title={
              selectedCustomer
                ? `Pelanggan Terpilih: ${selectedCustomer.name} (${selectedCustomer.phone || 'Non-Member'}) - Klik untuk ganti`
                : 'Pilih / Tambah Pelanggan'
            }
          >
            {selectedCustomer ? (
              <>
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 border border-white" />
              </>
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
          </button>

          {/* Primary Elongated Tombol BAYAR */}
          <button
            disabled={cart.length === 0}
            onClick={onOpenPaymentModal}
            className={`flex-1 h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl font-black text-sm flex items-center justify-between transition-all shadow-md active:scale-[0.99] select-none ${
              cart.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-mono ${
                  cart.length === 0
                    ? 'bg-slate-300 text-slate-500'
                    : 'bg-emerald-700/80 text-emerald-100'
                }`}
              >
                {totalItemsCount} Item
              </span>
              <span className="font-extrabold tracking-wide uppercase text-xs sm:text-sm">
                Bayar
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-sm sm:text-base font-black">
              <span>{formatRupiah(totalAmount)}</span>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 font-bold stroke-[3]" />
            </div>
          </button>
        </div>

      </div>

      {/* Hold / Catatan Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 text-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Hold / Catatan Pesanan</span>
              </div>
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Tambahkan catatan atau nomor meja untuk transaksi ini:
            </p>

            <textarea
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 font-medium"
              placeholder="Contoh: Meja 05 / Bungkus tanpa sambal..."
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  showToast('Catatan berhasil disimpan pada transaksi ini', 'success');
                }}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
