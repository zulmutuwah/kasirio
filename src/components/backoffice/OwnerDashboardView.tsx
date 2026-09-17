import React, { useEffect, useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah } from '../../utils/formatters';
import {
  Building2,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  ArrowRightLeft,
  Plus,
  RefreshCw,
  Store,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Key,
  Shield,
  Trash2,
  Edit3,
  Sliders,
  Check,
  X,
} from 'lucide-react';

interface BackofficeSummary {
  totalOmzet: number;
  grossProfit: number;
  profitMargin: number;
  totalTransactions: number;
  averageTicket: number;
  outletBreakdown: { outletName: string; omzet: number; count: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

interface OutletItem {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isMainBranch: boolean;
  _count?: { products: number; users: number; transactions: number };
}

export interface StaffUser {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'CASHIER' | string;
  email?: string;
  phone?: string;
  outletId?: string;
  outletName: string;
  createdAt: string;
  permissions: string[];
  overrideCount: number;
}

export const OwnerDashboardView: React.FC = () => {
  const { settings, updateSettings, showToast } = usePOS();

  const [activeSubTab, setActiveSubTab] = useState<'ringkasan' | 'cabang' | 'transfer' | 'staf'>('ringkasan');
  const [summary, setSummary] = useState<BackofficeSummary | null>(null);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Staff & RBAC state
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [staffNameInput, setStaffNameInput] = useState('');
  const [staffRoleInput, setStaffRoleInput] = useState<'ADMIN' | 'CASHIER'>('CASHIER');
  const [staffOutletInput, setStaffOutletInput] = useState<string>('');
  const [staffPinInput, setStaffPinInput] = useState('123456');
  const [staffPhoneInput, setStaffPhoneInput] = useState('');
  const [staffEmailInput, setStaffEmailInput] = useState('');

  // Permissions Override Modal state
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [selectedStaffForPerm, setSelectedStaffForPerm] = useState<StaffUser | null>(null);
  const [userOverrides, setUserOverrides] = useState<Array<{ permission: string; type: string }>>([]);
  const [allPermissionsList, setAllPermissionsList] = useState<string[]>([]);
  const [defaultPermsList, setDefaultPermsList] = useState<string[]>([]);
  const [resolvedPermsList, setResolvedPermsList] = useState<string[]>([]);

  // Cloud Auth state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [ownerNameInput, setOwnerNameInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Transfer stock state
  const [transferSource, setTransferSource] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // New Outlet form
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletAddress, setNewOutletAddress] = useState('');
  const [newOutletPhone, setNewOutletPhone] = useState('');
  const [isAddingOutlet, setIsAddingOutlet] = useState(false);

  const baseUrl = settings.apiBaseUrl || 'http://localhost:3001';
  const isConnected = Boolean(settings.cloudSyncEnabled && settings.authToken);

  const fetchDashboardData = async () => {
    if (!isConnected || !settings.authToken) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const queryParam = selectedOutletFilter ? `?outletId=${selectedOutletFilter}` : '';
      const [sumRes, outRes] = await Promise.all([
        fetch(`${baseUrl}/api/backoffice/summary${queryParam}`, {
          headers: { Authorization: `Bearer ${settings.authToken}` },
        }),
        fetch(`${baseUrl}/api/backoffice/outlets`, {
          headers: { Authorization: `Bearer ${settings.authToken}` },
        }),
      ]);

      if (sumRes.ok && outRes.ok) {
        const sumData = await sumRes.json();
        const outData = await outRes.json();
        setSummary(sumData.data);
        setOutlets(outData.outlets || []);
      } else if (sumRes.status === 401 || sumRes.status === 403) {
        setErrorMsg('Sesi login telah berakhir. Silakan login kembali.');
        await updateSettings({ authToken: undefined, cloudSyncEnabled: false });
      } else {
        setErrorMsg('Gagal memuat data dari server backend.');
      }
    } catch (err: any) {
      setErrorMsg('Tidak dapat menghubungi server backend: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchDashboardData();
    }
  }, [isConnected, selectedOutletFilter]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setErrorMsg(null);

    try {
      if (isRegisterMode) {
        const res = await fetch(`${baseUrl}/api/auth/register-tenant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantName: settings.storeName || 'Toko Kasirio',
            ownerName: ownerNameInput,
            email: emailInput,
            password: passwordInput,
            pin: '123456',
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan toko baru');

        await updateSettings({
          cloudSyncEnabled: true,
          authToken: data.token,
          tenantId: data.tenant.id,
          tenantName: data.tenant.name,
          outletId: data.outlet.id,
          outletName: data.outlet.name,
        });

        showToast('Registrasi Cloud berhasil! Toko terhubung.');
      } else {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailInput,
            password: passwordInput,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Email atau kata sandi salah');

        await updateSettings({
          cloudSyncEnabled: true,
          authToken: data.token,
          tenantId: data.tenant.id,
          tenantName: data.tenant.name,
          outletId: data.outlet?.id,
          outletName: data.outlet?.name,
        });

        showToast('Login berhasil! Terhubung ke Kasirio Cloud.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSource || !transferTarget || !transferProductId || transferQty <= 0) {
      showToast('Mohon lengkapi formulir transfer stok.', 'error');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch(`${baseUrl}/api/backoffice/stock-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.authToken}`,
        },
        body: JSON.stringify({
          sourceOutletId: transferSource,
          targetOutletId: transferTarget,
          productId: transferProductId,
          quantity: transferQty,
          notes: transferNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal melakukan transfer stok');

      showToast(data.message || 'Transfer stok berhasil.');
      setTransferQty(1);
      setTransferNotes('');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName) return;

    setIsAddingOutlet(true);
    try {
      const res = await fetch(`${baseUrl}/api/backoffice/outlets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.authToken}`,
        },
        body: JSON.stringify({
          name: newOutletName,
          address: newOutletAddress,
          phone: newOutletPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah cabang');

      showToast(`Cabang ${newOutletName} berhasil ditambahkan!`);
      setNewOutletName('');
      setNewOutletAddress('');
      setNewOutletPhone('');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsAddingOutlet(false);
    }
  };

  const fetchStaffList = async () => {
    if (!isConnected || !settings.authToken) return;
    setIsLoadingStaff(true);
    try {
      const res = await fetch(`${baseUrl}/api/users`, {
        headers: { Authorization: `Bearer ${settings.authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.users || []);
      }
    } catch (err: any) {
      console.error('Fetch staff error:', err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setStaffNameInput('');
    setStaffRoleInput('CASHIER');
    setStaffOutletInput('');
    setStaffPinInput('123456');
    setStaffPhoneInput('');
    setStaffEmailInput('');
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (staff: StaffUser) => {
    setEditingStaff(staff);
    setStaffNameInput(staff.name);
    setStaffRoleInput(staff.role === 'ADMIN' ? 'ADMIN' : 'CASHIER');
    setStaffOutletInput(staff.outletId || '');
    setStaffPinInput('');
    setStaffPhoneInput(staff.phone || '');
    setStaffEmailInput(staff.email || '');
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNameInput) {
      showToast('Nama karyawan wajib diisi.', 'error');
      return;
    }

    try {
      const url = editingStaff ? `${baseUrl}/api/users/${editingStaff.id}` : `${baseUrl}/api/users`;
      const method = editingStaff ? 'PUT' : 'POST';

      const payload: any = {
        name: staffNameInput,
        role: staffRoleInput,
        outletId: staffOutletInput || null,
        phone: staffPhoneInput,
        email: staffEmailInput,
      };
      if (staffPinInput) {
        payload.pin = staffPinInput;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data karyawan');

      showToast(data.message || 'Data karyawan berhasil disimpan!');
      setIsStaffModalOpen(false);
      fetchStaffList();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteStaff = async (staff: StaffUser) => {
    if (staff.role === 'OWNER') {
      showToast('Akun Pemilik Toko (Owner) tidak dapat dihapus.', 'error');
      return;
    }

    if (!confirm(`Yakin ingin menghapus akun karyawan '${staff.name}'?`)) return;

    try {
      const res = await fetch(`${baseUrl}/api/users/${staff.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${settings.authToken}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus karyawan');

      showToast(data.message || 'Karyawan berhasil dihapus.');
      fetchStaffList();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenPermissions = async (staff: StaffUser) => {
    setSelectedStaffForPerm(staff);
    try {
      const res = await fetch(`${baseUrl}/api/users/${staff.id}/permissions`, {
        headers: { Authorization: `Bearer ${settings.authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllPermissionsList(data.allPermissionsCatalog || []);
        setDefaultPermsList(data.defaultPermissions || []);
        setUserOverrides(data.overrides || []);
        setResolvedPermsList(data.resolvedPermissions || []);
        setIsPermissionModalOpen(true);
      } else {
        showToast('Gagal memuat izin pengguna', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleOverride = async (permission: string, currentStatus: 'DEFAULT' | 'GRANT' | 'REVOKE') => {
    if (!selectedStaffForPerm) return;

    const isDefaultActive = defaultPermsList.includes(permission);
    let nextType: 'GRANT' | 'REVOKE' | 'RESET' = 'RESET';

    if (currentStatus === 'DEFAULT') {
      nextType = isDefaultActive ? 'REVOKE' : 'GRANT';
    } else {
      nextType = 'RESET';
    }

    try {
      const res = await fetch(`${baseUrl}/api/users/${selectedStaffForPerm.id}/permissions/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.authToken}`,
        },
        body: JSON.stringify({ permission, type: nextType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah hak akses');

      setUserOverrides(data.overrides || []);
      setResolvedPermsList(data.resolvedPermissions || []);
      showToast(`Izin '${permission}' diperbarui.`);
      fetchStaffList();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Tampilan Login / Register jika belum terkoneksi ke Cloud
  if (!isConnected) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-center text-slate-900 mb-1">
            Kasirio Remote Backoffice
          </h2>
          <p className="text-sm text-center text-slate-500 mb-6">
            Pantau omzet toko dari mana saja & kelola multi-cabang terpusat.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pemilik (Owner)</label>
                <input
                  type="text"
                  required
                  value={ownerNameInput}
                  onChange={(e) => setOwnerNameInput(e.target.value)}
                  placeholder="Budi Santoso"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Akun Owner</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="owner@toko.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi (Password)</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {isRegisterMode ? 'Daftarkan Toko ke Cloud' : 'Masuk ke Backoffice'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMsg(null);
              }}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              {isRegisterMode
                ? 'Sudah punya akun? Masuk di sini'
                : 'Belum terhubung ke Cloud? Daftarkan Toko Baru'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Dashboard Utama jika sudah terhubung ke Cloud
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Owner Portal
            </span>
            <h1 className="text-xl font-black text-slate-900">
              {settings.tenantName || settings.storeName} — Remote Backoffice
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring omzet real-time multi-cabang & integrasi Cloud PostgreSQL
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Branch Switcher Dropdown */}
          <select
            value={selectedOutletFilter}
            onChange={(e) => setSelectedOutletFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Cabang Toko</option>
            {outlets.map((out) => (
              <option key={out.id} value={out.id}>
                {out.name} {out.isMainBranch ? '(Pusat)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-6">
        <button
          onClick={() => setActiveSubTab('ringkasan')}
          className={`py-3 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'ringkasan'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Ringkasan Konsolidasian
        </button>
        <button
          onClick={() => setActiveSubTab('cabang')}
          className={`py-3 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'cabang'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Daftar Cabang ({outlets.length})
        </button>
        <button
          onClick={() => setActiveSubTab('transfer')}
          className={`py-3 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'transfer'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Transfer Stok Cabang
        </button>
        <button
          onClick={() => {
            setActiveSubTab('staf');
            fetchStaffList();
          }}
          className={`py-3 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'staf'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Manajemen Staf & Hak Akses ({staffList.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchDashboardData} className="font-bold underline ml-2">Coba lagi</button>
          </div>
        )}

        {activeSubTab === 'ringkasan' && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Total Omzet Konsolidasi</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {formatRupiah(summary?.totalOmzet || 0)}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                    Dari {summary?.totalTransactions || 0} transaksi
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Laba Kotor (Gross Profit)</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {formatRupiah(summary?.grossProfit || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Margin: {summary?.profitMargin || 0}%
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Rata-rata Keranjang</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {formatRupiah(summary?.averageTicket || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Per struk pembeli</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Total Cabang Aktif</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {outlets.length} Outlet
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">Tersinkron Cloud</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Performance per Cabang & Produk Terlaris */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Outlet Performance */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Performa Penjualan per Cabang</span>
                </h3>
                {summary?.outletBreakdown && summary.outletBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {summary.outletBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.outletName}</div>
                          <div className="text-[11px] text-slate-500">{item.count} transaksi</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-900">{formatRupiah(item.omzet)}</div>
                          <div className="text-[10px] text-emerald-600 font-semibold">Tercatat di Cloud</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Belum ada transaksi di cloud untuk periode ini. Lakukan penjualan di kasir untuk melihat sinkronisasi.
                  </div>
                )}
              </div>

              {/* Top Selling Products */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>5 Produk Terlaris Lintas Cabang</span>
                </h3>
                {summary?.topProducts && summary.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {summary.topProducts.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-500">Terjual {p.qty} unit</div>
                          </div>
                        </div>
                        <div className="text-right text-xs font-black text-slate-900">
                          {formatRupiah(p.revenue)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Belum ada data penjualan produk.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab Manajemen Cabang */}
        {activeSubTab === 'cabang' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Daftar Cabang Toko</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {outlets.map((out) => (
                  <div
                    key={out.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden"
                  >
                    {out.isMainBranch && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        Pusat
                      </span>
                    )}
                    <h4 className="text-sm font-black text-slate-900">{out.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{out.address || 'Alamat belum disetel'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{out.phone || 'Telepon: -'}</p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                      <span>{out._count?.transactions || 0} Transaksi</span>
                      <span>{out._count?.users || 1} Kasir</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Tambah Cabang */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs h-fit">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Buka Cabang Toko Baru</span>
              </h3>
              <form onSubmit={handleAddOutlet} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Cabang</label>
                  <input
                    type="text"
                    required
                    value={newOutletName}
                    onChange={(e) => setNewOutletName(e.target.value)}
                    placeholder="Kasirio Cabang Sudirman"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Cabang</label>
                  <input
                    type="text"
                    value={newOutletAddress}
                    onChange={(e) => setNewOutletAddress(e.target.value)}
                    placeholder="Jl. Sudirman No. 45"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. Telepon</label>
                  <input
                    type="text"
                    value={newOutletPhone}
                    onChange={(e) => setNewOutletPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingOutlet}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                >
                  {isAddingOutlet ? 'Menyimpan...' : 'Tambah Cabang'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab Transfer Stok Antar Cabang */}
        {activeSubTab === 'transfer' && (
          <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
              <span>Transfer Stok Antar-Cabang</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pindahkan stok barang dari gudang pusat ke cabang toko atau antar-outlet.
            </p>

            <form onSubmit={handleStockTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cabang Asal (Keluar)</label>
                  <select
                    required
                    value={transferSource}
                    onChange={(e) => setTransferSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Pilih Asal</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cabang Tujuan (Masuk)</label>
                  <select
                    required
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Pilih Tujuan</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Produk</label>
                <input
                  type="text"
                  required
                  placeholder="ID Produk atau Nama Produk"
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Unit yang Ditransfer</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Surat Jalan / Transfer</label>
                <input
                  type="text"
                  placeholder="Restock mingguan cabang baru"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isTransferring}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isTransferring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
                <span>Kirim Transfer Stok</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: MANAJEMEN STAF & HAK AKSES */}
        {activeSubTab === 'staf' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  Manajemen Pengguna & Otorisasi RBAC
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola staf toko (Owner, Admin Cabang, Kasir) dan atur permission overrides per karyawan.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddStaff}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Karyawan</span>
              </button>
            </div>

            {/* Architecture Scope Notice */}
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Hierarki Hak Akses Multi-Tenant Kasirio:</span>
                <p className="text-indigo-800/90 leading-relaxed">
                  • <strong>Pemilik Toko (Owner):</strong> Memiliki hak akses penuh ke seluruh cabang dan tidak dapat dihapus.<br />
                  • <strong>Admin Toko:</strong> Mengelola produk, stok, dan laporan dengan cakupan cabang tertentu atau seluruh cabang.<br />
                  • <strong>Kasir:</strong> Berfokus pada transaksi penjualan, buka/tutup shift, dan cetak struk di cabang yang ditugaskan.<br />
                  • <strong>Permission Overrides:</strong> Owner dapat memberikan izin tambahan (Grant) atau mencabut izin bawaan (Revoke) untuk setiap pengguna.
                </p>
              </div>
            </div>

            {/* Staff List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Daftar Karyawan Aktif ({staffList.length})</span>
                <button
                  type="button"
                  onClick={fetchStaffList}
                  className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStaff ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {staffList.map((st) => {
                  const isOwner = st.role === 'OWNER';
                  const isAdmin = st.role === 'ADMIN';

                  return (
                    <div key={st.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isOwner ? 'bg-emerald-100 text-emerald-700' : isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {st.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{st.name}</h4>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isOwner
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isAdmin
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : 'bg-sky-100 text-sky-800 border border-sky-300'
                            }`}>
                              {isOwner ? '👑 Pemilik (Owner)' : isAdmin ? '🛡️ Admin Toko' : '💳 Kasir'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Store className="w-3.5 h-3.5 text-slate-400" />
                              {st.outletName}
                            </span>
                            {st.phone && <span>• {st.phone}</span>}
                            {st.email && <span>• {st.email}</span>}
                            <span className="font-mono text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {st.permissions.length} Izin Aktif {st.overrideCount > 0 ? `(${st.overrideCount} Override)` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenPermissions(st)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Kelola hak akses spesifik"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Hak Akses</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditStaff(st)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Edit karyawan"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(st)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                            title="Hapus akun karyawan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Staf */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200">
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              <span>{editingStaff ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Tentukan peran, cabang penugasan, dan PIN otorisasi transaksi kasir.
            </p>

            <form onSubmit={handleSaveStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Siti Rahma"
                  value={staffNameInput}
                  onChange={(e) => setStaffNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Peran (Role) *</label>
                <select
                  value={staffRoleInput}
                  disabled={editingStaff?.role === 'OWNER'}
                  onChange={(e) => setStaffRoleInput(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="CASHIER">Kasir (Transaksi Penjualan & Laci)</option>
                  <option value="ADMIN">Admin Toko (Katalog, Stok, & Laporan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penugasan Cabang Toko</label>
                <select
                  value={staffOutletInput}
                  onChange={(e) => setStaffOutletInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Seluruh Cabang (Pusat)</option>
                  {outlets.map((out) => (
                    <option key={out.id} value={out.id}>
                      {out.name} {out.isMainBranch ? '(Pusat)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PIN Otorisasi Kasir (4-6 digit) {editingStaff ? '(Kosongkan jika tidak diubah)' : '*'}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder={editingStaff ? '••••••' : '123456'}
                  value={staffPinInput}
                  onChange={(e) => setStaffPinInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={staffPhoneInput}
                    onChange={(e) => setStaffPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="kasir@toko.com"
                    value={staffEmailInput}
                    onChange={(e) => setStaffEmailInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Simpan Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Hak Akses (Permission Overrides Matrix) */}
      {isPermissionModalOpen && selectedStaffForPerm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative border border-slate-200 max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setIsPermissionModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>Kustomisasi Hak Akses: {selectedStaffForPerm.name}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Peran: <strong>{selectedStaffForPerm.role}</strong> • Cabang: <strong>{selectedStaffForPerm.outletName}</strong>
              </p>
              <p className="text-[11px] text-indigo-600 mt-1 bg-indigo-50 p-2 rounded-lg">
                Rumus Resolusi: <em>(Izin Default Role) + (Grant Khusus) − (Revoke Dicabut)</em>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {allPermissionsList.map((perm) => {
                const isDefault = defaultPermsList.includes(perm);
                const override = userOverrides.find((o) => o.permission === perm);
                const isGranted = override?.type === 'GRANT';
                const isRevoked = override?.type === 'REVOKE';
                const isEffective = resolvedPermsList.includes(perm);

                let statusText = 'Bawaan Nonaktif';
                let statusBadge = 'bg-slate-100 text-slate-500';

                if (isGranted) {
                  statusText = 'Diberikan (GRANT)';
                  statusBadge = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300';
                } else if (isRevoked) {
                  statusText = 'Dicabut (REVOKE)';
                  statusBadge = 'bg-rose-100 text-rose-800 font-bold border border-rose-300';
                } else if (isDefault) {
                  statusText = 'Bawaan Aktif';
                  statusBadge = 'bg-sky-100 text-sky-800';
                }

                return (
                  <div key={perm} className="pt-2 pb-2 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-800 block">{perm}</span>
                      <span className="text-[11px] text-slate-400">
                        {perm.startsWith('product.') ? 'Manajemen Katalog Barang' :
                         perm.startsWith('stock.') ? 'Penyesuaian & Transfer Stok' :
                         perm.startsWith('transaction.') ? 'Alur Transaksi & Void' :
                         perm.startsWith('payment.') ? 'Proses & Refund Pembayaran' :
                         perm.startsWith('cashSession.') ? 'Laci Kasir & Buka Tutup Shift' :
                         perm.startsWith('report.') ? 'Laporan Keuangan Toko' : 'Administrasi Pengguna'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge}`}>
                        {statusText}
                      </span>

                      {selectedStaffForPerm.role !== 'OWNER' && (
                        <button
                          type="button"
                          onClick={() => handleToggleOverride(perm, isGranted ? 'GRANT' : isRevoked ? 'REVOKE' : 'DEFAULT')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          {override ? 'Reset Default' : isDefault ? 'Cabut (Revoke)' : 'Beri Izin (Grant)'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPermissionModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
