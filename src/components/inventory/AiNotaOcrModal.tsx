import React, { useState, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { parseNotaPasar, ParsedNotaItem } from '../../utils/geminiService';
import { formatRupiah } from '../../utils/formatters';
import {
  Sparkles,
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Info,
} from 'lucide-react';

interface AiNotaOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EditableNotaItem extends ParsedNotaItem {
  id: string;
  selected: boolean;
}

export const AiNotaOcrModal: React.FC<AiNotaOcrModalProps> = ({ isOpen, onClose }) => {
  const { products, addProduct, adjustStock, categories, showToast } = usePOS();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<EditableNotaItem[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setHasScanned(false);
      setItems([]);
      setServerNotice(null);
    }
  };

  const handleStartOcr = async () => {
    if (!selectedFile && !imagePreview) {
      showToast('Pilih atau foto nota pasar terlebih dahulu', 'error');
      return;
    }

    setIsLoading(true);
    setServerNotice(null);

    try {
      const response = await parseNotaPasar(selectedFile || imagePreview!);
      if (response.success && response.items && response.items.length > 0) {
        setItems(
          response.items.map((item, idx) => ({
            ...item,
            id: `item-${Date.now()}-${idx}`,
            selected: true,
          }))
        );
        setHasScanned(true);

        if (response.warning || response.message) {
          setServerNotice(response.warning || response.message || null);
        }
      } else {
        showToast('Tidak ada daftar barang yang terdeteksi dari foto.', 'error');
      }
    } catch (err: any) {
      showToast('Gagal memproses nota: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleUpdateItem = (
    id: string,
    field: keyof ParsedNotaItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddManualRow = () => {
    const newItem: EditableNotaItem = {
      id: `item-${Date.now()}`,
      name: 'Barang Tambahan Baru',
      quantity: 1,
      buyPrice: 10000,
      unit: 'Pcs',
      selected: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleSaveToInventory = async () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      showToast('Pilih minimal satu barang untuk dimasukkan ke stok.', 'error');
      return;
    }

    const defaultCategoryId = categories[0]?.id || 'cat-1';
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of selectedItems) {
      // Check if product already exists in database
      const existing = products.find(
        (p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );

      if (existing) {
        // Adjust existing product stock & log mutation
        await adjustStock(
          existing.id,
          Number(item.quantity),
          `Kulakan Nota Pasar (HPP: Rp ${item.buyPrice.toLocaleString('id-ID')})`
        );
        updatedCount++;
      } else {
        // Add as a new product in the store catalog
        await addProduct({
          sku: `NOTA-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
          name: item.name,
          categoryId: defaultCategoryId,
          buyPrice: Number(item.buyPrice),
          sellPrice: Math.round(Number(item.buyPrice) * 1.25 / 500) * 500, // Default 25% margin rounded to 500
          stock: Number(item.quantity),
          minStock: 3,
          unit: item.unit || 'Pcs',
        });
        addedCount++;
      }
    }

    showToast(
      `Sukses! ${updatedCount} produk diperbarui stoknya & ${addedCount} produk baru ditambahkan dari nota pasar.`,
      'success'
    );
    onClose();
  };

  const totalCalculated = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + Number(i.quantity) * Number(i.buyPrice), 0);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                AI OCR Nota Belanja Pasar
                <span className="text-[10px] bg-purple-900/80 text-purple-200 font-bold px-2 py-0.5 rounded-full border border-purple-700">
                  Human-in-the-Loop
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pindai nota tulisan tangan pasar tradisional & verifikasi sebelum masuk ke stok toko
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server status notice (if in mock mode or error warning) */}
        {serverNotice && (
          <div className="px-4 py-2 bg-purple-950/40 border-b border-purple-800/40 text-purple-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{serverNotice}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Sisi Kiri: Foto / Upload Nota (Col 4) */}
          <div className="md:col-span-4 flex flex-col space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-purple-400" />
              <span>Foto Nota Pasar</span>
            </h4>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[220px] relative overflow-hidden group ${
                imagePreview
                  ? 'border-purple-500/50 bg-slate-950/40'
                  : 'border-slate-700 hover:border-purple-400 bg-slate-850 hover:bg-slate-800/60'
              }`}
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Preview Nota Pasar"
                    className="w-full h-48 object-contain rounded-lg"
                  />
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-xs font-bold text-slate-200">
                    <RefreshCw className="w-5 h-5 mb-1 text-purple-400" />
                    <span>Ganti Foto Nota</span>
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-slate-400 p-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-purple-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-200">
                    Ketuk untuk Foto / Upload Nota
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Mendukung kamera HP langsung atau file gambar (JPG/PNG)
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={handleStartOcr}
              disabled={isLoading || !imagePreview}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                isLoading || !imagePreview
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/40'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                  <span>AI Sedang Menganalisis...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>{hasScanned ? 'Scan Ulang Nota' : 'Mulai Baca Nota (AI)'}</span>
                </>
              )}
            </button>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">💡 Tips Nota Pasar Tradisional:</p>
              <p>Pastikan tulisan tangan pedagang cukup terang. Hasil OCR akan ditampilkan di tabel kanan untuk Anda review sebelum masuk ke stok.</p>
            </div>
          </div>

          {/* Sisi Kanan: Tabel Verifikasi Human-in-the-Loop (Col 8) */}
          <div className="md:col-span-8 flex flex-col space-y-3 min-h-[300px]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Verifikasi Kasir (Human Review)</span>
                {items.length > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    {items.length} Item
                  </span>
                )}
              </h4>

              {hasScanned && (
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <ShoppingBag className="w-12 h-12 text-slate-700 mb-2" />
                <p className="font-bold text-slate-300 text-sm">Belum Ada Data Nota</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Unggah atau foto nota belanja Anda di sebelah kiri, lalu klik tombol <strong>"Mulai Baca Nota (AI)"</strong>.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-[420px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-850 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-8 text-center">✓</th>
                      <th className="p-2.5">Nama Barang</th>
                      <th className="p-2.5 w-20">Qty</th>
                      <th className="p-2.5 w-20">Satuan</th>
                      <th className="p-2.5 w-28">HPP (Harga Beli)</th>
                      <th className="p-2.5 w-24 text-right">Subtotal</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {items.map((item) => {
                      const itemSubtotal = Number(item.quantity) * Number(item.buyPrice);
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            item.selected ? 'hover:bg-slate-850/60' : 'opacity-40 bg-slate-950'
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleSelect(item.id)}
                              className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={item.name}
                              disabled={!item.selected}
                              onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 font-medium focus:border-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              disabled={!item.selected}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'quantity', Number(e.target.value))
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 font-mono text-center focus:border-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={item.unit}
                              disabled={!item.selected}
                              onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 text-center focus:border-purple-500 focus:outline-none"
                              placeholder="Kg/Pcs"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min={0}
                              step={500}
                              value={item.buyPrice}
                              disabled={!item.selected}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'buyPrice', Number(e.target.value))
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 font-mono text-right focus:border-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-purple-300">
                            {formatRupiah(itemSubtotal)}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total Summary Footer */}
            {items.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-slate-850 rounded-xl border border-slate-800 shrink-0">
                <span className="text-xs text-slate-400 font-medium">
                  Total Belanja Kulakan ({items.filter((i) => i.selected).length} dipilih):
                </span>
                <span className="text-base font-black font-mono text-purple-300">
                  {formatRupiah(totalCalculated)}
                </span>
              </div>
            )}

          </div>

        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Barang yang dicentang akan otomatis menambah stok produk dan tercatat di mutasi pembelian.
          </p>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              disabled={items.filter((i) => i.selected).length === 0}
              onClick={handleSaveToInventory}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
                items.filter((i) => i.selected).length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white shadow-purple-900/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Konfirmasi Masukkan ke Stok</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
