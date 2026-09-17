import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { X, UserPlus, Save } from 'lucide-react';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addCustomer, setSelectedCustomer, showToast } = usePOS();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Nama pelanggan wajib diisi!', 'error');
      return;
    }

    const newCust = await addCustomer({
      name: name.trim(),
      phone: phone.trim() || '-',
      address: address.trim(),
    });

    // Auto select this customer for active cart
    setSelectedCustomer(newCust);
    setName('');
    setPhone('');
    setAddress('');
    onClose();
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
          <UserPlus className="w-5 h-5" />
          <span>Tambah Pelanggan Baru</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Catat identitas pembeli untuk riwayat pesanan & kasbon
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nama Lengkap Pelanggan *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Pak Budi Santoso"
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              No. Telepon / WhatsApp
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alamat Lengkap (Opsional)
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Merdeka No. 123..."
              className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pelanggan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
