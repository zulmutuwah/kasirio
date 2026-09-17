import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Customer } from '../../types';
import { formatRupiah, formatDateShort } from '../../utils/formatters';
import { AddCustomerModal } from './AddCustomerModal';
import { PayDebtModal } from './PayDebtModal';
import {
  Users,
  UserPlus,
  Search,
  CreditCard,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare
} from 'lucide-react';

interface CustomersViewProps {
  isAddExternalOpen?: boolean;
  onCloseAddExternal?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  isAddExternalOpen,
  onCloseAddExternal,
}) => {
  const { customers, transactions, setSelectedCustomer, setActiveTab, settings, showToast } = usePOS();
  const [sendingDebtId, setSendingDebtId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDebtOnly, setShowDebtOnly] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomerForDebt, setSelectedCustomerForDebt] = useState<Customer | null>(null);

  const isAddOpen = isAddModalOpen || !!isAddExternalOpen;
  const handleCloseAdd = () => {
    setIsAddModalOpen(false);
    if (onCloseAddExternal) onCloseAddExternal();
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    const matchesDebt = !showDebtOnly || c.totalDebt > 0;
    return matchesSearch && matchesDebt;
  });

  const totalAllDebt = customers.reduce((acc, c) => acc + c.totalDebt, 0);

  const handleSendDebtReminder = async (customer: Customer) => {
    if (!customer.phone) {
      showToast(`Pelanggan ${customer.name} belum memiliki nomor telepon.`, 'error');
      return;
    }

    setSendingDebtId(customer.id);
    const baseUrl = settings.apiBaseUrl || 'http://localhost:3001';
    try {
      const res = await fetch(`${baseUrl}/api/notifications/whatsapp/debt-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customer.phone,
          customerName: customer.name,
          storeName: settings.storeName,
          totalDebt: customer.totalDebt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim pengingat');

      showToast(`Pengingat kasbon berhasil dikirim ke WhatsApp ${customer.name}!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSendingDebtId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-400" />
            Manajemen Pelanggan & Piutang / Kasbon
          </h2>
          <p className="text-xs text-slate-400">
            Kelola data pembeli setia dan rekap tagihan kasbon toko Anda
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pelanggan</span>
        </button>
      </div>

      {/* Debt Summary Banner */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Total Piutang Belum Lunas (Kasbon Pelanggan)</span>
          </div>
          <p className="text-2xl font-extrabold text-amber-400 font-mono">
            {formatRupiah(totalAllDebt)}
          </p>
        </div>

        <button
          onClick={() => setShowDebtOnly(!showDebtOnly)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            showDebtOnly
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {showDebtOnly ? 'Tampilkan Semua Pelanggan' : 'Filter Yang Memiliki Kasbon'}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pelanggan atau nomor HP..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* Customers Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-slate-300 text-sm">Pelanggan Tidak Ditemukan</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const hasDebt = customer.totalDebt > 0;
            const customerTrxCount = transactions.filter(
              (t) => t.customer?.id === customer.id
            ).length;

            return (
              <div
                key={customer.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-100 text-base">
                      {customer.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        hasDebt
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {hasDebt ? 'Ada Kasbon' : 'Lunas'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <p className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{customer.phone}</span>
                    </p>
                    {customer.address && (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{customer.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Debt Details & Action */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500">Sisa Kasbon</p>
                    <p
                      className={`font-bold font-mono text-sm ${
                        hasDebt ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {formatRupiah(customer.totalDebt)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {hasDebt ? (
                      <>
                        <button
                          onClick={() => handleSendDebtReminder(customer)}
                          disabled={sendingDebtId === customer.id}
                          className="px-2.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          title="Kirim Pesan Pengingat Tagihan via WhatsApp API"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="hidden sm:inline">
                            {sendingDebtId === customer.id ? 'Mengirim...' : 'Ingatkan WA'}
                          </span>
                        </button>

                        <button
                          onClick={() => setSelectedCustomerForDebt(customer)}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow"
                        >
                          Bayar Kasbon
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setActiveTab('kasir');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold rounded-xl"
                      >
                        Buat Nota
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddCustomerModal isOpen={isAddOpen} onClose={handleCloseAdd} />

      <PayDebtModal
        customer={selectedCustomerForDebt}
        onClose={() => setSelectedCustomerForDebt(null)}
      />
    </div>
  );
};
