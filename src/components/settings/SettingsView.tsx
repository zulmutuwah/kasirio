import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { StoreSettings } from '../../types';
import {
  Settings,
  Store,
  Printer,
  QrCode,
  Building2,
  Percent,
  Save,
  RotateCcw,
  Check
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, resetDemoData, showToast } = usePOS();

  const [formData, setFormData] = useState<StoreSettings>(settings);

  const handleChange = (key: keyof StoreSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 space-y-6 max-w-4xl mx-auto">
      
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-400" />
          Pengaturan Toko & Struk Cetak
        </h2>
        <p className="text-xs text-slate-400">
          Ubah profil usaha, preferensi printer thermal, pajak, dan nomor rekening pembayaran
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION 1: PROFIL TOKO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-teal-400 font-bold text-sm border-b border-slate-800 pb-3">
            <Store className="w-5 h-5" />
            <span>Profil Usaha / Toko</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Toko / Usaha *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                No. Telepon Toko
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Alamat Toko Lengkap
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PENGATURAN STRUK CETAK THERMAL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-teal-400 font-bold text-sm border-b border-slate-800 pb-3">
            <Printer className="w-5 h-5" />
            <span>Format Struk Cetak Thermal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ukuran Kertas Printer Thermal
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('paperSize', '58mm')}
                  className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
                    formData.paperSize === '58mm'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-slate-850 border-slate-800 text-slate-400'
                  }`}
                >
                  58mm (Standar Bluetooth)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('paperSize', '80mm')}
                  className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
                    formData.paperSize === '80mm'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-slate-850 border-slate-800 text-slate-400'
                  }`}
                >
                  80mm (Lebar Desktop)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pajak Penjualan (PPN)
              </label>
              <div className="flex items-center gap-2 bg-slate-850 p-2 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  id="enableTax"
                  checked={formData.enableTax}
                  onChange={(e) => handleChange('enableTax', e.target.checked)}
                  className="w-4 h-4 text-teal-500 rounded border-slate-700 bg-slate-900"
                />
                <label htmlFor="enableTax" className="text-xs text-slate-200 cursor-pointer flex-1">
                  Aktifkan PPN ({formData.taxPercentage}%)
                </label>
                {formData.enableTax && (
                  <input
                    type="number"
                    value={formData.taxPercentage}
                    onChange={(e) => handleChange('taxPercentage', Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center font-mono text-slate-100"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pesan Atas Struk (Header)
              </label>
              <input
                type="text"
                value={formData.receiptHeaderNote}
                onChange={(e) => handleChange('receiptHeaderNote', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pesan Bawah Struk (Footer / Garansi)
              </label>
              <input
                type="text"
                value={formData.receiptFooterNote}
                onChange={(e) => handleChange('receiptFooterNote', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: METODE PEMBAYARAN REKENING & QRIS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-teal-400 font-bold text-sm border-b border-slate-800 pb-3">
            <QrCode className="w-5 h-5" />
            <span>Pengaturan QRIS & Rekening Transfer</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Merchant QRIS
              </label>
              <input
                type="text"
                value={formData.qrisMerchantName || ''}
                onChange={(e) => handleChange('qrisMerchantName', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Info Rekening Bank (BCA/Mandiri/BRI)
              </label>
              <input
                type="text"
                value={formData.bankAccountInfo || ''}
                onChange={(e) => handleChange('bankAccountInfo', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={resetDemoData}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-800 text-slate-400 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Data Demo Awal</span>
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-teal-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Seluruh Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
