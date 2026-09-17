import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { AddEditProductModal } from './AddEditProductModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { CategoryManageModal } from './CategoryManageModal';
import {
  Boxes,
  Plus,
  Search,
  FolderPlus,
  AlertTriangle,
  Edit2,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  TrendingUp,
  Package
} from 'lucide-react';

interface InventoryViewProps {
  isAddProductOpenExternal?: boolean;
  onCloseAddProductExternal?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  isAddProductOpenExternal,
  onCloseAddProductExternal,
}) => {
  const {
    products,
    categories,
    deleteProduct,
    stockLogs,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productForStockAdj, setProductForStockAdj] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'katalog' | 'riwayatStok'>('katalog');

  // Handle external modal trigger from header
  const isAddOpen = isAddModalOpen || !!isAddProductOpenExternal;
  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    setProductToEdit(null);
    if (onCloseAddProductExternal) onCloseAddProductExternal();
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLowStock = !showLowStockOnly || p.stock <= p.minStock;
    return matchesCategory && matchesSearch && matchesLowStock;
  });

  // Calculate inventory valuation
  const totalStockCount = products.reduce((acc, p) => acc + p.stock, 0);
  const totalHppValuation = products.reduce((acc, p) => acc + p.stock * p.buyPrice, 0);
  const totalSellValuation = products.reduce((acc, p) => acc + p.stock * p.sellPrice, 0);
  const potentialProfitValuation = totalSellValuation - totalHppValuation;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 space-y-5">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-teal-400" />
            Manajemen Produk & Stok
          </h2>
          <p className="text-xs text-slate-400">
            Atur katalog barang, harga jual, HPP, dan riwayat mutasi stok toko
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-teal-400" />
            <span>Kelola Kategori</span>
          </button>

          <button
            onClick={() => {
              setProductToEdit(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Valuation Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Item Produk</span>
            <Package className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <p className="text-lg font-extrabold text-slate-100 font-mono">
              {products.length} <span className="text-xs text-slate-400 font-normal">Jenis</span>
            </p>
            <p className="text-[11px] text-slate-500">Total Stok: {totalStockCount} unit</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Nilai Aset Stok (HPP)</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-extrabold text-slate-100 font-mono">
              {formatRupiah(totalHppValuation)}
            </p>
            <p className="text-[11px] text-slate-500">Modal tertahan di stok</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Potensi Nilai Jual</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-extrabold text-emerald-400 font-mono">
              {formatRupiah(totalSellValuation)}
            </p>
            <p className="text-[11px] text-emerald-500/80 font-medium">
              Estimasi Margin: +{formatRupiah(potentialProfitValuation)}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Stok Menipis / Habis</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className={`text-lg font-extrabold font-mono ${lowStockCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
              {lowStockCount} <span className="text-xs text-slate-400 font-normal">Produk</span>
            </p>
            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className="text-[11px] text-teal-400 hover:underline font-medium"
            >
              {showLowStockOnly ? 'Tampilkan Semua' : 'Filter Barang Menipis'}
            </button>
          </div>
        </div>
      </div>

      {/* Subtab Toggle (Katalog vs Riwayat Stok) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('katalog')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'katalog'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Katalog & Stok ({filteredProducts.length})
        </button>

        <button
          onClick={() => setActiveSubTab('riwayatStok')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'riwayatStok'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Log Penyesuaian Stok ({stockLogs.length})
        </button>
      </div>

      {/* TAB 1: KATALOG PRODUK */}
      {activeSubTab === 'katalog' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk / SKU..."
                className="w-full bg-slate-850 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  showLowStockOnly
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                    : 'bg-slate-850 text-slate-300 border-slate-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Hanya Stok Menipis</span>
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-850 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Produk</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-right">Harga Beli (HPP)</th>
                    <th className="py-3 px-4 text-right">Harga Jual</th>
                    <th className="py-3 px-4 text-center">Stok</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Tidak ada data produk yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const category = categories.find((c) => c.id === p.categoryId);
                      const isLowStock = p.stock <= p.minStock;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-850/60 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-800 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 border border-slate-700">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-slate-100 text-xs">
                                  {p.name}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500">
                                  SKU: {p.sku}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium text-[11px] border border-slate-700">
                              {category?.name || 'Umum'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            {formatRupiah(p.buyPrice)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-teal-400">
                            {formatRupiah(p.sellPrice)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-xs ${
                                  p.stock <= 0
                                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                    : isLowStock
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {p.stock} {p.unit}
                              </span>
                              {isLowStock && (
                                <span className="text-[9px] text-amber-400 mt-0.5 font-medium">
                                  Min: {p.minStock}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setProductForStockAdj(p)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 transition-colors"
                                title="Atur / Penyesuaian Stok"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setProductToEdit(p);
                                  setIsAddModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                                title="Edit Produk"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => deleteProduct(p.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 transition-colors"
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RIWAYAT STOK */}
      {activeSubTab === 'riwayatStok' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-4">
          <h3 className="font-bold text-slate-100 text-sm mb-3">Log Penyesuaian Stok Terakhir</h3>
          {stockLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Belum ada riwayat penyesuaian stok manual.
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {stockLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{log.productName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.type === 'IN'
                            ? 'bg-emerald-950 text-emerald-300'
                            : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {log.type === 'IN' ? '+ Stuk Masuk' : '- Stok Keluar'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{log.notes}</p>
                  </div>

                  <div className="text-right font-mono">
                    <p className="font-bold text-slate-200">
                      {log.previousStock} → {log.currentStock}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(log.date).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <AddEditProductModal
        isOpen={isAddOpen}
        onClose={handleCloseAdd}
        productToEdit={productToEdit}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        product={productForStockAdj}
        onClose={() => setProductForStockAdj(null)}
      />

      {/* Category Manager Modal */}
      <CategoryManageModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />
    </div>
  );
};
