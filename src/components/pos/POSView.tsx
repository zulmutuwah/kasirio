import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { ProductCard } from './ProductCard';
import { CartPanel } from './CartPanel';
import { PaymentModal } from './PaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import {
  Search,
  LayoutGrid,
  List,
  PackageX,
  Plus,
  Barcode,
  X,
  UserPlus,
  UserCheck
} from 'lucide-react';

interface POSViewProps {
  onOpenCustomerModal: () => void;
  onOpenAddProductModal: () => void;
}

export const POSView: React.FC<POSViewProps> = ({
  onOpenCustomerModal,
  onOpenAddProductModal,
}) => {
  const {
    products,
    categories,
    cart,
    addToCart,
    selectedCustomer,
    activeReceiptTransaction,
    setActiveReceiptTransaction,
    showToast,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Global Keyboard Shortcuts (F2: Focus search, F10: Pay, Esc: Clear search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F10' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (cart.length > 0) {
          setIsPaymentModalOpen(true);
        } else {
          showToast('Keranjang masih kosong!', 'error');
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        onOpenCustomerModal();
      } else if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, searchQuery, onOpenCustomerModal, showToast]);

  // Handle barcode scanner / search Enter key direct add to cart
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Find exact SKU match or first product name match
    const query = searchQuery.trim().toLowerCase();
    const matched = products.find(
      (p) => p.sku.toLowerCase() === query || p.name.toLowerCase() === query
    ) || filteredProducts[0];

    if (matched) {
      if (matched.stock <= 0) {
        showToast(`Stok ${matched.name} habis!`, 'error');
      } else {
        addToCart(matched);
        setSearchQuery('');
      }
    } else {
      showToast(`Produk "${searchQuery}" tidak ditemukan`, 'error');
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategoryId === 'ALL' || product.categoryId === selectedCategoryId;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate cart total summary for mobile bar
  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => {
    const originalPrice = item.product.sellPrice * item.quantity;
    let discVal = 0;
    if (item.discountType === 'PERCENT') {
      discVal = (originalPrice * item.discount) / 100;
    } else {
      discVal = item.discount;
    }
    return acc + Math.max(0, originalPrice - discVal);
  }, 0);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 overflow-hidden bg-slate-100/70 select-none relative">
      
      {/* Left Panel (Catalog, Search & Categories) - 100% height on mobile for maximum space */}
      <div className="w-full md:w-[42%] lg:w-[40%] xl:w-[38%] flex flex-col h-full min-h-0 overflow-hidden p-3 sm:p-4 space-y-3 shrink-0 border-r border-slate-200 bg-white shadow-xs pb-20 md:pb-4">
        
        {/* Search Box & Barcode Scanner Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Klik disini dan scan barcode..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-inner"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <span className="absolute right-3 top-2.5 text-[10px] font-extrabold text-slate-300 font-mono hidden sm:inline">
                F2
              </span>
            )}
          </div>

          {/* Quick Add Product & Grid/List View Toggles */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenAddProductModal}
              className="px-2.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
              title="Tambah Produk Baru"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">Barang</span>
            </button>

            <div className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-emerald-600 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Tampilan Grid Card"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-emerald-600 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Tampilan Daftar List"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Category Tabs (Horizontal Scrollable Pills) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
          <button
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategoryId === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Semua ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product Grid / List Scrollable Area */}
        <div className="flex-1 overflow-y-auto pr-0.5">
          {filteredProducts.length === 0 ? (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <PackageX className="w-12 h-12 mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">Produk Tidak Ditemukan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Tidak ada produk dengan nama atau SKU "{searchQuery}". Coba kata kunci lain atau scan ulang.
              </p>
              <button
                onClick={onOpenAddProductModal}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Produk Sekarang</span>
              </button>
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-2.5'
                  : 'flex flex-col gap-2'
              }
            >
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right Panel - Hidden on Mobile to expand product view, shown as side panel on Desktop */}
      <div className="hidden md:flex flex-1 flex-col h-full min-h-0 overflow-hidden">
        <CartPanel
          onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
          onOpenCustomerModal={onOpenCustomerModal}
        />
      </div>

      {/* Mobile Floating Sticky Checkout Bar (Only visible when items are in cart) */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 p-2.5 shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
          {/* Small Customer Icon Button */}
          <button
            type="button"
            onClick={onOpenCustomerModal}
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all relative ${
              selectedCustomer
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
            title={selectedCustomer ? `Pelanggan: ${selectedCustomer.name}` : 'Pilih / Tambah Pelanggan'}
          >
            {selectedCustomer ? (
              <>
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1 right-1 border border-white" />
              </>
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
          </button>

          {/* Elongated Single Pay / Review Button (Memanjang, Mudah Di-tap) */}
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="flex-1 h-11 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-xs flex items-center justify-between shadow-md shadow-emerald-600/30 transition-all select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-700/90 text-emerald-100 font-mono">
                {totalCartItems} Item
              </span>
              <span className="uppercase tracking-wider font-extrabold text-xs">
                Bayar
              </span>
            </div>
            <span className="font-mono font-black text-sm text-white">
              {cartSubtotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
            </span>
          </button>
        </div>
      )}

      {/* Mobile Full Order Review Modal (Daftar Pesanan Review) */}
      {isMobileCartOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex flex-col justify-end animate-in fade-in duration-200">
          <div
            onClick={() => setIsMobileCartOpen(false)}
            className="fixed inset-0"
          />

          <div className="relative z-10 bg-white rounded-t-3xl w-full h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Top Modal Header */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <h3 className="font-extrabold text-sm text-slate-100">
                  Review Daftar Pesanan
                </h3>
              </div>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Panel inside Mobile Sheet */}
            <div className="flex-1 overflow-hidden">
              <CartPanel
                onOpenPaymentModal={() => {
                  setIsMobileCartOpen(false);
                  setIsPaymentModalOpen(true);
                }}
                onOpenCustomerModal={onOpenCustomerModal}
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onOpenCustomerModal={onOpenCustomerModal}
      />

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal
        transaction={activeReceiptTransaction}
        onClose={() => setActiveReceiptTransaction(null)}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal />
    </div>
  );
};
