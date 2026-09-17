import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { X, Plus, Trash2, FolderPlus } from 'lucide-react';

interface CategoryManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { categories, addCategory, deleteCategory, products } = usePOS();
  const [newCatName, setNewCatName] = useState('');

  if (!isOpen) return null;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    addCategory({
      name: newCatName.trim(),
    });
    setNewCatName('');
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

        <div className="flex items-center gap-2 text-teal-400 font-bold text-lg mb-1">
          <FolderPlus className="w-5 h-5" />
          <span>Kelola Kategori Produk</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Tambah atau hapus kelompok kategori barang toko Anda.
        </p>

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Nama Kategori Baru..."
            className="flex-1 bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </form>

        {/* Existing Categories List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;

            return (
              <div
                key={cat.id}
                className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-200">{cat.name}</span>
                  <span className="ml-2 text-[10px] text-slate-500 font-mono">
                    ({count} produk)
                  </span>
                </div>

                <button
                  onClick={() => deleteCategory(cat.id)}
                  disabled={count > 0}
                  className={`p-1.5 rounded-lg transition-colors ${
                    count > 0
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                  }`}
                  title={count > 0 ? 'Kategori berisi produk, tidak dapat dihapus' : 'Hapus Kategori'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
