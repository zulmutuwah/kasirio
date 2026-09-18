import React, { useEffect, useState } from 'react';
import { formatRupiah } from '../../utils/formatters';
import {
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Building2,
  Sliders,
  Radio,
  Lock,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  Plus,
  Phone,
  Mail,
} from 'lucide-react';

interface OfficeStaff {
  id: string;
  name: string;
  email: string;
  role: 'DEVELOPER' | 'SUPER_ADMIN';
  isMfaVerified: boolean;
  isBreakGlass?: boolean;
}

interface PendingPayment {
  id: string;
  tenantId: string;
  amount: number;
  paymentMethod: string;
  status: string;
  referenceNumber: string;
  proofImageUrl?: string | null;
  bankOrigin?: string | null;
  bankDestination?: string | null;
  createdAt: string;
  tenant?: {
    id: string;
    name: string;
    phone?: string;
  };
}

interface TenantItem {
  id: string;
  name: string;
  phone?: string;
  createdAt: string;
  subscriptions?: {
    id: string;
    status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'LIMITED';
    trialEndsAt?: string;
    activeEndsAt?: string;
    graceEndsAt?: string;
  }[];
  users?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  }[];
  outlets?: {
    id: string;
    name: string;
    isMainBranch: boolean;
  }[];
}

interface SystemConfigItem {
  id?: string;
  key: string;
  value: string;
  description?: string | null;
  updatedAt?: string;
}

interface ProviderItem {
  id: string;
  type: string;
  providerName: string;
  credentialsEncrypted: string;
  isActive: boolean;
  createdAt: string;
}

export const OfficePortalView: React.FC = () => {
  // Auth State
  const [token, setToken] = useState<string>(() => localStorage.getItem('kasirio_office_token') || '');
  const [staff, setStaff] = useState<OfficeStaff | null>(() => {
    const saved = localStorage.getItem('kasirio_office_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('superadmin@kasirio.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMfaCode, setLoginMfaCode] = useState('123456');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Break-Glass Form States
  const [isBreakGlassModalOpen, setIsBreakGlassModalOpen] = useState(false);
  const [breakGlassSecret, setBreakGlassSecret] = useState('kasirio-emergency-break-glass-fido2-key-2026');
  const [breakGlassEmail, setBreakGlassEmail] = useState('superadmin@kasirio.com');
  const [breakGlassJustification, setBreakGlassJustification] = useState('Investigasi insiden pembayaran tertunda untuk merchant darurat.');
  const [breakGlassTimer, setBreakGlassTimer] = useState<number | null>(null);

  // Active Subtab
  const [subTab, setSubTab] = useState<'payments' | 'tenants' | 'configs' | 'providers' | 'breakglass'>('payments');

  // Tab 1: Payments State
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [paymentActionLoading, setPaymentActionLoading] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<PendingPayment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Nomor mutasi transfer tidak valid.');

  // Tab 2: Tenants State
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [isTenantsLoading, setIsTenantsLoading] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [extendDaysInput, setExtendDaysInput] = useState('30');
  const [tenantActionLoading, setTenantActionLoading] = useState(false);

  // Tab 3: System Configs State
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [isConfigsLoading, setIsConfigsLoading] = useState(false);
  const [editingConfigKey, setEditingConfigKey] = useState<string | null>(null);
  const [editingConfigValue, setEditingConfigValue] = useState('');
  const [configSaveLoading, setConfigSaveLoading] = useState(false);

  // Tab 4: Providers State
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [isProvidersLoading, setIsProvidersLoading] = useState(false);
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
  const [newProviderType, setNewProviderType] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [newProviderName, setNewProviderName] = useState('Fonnte Gateway');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');

  // Global Notification
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Check login / fetch initial data on mount
  useEffect(() => {
    if (token) {
      loadPendingPayments();
      loadTenants();
      loadConfigs();
      loadProviders();
    }
  }, [token]);

  // Handle Login Staf Platform
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/office/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          mfaCode: loginMfaCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal login ke Platform Office.');
      }

      setToken(data.token);
      setStaff(data.user);
      localStorage.setItem('kasirio_office_token', data.token);
      localStorage.setItem('kasirio_office_user', JSON.stringify(data.user));
      showFeedback('success', `Selamat datang, ${data.user.name} (${data.user.role})!`);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Handle Break-Glass Emergency Login
  const handleBreakGlassLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/office/auth/break-glass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergencySecret: breakGlassSecret,
          staffEmail: breakGlassEmail,
          justification: breakGlassJustification,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Akses darurat Break-Glass ditolak.');
      }

      const emergencyUser: OfficeStaff = {
        id: 'emergency-staff',
        name: 'Break-Glass Emergency Staff',
        email: breakGlassEmail,
        role: 'SUPER_ADMIN',
        isMfaVerified: true,
        isBreakGlass: true,
      };

      setToken(data.token);
      setStaff(emergencyUser);
      setBreakGlassTimer(30); // 30 minutes
      localStorage.setItem('kasirio_office_token', data.token);
      localStorage.setItem('kasirio_office_user', JSON.stringify(emergencyUser));
      setIsBreakGlassModalOpen(false);
      showFeedback('success', 'Akses darurat Break-Glass 30 menit aktif! Seluruh aksi diaudit.');
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/office/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {
      // ignore
    }
    setToken('');
    setStaff(null);
    localStorage.removeItem('kasirio_office_token');
    localStorage.removeItem('kasirio_office_user');
  };

  // Load Pending Payments
  const loadPendingPayments = async () => {
    setIsPaymentsLoading(true);
    try {
      const res = await fetch('/api/office/payments/pending', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPayments(data.payments || []);
        setPendingCount(data.count || (data.payments ? data.payments.length : 0));
      }
    } catch (err) {
      console.warn('Gagal memuat pembayaran pending:', err);
    } finally {
      setIsPaymentsLoading(false);
    }
  };

  // Approve Payment
  const handleApprovePayment = async (paymentId: string) => {
    setPaymentActionLoading(paymentId);
    try {
      const res = await fetch(`/api/office/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memverifikasi pembayaran.');

      showFeedback('success', 'Pembayaran diverifikasi! Masa aktif tenant berhasil diperpanjang +30 hari.');
      loadPendingPayments();
      loadTenants();
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setPaymentActionLoading(null);
    }
  };

  // Reject Payment
  const handleRejectPayment = async () => {
    if (!rejectModalPayment) return;
    setPaymentActionLoading(rejectModalPayment.id);
    try {
      const res = await fetch(`/api/office/payments/${rejectModalPayment.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menolak pembayaran.');

      showFeedback('success', 'Pembayaran telah ditolak.');
      setRejectModalPayment(null);
      loadPendingPayments();
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setPaymentActionLoading(null);
    }
  };

  // Load Tenants
  const loadTenants = async () => {
    setIsTenantsLoading(true);
    try {
      const res = await fetch('/api/office/tenants', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.warn('Gagal memuat data tenants:', err);
    } finally {
      setIsTenantsLoading(false);
    }
  };

  // Handle Tenant Action (Extend / Activate / Suspend)
  const handleTenantAction = async (tenantId: string, action: 'ACTIVATE' | 'EXTEND' | 'SUSPEND') => {
    setTenantActionLoading(true);
    try {
      const res = await fetch(`/api/office/tenants/${tenantId}/action`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action,
          extendDays: Number(extendDaysInput) || 30,
          notes: `Tindakan ${action} manual oleh staf platform ${staff?.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menjalankan tindakan tenant.');

      showFeedback('success', `Tindakan '${action}' berhasil diterapkan ke tenant.`);
      loadTenants();
      setSelectedTenant(null);
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setTenantActionLoading(false);
    }
  };

  // Load System Configs
  const loadConfigs = async () => {
    setIsConfigsLoading(true);
    try {
      const res = await fetch('/api/office/configs', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } catch (err) {
      console.warn('Gagal memuat configs:', err);
    } finally {
      setIsConfigsLoading(false);
    }
  };

  // Save System Config
  const handleSaveConfig = async (key: string) => {
    setConfigSaveLoading(true);
    try {
      const res = await fetch(`/api/office/configs/${key}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: editingConfigValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui konfigurasi.');

      showFeedback('success', `Konfigurasi '${key}' berhasil diperbarui!`);
      setEditingConfigKey(null);
      loadConfigs();
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setConfigSaveLoading(false);
    }
  };

  // Load Providers
  const loadProviders = async () => {
    setIsProvidersLoading(true);
    try {
      const res = await fetch('/api/office/providers', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.warn('Gagal memuat providers:', err);
    } finally {
      setIsProvidersLoading(false);
    }
  };

  // Save New Provider
  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/office/providers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: newProviderType,
          providerName: newProviderName,
          credentials: { apiKey: newProviderApiKey },
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan provider.');

      showFeedback('success', `Provider ${newProviderName} berhasil ditambahkan.`);
      setIsAddProviderOpen(false);
      setNewProviderApiKey('');
      loadProviders();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Helper status color
  const getSubStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">ACTIVE</span>;
      case 'TRIAL':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">TRIAL</span>;
      case 'GRACE':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">GRACE</span>;
      case 'LIMITED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">LIMITED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">UNKNOWN</span>;
    }
  };

  // ============================================================================
  // RENDER: LOGIN FORM JIKA BELUM TEROTENTIKASI
  // ============================================================================
  if (!token || !staff) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg mb-3">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Kasirio Platform Office</h1>
            <p className="text-xs text-slate-400 mt-1">
              Portal internal staf platform (<span className="text-emerald-400 font-mono">office.kasirio.com</span>)
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Staf (@kasirio.com)</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="staf@kasirio.com"
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Kode MFA / TOTP <span className="text-slate-400 font-normal">(Dev: 123456)</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={loginMfaCode}
                onChange={(e) => setLoginMfaCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-white font-mono tracking-widest text-center focus:outline-hidden focus:border-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoginLoading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Masuk Portal Office</span>
            </button>
          </form>

          {/* Break Glass Link */}
          <div className="mt-6 pt-4 border-t border-slate-700 text-center">
            <button
              type="button"
              onClick={() => setIsBreakGlassModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Akses Darurat (Break-Glass SOP 30 Menit)</span>
            </button>
          </div>
        </div>

        {/* Modal Break-Glass */}
        {isBreakGlassModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Break-Glass Emergency Access</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Jalur darurat 30 menit tanpa sesi terbarukan. Seluruh aksi dicatat permanen di audit log dan alert dipancarkan ke seluruh platform engineer.
                  </p>
                </div>
              </div>

              <form onSubmit={handleBreakGlassLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emergency Secret Key</label>
                  <input
                    type="password"
                    required
                    value={breakGlassSecret}
                    onChange={(e) => setBreakGlassSecret(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-rose-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Staff Email</label>
                  <input
                    type="email"
                    required
                    value={breakGlassEmail}
                    onChange={(e) => setBreakGlassEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Justifikasi Tertulis <span className="text-rose-400 font-bold">*Wajib (min 10 karakter)</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    value={breakGlassJustification}
                    onChange={(e) => setBreakGlassJustification(e.target.value)}
                    placeholder="Sebutkan insiden, nomor tiket darurat, atau alasan operasional..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-hidden resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBreakGlassModalOpen(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isLoginLoading}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                    <span>Aktifkan Break-Glass</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: PLATFORM OFFICE MAIN DASHBOARD
  // ============================================================================
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Top Bar Office Portal */}
      <header className="bg-slate-950/80 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm tracking-tight text-white">Kasirio Platform Office</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                office.kasirio.com
              </span>
              {staff.isBreakGlass && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/30 text-rose-300 border border-rose-500/50 flex items-center gap-1 animate-pulse">
                  <ShieldAlert className="w-3 h-3" />
                  BREAK-GLASS ACTIVE ({breakGlassTimer ? `${breakGlassTimer}m` : '30m'})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Pusat kendali operasional platform multi-tenant, verifikasi koin, dan konfigurasi global.</p>
          </div>
        </div>

        {/* Staff Profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-white">{staff.name}</p>
            <p className="text-[10px] text-indigo-400 font-semibold">{staff.role} • MFA Verified</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Keluar dari Platform Office"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sub-Nav Bar */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-6 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setSubTab('payments')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'payments' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Verifikasi Pembayaran</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('tenants')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'tenants' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Manajemen Tenant</span>
          <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-slate-800 text-slate-400">
            {tenants.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('configs')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'configs' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Konfigurasi Sistem</span>
        </button>

        <button
          onClick={() => setSubTab('providers')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'providers' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Integrasi WA & Email</span>
        </button>

        <button
          onClick={() => setSubTab('breakglass')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto ${
            subTab === 'breakglass' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-rose-950/40'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Break-Glass SOP</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* SUBTAB 1: VERIFIKASI PEMBAYARAN KOIN */}
        {subTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  <span>Antrean Verifikasi Pembayaran Koin Kasirio</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Pembayaran transfer bank manual yang menunggu validasi staf Finance sebelum memperpanjang masa aktif merchant.
                </p>
              </div>

              <button
                onClick={loadPendingPayments}
                disabled={isPaymentsLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPaymentsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Antrean</span>
              </button>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="p-12 bg-slate-800/40 border border-slate-800 rounded-3xl text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
                <h3 className="font-bold text-sm text-white">Semua Pembayaran Beres!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Tidak ada antrean pembayaran yang berstatus <span className="font-mono text-indigo-300">PENDING_VERIFICATION</span> saat ini.
                </p>
              </div>
            ) : (
              <div className="bg-slate-800/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">No. Referensi / Tanggal</th>
                      <th className="px-4 py-3">Merchant / Tenant</th>
                      <th className="px-4 py-3">Metode / Bank</th>
                      <th className="px-4 py-3">Nominal Transfer</th>
                      <th className="px-4 py-3">Bukti Transfer</th>
                      <th className="px-4 py-3 text-right">Aksi Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-200">
                    {pendingPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-mono">
                          <p className="font-bold text-indigo-400">{p.referenceNumber}</p>
                          <p className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleString('id-ID')}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">{p.tenant?.name || p.tenantId}</p>
                          {p.tenant?.phone && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{p.tenant.phone}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-700 text-slate-300">
                            {p.paymentMethod}
                          </span>
                          {p.bankDestination && <p className="text-[10px] text-slate-400 mt-0.5">Ke: {p.bankDestination}</p>}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400 text-sm">
                          {formatRupiah(p.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {p.proofImageUrl ? (
                            <a
                              href={p.proofImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline font-medium text-[11px]"
                            >
                              <span>Lihat Bukti</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Transfer Mutasi Bank</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleApprovePayment(p.id)}
                            disabled={paymentActionLoading === p.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                          >
                            {paymentActionLoading === p.id ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : 'Setujui'}
                          </button>
                          <button
                            onClick={() => setRejectModalPayment(p)}
                            disabled={paymentActionLoading === p.id}
                            className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            Tolak
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: MANAJEMEN TENANT */}
        {subTab === 'tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <span>Direktori Tenant UMKM Terdaftar</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Pemantauan seluruh entitas merchant, cabang toko, dan siklus langganan Kasirio Cloud.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  placeholder="Cari nama toko / tenant..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Nama Toko & ID</th>
                    <th className="px-4 py-3">Pemilik (Owner)</th>
                    <th className="px-4 py-3">Cabang Outlet</th>
                    <th className="px-4 py-3">Status Masa Aktif</th>
                    <th className="px-4 py-3">Batas Berakhir</th>
                    <th className="px-4 py-3 text-right">Aksi Intervensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-slate-200">
                  {tenants
                    .filter((t) => t.name.toLowerCase().includes(tenantSearchQuery.toLowerCase()))
                    .map((t) => {
                      const latestSub = t.subscriptions?.[0];
                      const owner = t.users?.[0];
                      const expiryDate = latestSub?.activeEndsAt || latestSub?.trialEndsAt;

                      return (
                        <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-extrabold text-white text-sm">{t.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{t.id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-200">{owner?.name || '-'}</p>
                            <p className="text-[10px] text-slate-400">{owner?.email || owner?.phone || '-'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-700 text-indigo-300">
                              {t.outlets ? `${t.outlets.length} Cabang` : '1 Cabang'}
                            </span>
                          </td>
                          <td className="px-4 py-3">{getSubStatusBadge(latestSub?.status)}</td>
                          <td className="px-4 py-3 text-[11px] text-slate-300 font-mono">
                            {expiryDate ? new Date(expiryDate).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedTenant(t)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all text-xs cursor-pointer"
                            >
                              Detail & Aksi
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 3: KONFIGURASI SISTEM */}
        {subTab === 'configs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <span>Konfigurasi Dinamis Platform Kasirio</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Parameter operasional global platform yang tercatat di audit log staf platform setiap kali diubah.
                </p>
              </div>

              <button
                onClick={loadConfigs}
                disabled={isConfigsLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConfigsLoading ? 'animate-spin' : ''}`} />
                <span>Reload</span>
              </button>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg divide-y divide-slate-700/60">
              {configs.map((c) => (
                <div key={c.key} className="p-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
                  <div className="space-y-1 max-w-lg">
                    <p className="font-mono font-bold text-indigo-400 text-xs">{c.key}</p>
                    <p className="text-xs text-slate-300">{c.description || 'Tidak ada deskripsi'}</p>
                    {c.updatedAt && (
                      <p className="text-[10px] text-slate-500">Terakhir diubah: {new Date(c.updatedAt).toLocaleString('id-ID')}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {editingConfigKey === c.key ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingConfigValue}
                          onChange={(e) => setEditingConfigValue(e.target.value)}
                          className="bg-slate-900 border border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-hidden"
                        />
                        <button
                          onClick={() => handleSaveConfig(c.key)}
                          disabled={configSaveLoading}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingConfigKey(null)}
                          className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-white bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                          {c.value}
                        </span>
                        <button
                          onClick={() => {
                            setEditingConfigKey(c.key);
                            setEditingConfigValue(c.value);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 4: INTEGRASI PROVIDER */}
        {subTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-indigo-400" />
                  <span>Integrasi Provider Notifikasi (WhatsApp & Email)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Gateway pengiriman struk nota dan tagihan kasbon otomatis berbasis kredensial berenkripsi AES-256.
                </p>
              </div>

              <button
                onClick={() => setIsAddProviderOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Provider</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((p) => (
                <div key={p.id} className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                        {p.type === 'WHATSAPP' ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{p.providerName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">{p.type}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {p.isActive ? 'AKTIF' : 'NON-AKTIF'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400">
                    Kredensial: <span className="text-indigo-300">{p.credentialsEncrypted}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 5: BREAK-GLASS SOP */}
        {subTab === 'breakglass' && (
          <div className="space-y-4 max-w-3xl">
            <div className="p-5 bg-rose-950/40 border border-rose-500/40 rounded-3xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">SOP Mode Darurat Platform (Break-Glass Protocol)</h3>
                  <p className="text-xs text-rose-300">
                    Mekanisme darurat 30 menit yang dirancang untuk mengatasi insiden kritis saat auth normal/MFA terblokir.
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-2 border-t border-rose-500/20 pt-3 leading-relaxed">
                <p>
                  1. <strong>Batas Sesi Keras 30 Menit:</strong> Token darurat tidak dapat diperpanjang secara otomatis demi kepatuhan ISO 27001 dan SOC 2.
                </p>
                <p>
                  2. <strong>Justifikasi Wajib & Permanen:</strong> Setiap pembukaan Break-Glass mewajibkan penjelasan tertulis minimal 10 karakter yang diabadikan ke dalam tabel audit forensik.
                </p>
                <p>
                  3. <strong>Broadcast Alert Instan:</strong> Notifikasi alert prioritas tinggi otomatis dikirim ke seluruh tim pengembang dan Super Admin.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsBreakGlassModalOpen(true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 cursor-pointer flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Buka Form Aktivasi Break-Glass Darurat</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL TOLAK PEMBAYARAN */}
      {rejectModalPayment && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Tolak Pembayaran Transfer</h3>
                <p className="text-xs text-slate-400">Ref: {rejectModalPayment.referenceNumber}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Alasan Penolakan</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Misal: Bukti transfer buram, mutasi bank belum masuk..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRejectModalPayment(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleRejectPayment}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl text-xs cursor-pointer"
              >
                Tolak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERVENSI TENANT */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white">{selectedTenant.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedTenant.id}</p>
              </div>
              {getSubStatusBadge(selectedTenant.subscriptions?.[0]?.status)}
            </div>

            <div className="p-3 bg-slate-800 rounded-2xl space-y-2 text-xs">
              <p className="text-slate-400">
                Masa Aktif Berakhir:{' '}
                <span className="text-white font-bold font-mono">
                  {selectedTenant.subscriptions?.[0]?.activeEndsAt
                    ? new Date(selectedTenant.subscriptions[0].activeEndsAt).toLocaleDateString('id-ID')
                    : '-'}
                </span>
              </p>
              <p className="text-slate-400">
                Jumlah Cabang:{' '}
                <span className="text-white font-bold">{selectedTenant.outlets?.length || 1} Outlet</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Durasi Perpanjangan (Hari)</label>
              <input
                type="number"
                value={extendDaysInput}
                onChange={(e) => setExtendDaysInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedTenant(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => handleTenantAction(selectedTenant.id, 'EXTEND')}
                disabled={tenantActionLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                {tenantActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Perpanjang {extendDaysInput} Hari</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PROVIDER INTEGRASI */}
      {isAddProviderOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-white">Tambah Gateway Provider</h3>

            <form onSubmit={handleCreateProvider} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tipe Integrasi</label>
                <select
                  value={newProviderType}
                  onChange={(e) => setNewProviderType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="WHATSAPP">WhatsApp Official / Gateway</option>
                  <option value="EMAIL">Email Gateway (SMTP / Resend)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nama Provider</label>
                <input
                  type="text"
                  required
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="Misal: Fonnte WhatsApp, Twilio, SendGrid"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">API Token / Secret Key (Akan Dienkripsi AES-256)</label>
                <input
                  type="password"
                  required
                  value={newProviderApiKey}
                  onChange={(e) => setNewProviderApiKey(e.target.value)}
                  placeholder="Secret key provider..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddProviderOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  Simpan Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
