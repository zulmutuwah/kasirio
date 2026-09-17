import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah } from '../../utils/formatters';
import { X, UserCheck, Wallet, ArrowUpRight, ArrowDownRight, CheckCircle2, Lock } from 'lucide-react';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose }) => {
  const {
    activeShift,
    openShift,
    closeShift,
    addCashMovement,
    transactions,
    showToast,
  } = usePOS();

  // State for opening shift
  const [cashierNameInput, setCashierNameInput] = useState('Ahmad (Kasir 1)');
  const [initialCashInput, setInitialCashInput] = useState<number | ''>(100000);

  // State for closing shift
  const [finalCashInput, setFinalCashInput] = useState<number | ''>('');

  // State for adding cash movement
  const [mvtType, setMvtType] = useState<'IN' | 'OUT'>('OUT');
  const [mvtAmount, setMvtAmount] = useState<number | ''>('');
  const [mvtCategory, setMvtCategory] = useState('');
  const [mvtNotes, setMvtNotes] = useState('');

  if (!isOpen) return null;

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierNameInput.trim()) return;

    openShift(cashierNameInput.trim(), Number(initialCashInput) || 0);
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finalCashInput === '') {
      showToast('Masukkan jumlah uang fisik kasir di laci!', 'error');
      return;
    }

    closeShift(Number(finalCashInput));
  };

  const handleAddMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(mvtAmount);
    if (isNaN(amt) || amt <= 0) return;

    addCashMovement(
      mvtType,
      amt,
      mvtCategory || (mvtType === 'IN' ? 'Kas Masuk' : 'Pengeluaran Kas'),
      mvtNotes
    );

    setMvtAmount('');
    setMvtCategory('');
    setMvtNotes('');
  };

  // Compute live expected cash during open shift
  let shiftCashSales = 0;
  if (activeShift) {
    const shiftStartTime = new Date(activeShift.startTime).getTime();
    shiftCashSales = transactions
      .filter(
        (t) =>
          t.paymentMethod === 'TUNAI' &&
          t.status === 'LUNAS' &&
          new Date(t.date).getTime() >= shiftStartTime
      )
      .reduce((acc, t) => acc + t.total, 0);
  }

  const cashInMovements = activeShift
    ? activeShift.cashMovements
        .filter((m) => m.type === 'IN')
        .reduce((acc, m) => acc + m.amount, 0)
    : 0;

  const cashOutMovements = activeShift
    ? activeShift.cashMovements
        .filter((m) => m.type === 'OUT')
        .reduce((acc, m) => acc + m.amount, 0)
    : 0;

  const expectedCashCalculated = activeShift
    ? activeShift.initialCash + shiftCashSales + cashInMovements - cashOutMovements
    : 0;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full text-slate-100 shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-teal-400 font-bold text-lg mb-1">
          <Wallet className="w-5 h-5" />
          <span>Kelola Shift & Kas Laci Kasir</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Atur modal awal laci, kas keluar/masuk, dan audit rekonsiliasi saat tutup shift
        </p>

        {!activeShift ? (
          /* FORM BUKA SHIFT */
          <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Buka Shift Baru</span>
              </h4>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Nama Kasir *
                </label>
                <input
                  type="text"
                  required
                  value={cashierNameInput}
                  onChange={(e) => setCashierNameInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Uang Modal Awal Laci Kasir (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-teal-400 focus:outline-none focus:border-teal-500 font-bold"
                />
                <p className="text-[10px] text-slate-500 mt-1">Uang pecahan kecil untuk kembalian pembeli</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md"
              >
                Buka Shift Kasir
              </button>
            </div>
          </form>
        ) : (
          /* ACTIVE SHIFT CONTROLS & CLOSE SHIFT */
          <div className="space-y-5">
            {/* Active Shift Summary Banner */}
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Kasir Aktif</p>
                  <p className="font-bold text-slate-100 text-sm">{activeShift.cashierName}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                  Shift Aktif
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <p className="text-[10px] text-slate-400">Modal Awal:</p>
                  <p className="font-mono font-bold text-slate-200">
                    {formatRupiah(activeShift.initialCash)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Penjualan Tunai:</p>
                  <p className="font-mono font-bold text-emerald-400">
                    +{formatRupiah(shiftCashSales)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Kas Masuk/Keluar:</p>
                  <p className="font-mono font-bold text-amber-400">
                    +{formatRupiah(cashInMovements)} / -{formatRupiah(cashOutMovements)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Estimasi Kas Laci Saat Ini:</p>
                  <p className="font-mono font-extrabold text-teal-400 text-sm">
                    {formatRupiah(expectedCashCalculated)}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Record Cash Movement (Kas Masuk / Keluar manual) */}
            <form onSubmit={handleAddMovementSubmit} className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <h4 className="font-semibold text-slate-200 text-xs">
                Catat Uang Keluar / Uang Masuk Manual
              </h4>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMvtType('OUT')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      mvtType === 'OUT'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    - Keluar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMvtType('IN')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      mvtType === 'IN'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    + Masuk
                  </button>
                </div>

                <input
                  type="number"
                  required
                  min="1"
                  value={mvtAmount}
                  onChange={(e) => setMvtAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Nominal Rp"
                  className="col-span-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-100"
                />

                <input
                  type="text"
                  value={mvtCategory}
                  onChange={(e) => setMvtCategory(e.target.value)}
                  placeholder="Keterangan (Beli Es, Dll)"
                  className="col-span-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold rounded-lg border border-slate-700"
              >
                + Simpan Mutasi Kas
              </button>
            </form>

            {/* FORM TUTUP SHIFT */}
            <form onSubmit={handleCloseShiftSubmit} className="border-t border-slate-800 pt-4 space-y-3">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Tutup Shift & Audit Kasir</span>
              </h4>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Hitung Jumlah Uang Fisik Di Laci (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={finalCashInput}
                  onChange={(e) => setFinalCashInput(e.target.value ? Number(e.target.value) : '')}
                  placeholder={expectedCashCalculated.toString()}
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold font-mono text-teal-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {finalCashInput !== '' && (
                <div className="text-xs flex justify-between p-2 rounded-lg bg-slate-850 border border-slate-800 font-mono">
                  <span className="text-slate-400">Selisih Uang Fisik vs Sistem:</span>
                  <span className={`font-bold ${
                    Number(finalCashInput) - expectedCashCalculated < 0
                      ? 'text-rose-400'
                      : Number(finalCashInput) - expectedCashCalculated > 0
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {formatRupiah(Number(finalCashInput) - expectedCashCalculated)}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Selesai
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md"
                >
                  Tutup Shift Sekarang
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
