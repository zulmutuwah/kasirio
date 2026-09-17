import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Product } from '../../types';
import { generateSKU } from '../../utils/formatters';
import { X, Image as ImageIcon, Save, Plus } from 'lucide-react';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
}) => {
  const { categories, addProduct, updateProduct, showToast } = usePOS();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [buyPrice, setBuyPrice] = useState<number | ''>('');
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>('');
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [unit, setUnit] = useState('Pcs');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');

  // Sample preset images for quick selection
  const sampleImages = [
    { label: 'Kopi', url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=400&q=80' },
    { label: 'Nasi Goreng', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80' },
    { label: 'Teh/Minuman', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80' },
    { label: 'Snack', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80' },
    { label: 'Beras/Sembako', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80' },
  ];

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setSku(productToEdit.sku);
      setCategoryId(productToEdit.categoryId);
      setBuyPrice(productToEdit.buyPrice);
      setSellPrice(productToEdit.sellPrice);
      setStock(productToEdit.stock);
      setMinStock(productToEdit.minStock);
      setUnit(productToEdit.unit);
      setImageUrl(productToEdit.imageUrl || '');
      setDescription(productToEdit.description || '');
    } else {
      setName('');
      const defaultCat = categories[0]?.id || 'cat-1';
      setCategoryId(defaultCat);
      setSku(generateSKU('PROD'));
      setBuyPrice('');
      setSellPrice('');
      setStock(10);
      setMinStock(5);
      setUnit('Pcs');
      setImageUrl('');
      setDescription('');
    }
  }, [productToEdit, isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Nama produk wajib diisi!', 'error');
      return;
    }

    const buyPriceNum = Number(buyPrice) || 0;
    const sellPriceNum = Number(sellPrice) || 0;

    if (sellPriceNum <= 0) {
      showToast('Harga jual harus lebih besar dari 0!', 'error');
      return;
    }

    if (productToEdit) {
      updateProduct(productToEdit.id, {
        name,
        sku: sku || generateSKU('PROD'),
        categoryId,
        buyPrice: buyPriceNum,
        sellPrice: sellPriceNum,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        unit: unit || 'Pcs',
        imageUrl,
        description,
      });
    } else {
      addProduct({
        name,
        sku: sku || generateSKU('PROD'),
        categoryId,
        buyPrice: buyPriceNum,
        sellPrice: sellPriceNum,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        unit: unit || 'Pcs',
        imageUrl,
        description,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full text-slate-100 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-slate-100">
              {productToEdit ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h3>
            <p className="text-xs text-slate-400">
              Lengkapi informasi produk & stok untuk inventoris POS
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Name & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Produk *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Es Kopi Susu Gula Aren"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SKU / Barcode
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Kategori
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Satuan Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="Pcs">Pcs</option>
                <option value="Botol">Botol</option>
                <option value="Bungkus">Bungkus</option>
                <option value="Gelas">Gelas</option>
                <option value="Porsi">Porsi</option>
                <option value="Paket">Paket</option>
                <option value="Karung">Karung</option>
                <option value="Pouch">Pouch</option>
                <option value="Box">Box</option>
                <option value="Kg">Kg</option>
              </select>
            </div>
          </div>

          {/* Price Settings (Buy Price HPP vs Sell Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-850 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Harga Beli / HPP (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="10000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-teal-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Untuk hitung keuntungan bersih</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-teal-300 mb-1">
                Harga Jual Kasir (Rp) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="15000"
                className="w-full bg-slate-900 border border-teal-500/50 rounded-xl px-3 py-2 text-sm font-bold font-mono text-teal-300 focus:outline-none focus:border-teal-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">Harga yang dibayar pembeli</p>
            </div>
          </div>

          {/* Stock Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Jumlah Stok Awal
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value ? Number(e.target.value) : '')}
                placeholder="10"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Batas Minimum Stok (Alert)
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value ? Number(e.target.value) : '')}
                placeholder="5"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Image URL & Preset Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Foto Produk (URL Gambar)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="flex-1 bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Quick preset images picker */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Pilih Contoh:</span>
              {sampleImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageUrl(img.url)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700"
                >
                  {img.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan bahan, varian, atau spesifikasi produk..."
              className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-500/20"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Produk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
