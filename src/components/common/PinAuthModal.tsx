import React, { useState } from 'react';
import { db } from '../../db';
import { verifyPin } from '../../utils/security';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';

interface PinAuthModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  title = 'Otorisasi Pemilik Diperlukan',
  description = 'Aksi ini memerlukan PIN Owner toko untuk melanjutkan.',
  onSuccess,
  onCancel,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleKeyPress = (digit: string) => {
    setErrorMsg(null);
    if (pinInput.length < 6) {
      setPinInput((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg(null);
    setPinInput('');
  };

  const handleSubmit = async () => {
    if (pinInput.length < 4) {
      setErrorMsg('Masukkan minimal 4 digit PIN');
      return;
    }

    setIsVerifying(true);
    try {
      // Cari akun owner
      const ownerUser = await db.users.where('role').equals('OWNER').first();
      if (!ownerUser) {
        // Fallback jika belum ada user
        if (pinInput === '123456') {
          handleSuccess();
          return;
        }
      } else {
        const isValid = await verifyPin(pinInput, ownerUser.pinHash);
        if (isValid) {
          handleSuccess();
          return;
        }
      }

      setErrorMsg('PIN yang Anda masukkan salah!');
      setPinInput('');
    } catch (err) {
      console.error('Error verifying PIN:', err);
      setErrorMsg('Gagal memverifikasi PIN.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSuccess = () => {
    setPinInput('');
    setErrorMsg(null);
    onSuccess();
  };

  const handleClose = () => {
    setPinInput('');
    setErrorMsg(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden text-slate-100 flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <Lock className="w-5 h-5" />
            <span>{title}</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <p className="text-xs text-slate-400 text-center mb-4 leading-relaxed">
            {description}
          </p>

          {/* PIN Indicators */}
          <div className="flex items-center gap-3 my-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  pinInput.length > idx
                    ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'border-slate-700 bg-slate-800'
                }`}
              />
            ))}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-rose-400 text-xs mt-2 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px] mt-5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 font-bold text-lg text-slate-100 transition-colors border border-slate-700/50 shadow-sm"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 font-semibold text-xs text-slate-400 transition-colors"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 font-bold text-lg text-slate-100 transition-colors border border-slate-700/50 shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 font-semibold text-xs text-slate-400 transition-colors"
            >
              ⌫
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            disabled={pinInput.length === 0 || isVerifying}
            onClick={handleSubmit}
            className="w-full mt-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none font-bold text-sm text-white shadow-lg shadow-emerald-900/30 transition-all"
          >
            {isVerifying ? 'Memverifikasi...' : 'Konfirmasi PIN'}
          </button>
          <p className="text-[10px] text-slate-500 mt-2">PIN default awal Owner: 123456</p>
        </div>
      </div>
    </div>
  );
};
