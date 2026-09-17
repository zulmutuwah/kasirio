import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Customer } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { X, CheckCircle2, Banknote, Building2 } from 'lucide-react';

interface PayDebtModalProps {
  customer: Customer | null;
  onClose: () => void;
}

export const PayDebtModal: React.FC<PayDebtModalProps> = ({
  customer,
  onClose,
}) => {
  const { payCustomerDebt, showToast } = usePOS();

  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'TRANSFER' | 'QRIS'>('TUNAI');
  const [notes, setNotes] = useState('');

  if (!customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      showToast('Masukkan jumlah pelunasan yang valid', 'error');
      return;
    }

    if (amount > customer.totalDebt) {
      showToast('Jumlah bayar melebihi total sisa kasbon!', 'error');
      return;
    }

    payCustomerDebt(customer.id, amount, paymentMethod, notes);
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

        <h3 className="font-bold text-lg text-slate-100 mb-1">
          Pelunasan Kasbon / Piutang
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Pelanggan: <strong className="text-teal-400">{customer.name}</strong>
        </p>

        {/* Debt Banner */}
        <div className="bg-amber-950/30 border border-amber-800/60 p-3.5 rounded-xl flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-amber-300">Sisa Total Kasbon</p>
            <p className="text-xl font-extrabold text-amber-400 font-mono">
              {formatRupiah(customer.totalDebt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAmountPaid(customer.totalDebt)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow"
          >
            Bayar Lunas
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Jumlah Bayar (Rp)
            </label>
            <input
              type="number"
              required
              min="1"
              max={customer.totalDebt}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
              placeholder="0"
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold font-mono text-teal-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Metode Pembayaran Pelunasan
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('TUNAI')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'TUNAI'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                    : 'bg-slate-850 border-slate-800 text-slate-400'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Tunai</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TRANSFER')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'TRANSFER'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                    : 'bg-slate-850 border-slate-800 text-slate-400'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('QRIS')}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'QRIS'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                    : 'bg-slate-850 border-slate-800 text-slate-400'
                }`}
              >
                <span>QRIS</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Catatan Pembayaran (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Titip lewat anak / Transfer BCA"
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
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
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Pembayaran</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
