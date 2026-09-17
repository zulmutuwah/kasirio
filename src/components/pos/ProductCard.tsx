import React from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Plus, Check, Layers } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode }) => {
  const { addToCart, cart } = usePOS();

  const isLowStock = product.stock <= product.minStock && product.stock > 0;
  const isOutOfStock = product.stock <= 0;

  // Check if item is already in cart to display quantity badge
  const cartItem = cart.find((item) => item.product.id === product.id);
  const cartQty = cartItem ? cartItem.quantity : 0;

  // Get initial letters for fallback thumbnail (e.g., "Acnes Creamy Wash" -> "Ac")
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Color generator based on product category/name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-sky-100 text-sky-800 border-sky-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-amber-100 text-amber-800 border-amber-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-rose-100 text-rose-800 border-rose-200',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarStyle = getAvatarColor(product.name);

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => !isOutOfStock && addToCart(product)}
        className={`group bg-white border rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 ${
          isOutOfStock
            ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
            : cartQty > 0
            ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20'
            : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-12 h-12 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border font-extrabold text-sm ${avatarStyle}`}>
              {getInitials(product.name)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
                {product.name}
              </h3>
              {product.variants && product.variants.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5">
                  <Layers className="w-2.5 h-2.5" />
                  {product.variants.length} Harga
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs mt-0.5">
              <span className="font-mono text-slate-400 text-[11px]">{product.sku}</span>
              <span className="text-slate-300">•</span>
              <span
                className={`font-semibold text-xs ${
                  isOutOfStock
                    ? 'text-rose-600 font-bold'
                    : isLowStock
                    ? 'text-amber-600 font-bold'
                    : 'text-slate-500'
                }`}
              >
                {isOutOfStock ? 'Stok Habis' : `sisa ${product.stock}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-extrabold text-slate-900 text-sm">{formatRupiah(product.sellPrice)}</p>
          </div>

          <button
            disabled={isOutOfStock}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : cartQty > 0
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80'
            }`}
          >
            {cartQty > 0 ? (
              <span className="text-xs font-bold">{cartQty}</span>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => !isOutOfStock && addToCart(product)}
      className={`group relative bg-white border rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-150 select-none ${
        isOutOfStock
          ? 'opacity-50 bg-slate-50/80 border-slate-200 cursor-not-allowed'
          : cartQty > 0
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
          : 'border-slate-200 hover:border-emerald-400 hover:shadow-md'
      }`}
    >
      {/* Badge Quantity in Cart if > 0 */}
      {cartQty > 0 && (
        <div className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md z-10 border-2 border-white">
          {cartQty}
        </div>
      )}

      <div>
        {/* Product Image / Avatar Initial */}
        <div className="relative w-full h-24 rounded-xl overflow-hidden bg-slate-50 mb-2.5 border border-slate-100 flex items-center justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full h-full flex flex-col items-center justify-center font-black text-xl border ${avatarStyle}`}>
              <span>{getInitials(product.name)}</span>
            </div>
          )}

          {/* Multiple prices / variant badge */}
          {product.variants && product.variants.length > 0 && (
            <div className="absolute top-1.5 right-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <Layers className="w-2.5 h-2.5 text-amber-300" />
              <span>{product.variants.length} Harga</span>
            </div>
          )}
        </div>

        {/* Product Title & Stock */}
        <div className="mb-2">
          <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
            {product.name}
          </h3>
          <p
            className={`text-[11px] font-semibold mt-1 ${
              isOutOfStock
                ? 'text-rose-600'
                : isLowStock
                ? 'text-amber-600'
                : 'text-slate-500'
            }`}
          >
            {isOutOfStock ? 'Stok Habis' : `sisa ${product.stock}`}
          </p>
        </div>
      </div>

      {/* Footer: Price & Quick Add */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 mt-1">
        <p className="font-extrabold text-slate-900 text-sm tracking-tight">
          {formatRupiah(product.sellPrice)}
        </p>

        <button
          disabled={isOutOfStock}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            isOutOfStock
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : cartQty > 0
              ? 'bg-emerald-600 text-white font-bold shadow-xs'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80'
          }`}
          title="Tambah ke Keranjang"
        >
          {cartQty > 0 ? (
            <Check className="w-4 h-4 font-bold" />
          ) : (
            <Plus className="w-4 h-4 font-bold" />
          )}
        </button>
      </div>
    </div>
  );
};
