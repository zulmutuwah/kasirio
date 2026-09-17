import React, { useState, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { StoreSettings, BusinessType } from '../../types';
import { exportDatabaseBackup, importDatabaseBackup, db } from '../../db';
import { hashPin, verifyPin } from '../../utils/security';
import {
  Settings,
  Store,
  Printer,
  QrCode,
  Save,
  RotateCcw,
  Coins,
  Download,
  Upload,
  ShieldCheck,
  Volume2,
  VolumeX,
  Lock,
  Utensils,
  ShoppingBag,
  Wrench,
  CheckCircle2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetDemoData,
    koinAccount,
    topupKoin,
    extendProWithKoin,
    showToast,
  } = usePOS();

  const [formData, setFormData] = useState<StoreSettings>(settings);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PIN Change States
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
  const [oldPin, setOldPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const handleChange = (key: keyof StoreSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  // Backup Data Handler
  const handleBackupData = async () => {
    try {
      const jsonBackup = await exportDatabaseBackup();
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `kasirio_backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Cadangan data berhasil diunduh (file JSON).');
    } catch (err) {
      console.error('Backup failed:', err);
      showToast('Gagal membuat berkas cadangan data.', 'error');
    }
  };

  // Restore Data Handler
  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await importDatabaseBackup(content);
        showToast('Data berhasil dipulihkan dari berkas backup!');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        console.error('Restore failed:', err);
        showToast('Gagal memulihkan data: Format berkas tidak sesuai.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Change Owner PIN Handler
  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('PIN baru harus 4 - 6 digit angka.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    try {
      const ownerUser = await db.users.where('role').equals('OWNER').first();
      if (ownerUser) {
        const isValidOld = await verifyPin(oldPin, ownerUser.pinHash);
        if (!isValidOld) {
          setPinError('PIN lama Anda salah.');
          return;
        }
      }

      const newHash = await hashPin(newPin);
      if (ownerUser) {
        await db.users.update(ownerUser.id, { pinHash: newHash });
      } else {
        await db.users.put({
          id: 'user-owner-1',
          name: 'Owner',
          role: 'OWNER',
          pinHash: newHash,
          createdAt: new Date().toISOString(),
        });
      }

      showToast('PIN otorisasi Owner berhasil diperbarui!');
      setIsChangingPin(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      console.error('Failed to change PIN:', err);
      setPinError('Gagal mengubah PIN.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          Pengaturan Toko & Keamanan
        </h2>
        <p className="text-xs text-slate-400">
          Ubah tipe usaha, format struk, keamanan PIN kasir, backup data offline, dan Koin Kasirio
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: PROFIL TOKO & TIPE USAHA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm border-b border-slate-800 pb-3">
            <Store className="w-5 h-5" />
            <span>Profil Usaha & Tipe Bisnis</span>
          </div>

          {/* Toggle Tipe Usaha */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Jenis / Sektor Usaha
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleChange('businessType', 'RETAIL')}
                className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  formData.businessType === 'RETAIL'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-xs font-bold">Toko / Ritel</span>
                <span className="text-[10px] text-slate-400 font-normal">Minimarket, Sembako, Butik</span>
              </button>

              <button
                type="button"
                onClick={() => handleChange('businessType', 'FNB')}
                className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  formData.businessType === 'FNB'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Utensils className="w-5 h-5" />
                <span className="text-xs font-bold">Kuliner / F&B</span>
                <span className="text-[10px] text-slate-400 font-normal">Kafe, Kedai Kopi, Resto</span>
              </button>

              <button
                type="button"
                onClick={() => handleChange('businessType', 'SERVICE')}
                className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  formData.businessType === 'SERVICE'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-5 h-5" />
                <span className="text-xs font-bold">Jasa</span>
                <span className="text-[10px] text-slate-400 font-normal">Laundry, Barbershop, Bengkel</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Toko / Usaha *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
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
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
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
                className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PENGATURAN STRUK & HARDWARE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm border-b border-slate-800 pb-3">
            <Printer className="w-5 h-5" />
            <span>Format Struk & Notifikasi Kasir</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ukuran Kertas Printer Thermal Fisik
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('paperSize', '58mm')}
                  className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
                    formData.paperSize === '58mm'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
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
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-850 border-slate-800 text-slate-400'
                  }`}
                >
                  80mm (Lebar Desktop)
                </button>
              </div>
            </div>

            {/* Virtual Web Soundbox */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Virtual Web Soundbox (Suara Notifikasi)
              </label>
              <div className="flex items-center justify-between bg-slate-850 p-2.5 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2">
                  {formData.soundboxEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-xs text-slate-200">Notifikasi Suara Pembayaran</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.soundboxEnabled}
                  onChange={(e) => handleChange('soundboxEnabled', e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-slate-700 bg-slate-900 cursor-pointer"
                />
              </div>
            </div>

            {/* Pajak */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pajak Usaha (PPN / Pajak Restoran PB1)
              </label>
              <div className="flex flex-wrap items-center gap-3 bg-slate-850 p-3 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  id="enableTax"
                  checked={formData.enableTax}
                  onChange={(e) => handleChange('enableTax', e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-slate-700 bg-slate-900 cursor-pointer"
                />
                <label htmlFor="enableTax" className="text-xs text-slate-200 cursor-pointer">
                  Aktifkan Pajak
                </label>

                {formData.enableTax && (
                  <>
                    <select
                      value={formData.taxLabel || 'PPN'}
                      onChange={(e) => handleChange('taxLabel', e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="PPN">PPN (Ritel/Toko)</option>
                      <option value="PB1">PB1 / PBJT (Restoran/Kafe)</option>
                    </select>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={formData.taxPercentage}
                        onChange={(e) => handleChange('taxPercentage', Number(e.target.value))}
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-slate-100"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                  </>
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
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: REKENING & QRIS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm border-b border-slate-800 pb-3">
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
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan Toko</span>
          </button>
        </div>
      </form>

      {/* SECTION 4: KEAMANAN PIN GATE (OTORISASI OWNER) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Lock className="w-5 h-5" />
            <span>Keamanan Kasir (PIN Gate Owner)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsChangingPin(!isChangingPin)}
            className="text-xs text-amber-400 hover:underline font-semibold"
          >
            {isChangingPin ? 'Tutup Form' : 'Ubah PIN Owner'}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          PIN ini digunakan untuk mengotorisasi pembatalan transaksi (*void*) dan pemberian diskon manual besar oleh kasir untuk mencegah kecurangan (*fraud*).
        </p>

        {isChangingPin && (
          <form onSubmit={handleUpdatePin} className="bg-slate-850 p-4 rounded-xl space-y-3 max-w-md border border-slate-800">
            <div>
              <label className="block text-xs text-slate-300 mb-1">PIN Lama (Default: 123456)</label>
              <input
                type="password"
                maxLength={6}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                placeholder="Masukkan PIN lama"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">PIN Baru (4-6 digit angka)</label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                placeholder="PIN Baru"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Konfirmasi PIN Baru</label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                placeholder="Ulangi PIN Baru"
                required
              />
            </div>

            {pinError && <p className="text-xs text-rose-400 font-medium">{pinError}</p>}

            <button
              type="submit"
              className="py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
            >
              Simpan PIN Baru
            </button>
          </form>
        )}
      </div>

      {/* SECTION 5: CADANGAN & PEMULIHAN DATA OFFLINE (BACKUP / RESTORE) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 text-blue-400 font-bold text-sm border-b border-slate-800 pb-3">
          <ShieldCheck className="w-5 h-5" />
          <span>Cadangan & Pemulihan Data Offline (Jaring Pengaman Data)</span>
        </div>

        <p className="text-xs text-slate-400">
          Seluruh data transaksi dan stok Anda tersimpan aman di peramban lokal perangkat ini. Unduh berkas cadangan secara berkala agar dapat dipulihkan kapan saja jika perangkat Anda rusak atau diganti.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleBackupData}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Cadangan Data (Backup JSON)</span>
          </button>

          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileRestore}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Pulihkan Data dari Berkas (Restore JSON)</span>
          </button>
        </div>
      </div>

      {/* SECTION 6: KOIN KASIRIO & STATUS LANGGANAN PRO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm">
            <Coins className="w-5 h-5" />
            <span>Koin Kasirio & Paket Langganan Pro</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
            {koinAccount.isPro ? 'Akun Pro Aktif' : 'Akun Starter'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
            <span className="text-xs text-slate-400">Saldo Koin Kasirio</span>
            <span className="text-2xl font-extrabold text-yellow-400 font-mono mt-1">
              {koinAccount.saldoKoin} <span className="text-xs text-slate-400 font-normal">Koin</span>
            </span>
          </div>

          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col justify-center sm:col-span-2">
            <span className="text-xs text-slate-400">Masa Aktif Pro Hingga</span>
            <span className="text-sm font-bold text-slate-200 mt-1">
              {koinAccount.proExpiresAt
                ? new Date(koinAccount.proExpiresAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '-'}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Otomatis diperpanjang dengan saldo koin tanpa perlu kartu kredit.
            </span>
          </div>
        </div>

        {/* Quick Top-up & Extend buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => topupKoin(100, 100000)}
            className="px-3 py-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 font-bold text-xs"
          >
            + Top-up 100 Koin (Rp 100.000)
          </button>
          <button
            type="button"
            onClick={() => extendProWithKoin(50, 30)}
            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs"
          >
            Perpanjang Pro 30 Hari (50 Koin)
          </button>
        </div>
      </div>

      {/* Reset Demo Data */}
      <div className="pt-2 flex justify-start">
        <button
          type="button"
          onClick={resetDemoData}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-800 text-slate-500 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Data Demo Awal</span>
        </button>
      </div>
    </div>
  );
};
