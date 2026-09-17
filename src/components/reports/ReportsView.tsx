import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatDateIndo, formatRupiah } from '../../utils/formatters';
import { PinAuthModal } from '../common/PinAuthModal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Search,
  Download,
  XCircle,
  Eye,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    transactions,
    voidTransaction,
    setActiveReceiptTransaction,
    products,
    auditLogs,
  } = usePOS();

  const [activeReportTab, setActiveReportTab] = useState<'SALES' | 'AUDIT'>('SALES');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LUNAS' | 'KASBON' | 'BATAL'>('ALL');

  // PIN Gate Void State
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [selectedTrxToVoid, setSelectedTrxToVoid] = useState<string | null>(null);

  // Filter Transactions by Date Range
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredTransactionsByDate = transactions.filter((t) => {
    const tTime = new Date(t.date).getTime();
    if (dateFilter === 'TODAY') return tTime >= startOfToday;
    if (dateFilter === 'YESTERDAY') return tTime >= startOfYesterday && tTime < startOfToday;
    if (dateFilter === 'WEEK') return tTime >= startOfWeek;
    if (dateFilter === 'MONTH') return tTime >= startOfMonth;
    return true;
  });

  const filteredTransactions = filteredTransactionsByDate.filter((t) => {
    const matchSearch =
      t.id.toLowerCase().includes(searchInvoice.toLowerCase()) ||
      (t.customer?.name && t.customer.name.toLowerCase().includes(searchInvoice.toLowerCase())) ||
      t.cashierName.toLowerCase().includes(searchInvoice.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate Metrics (Exclude BATAL)
  const validTransactions = filteredTransactionsByDate.filter((t) => t.status !== 'BATAL');
  const totalOmset = validTransactions.reduce((acc, t) => acc + t.total, 0);
  const totalProfit = validTransactions.reduce((acc, t) => acc + t.profit, 0);
  const totalTrxCount = validTransactions.length;
  const avgTicketSize = totalTrxCount > 0 ? Math.round(totalOmset / totalTrxCount) : 0;

  // Top Selling Products
  const productSalesMap: { [prodId: string]: { name: string; qty: number; totalSales: number } } = {};
  validTransactions.forEach((trx) => {
    trx.items.forEach((item) => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.productName,
          qty: 0,
          totalSales: 0,
        };
      }
      productSalesMap[item.productId].qty += item.quantity;
      productSalesMap[item.productId].totalSales += item.subtotal;
    });
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Group Chart Data by Date
  const dateGrouped: { [dateKey: string]: { omset: number; laba: number } } = {};
  validTransactions.forEach((t) => {
    const dKey = new Date(t.date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
    if (!dateGrouped[dKey]) {
      dateGrouped[dKey] = { omset: 0, laba: 0 };
    }
    dateGrouped[dKey].omset += t.total;
    dateGrouped[dKey].laba += t.profit;
  });

  const chartData = Object.entries(dateGrouped).map(([date, val]) => ({
    date,
    omset: val.omset,
    laba: val.laba,
  }));

  // CSV Export
  const handleExportCSV = () => {
    const headers = 'No Invoice,Tanggal,Kasir,Pelanggan,Metode Bayar,Total,Laba,Status\n';
    const rows = filteredTransactions
      .map(
        (t) =>
          `"${t.id}","${formatDateIndo(t.date)}","${t.cashierName}","${t.customer?.name || '-'}","${t.paymentMethod}",${t.total},${t.profit},"${t.status}"`
      )
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Kasirio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Void Handler with PIN Gate
  const handleInitiateVoid = (trxId: string) => {
    setSelectedTrxToVoid(trxId);
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    if (selectedTrxToVoid) {
      voidTransaction(selectedTrxToVoid, 'Pembatalan diotorisasi oleh Owner via PIN');
      setSelectedTrxToVoid(null);
      setIsPinModalOpen(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 space-y-6">
      
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Laporan Bisnis & Audit Kasir
          </h2>
          <p className="text-xs text-slate-400">
            Analisis omzet penjualan, laba bersih, dan pengawasan audit aksi sensitif kasir
          </p>
        </div>

        {/* Tab Toggle: Laporan vs Audit */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveReportTab('SALES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeReportTab === 'SALES'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Laporan Penjualan
          </button>
          <button
            onClick={() => setActiveReportTab('AUDIT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeReportTab === 'AUDIT'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit Log Kasir</span>
            {auditLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-200 font-mono">
                {auditLogs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeReportTab === 'SALES' ? (
        <>
          {/* Time Range Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: 'Semua Waktu' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'YESTERDAY', label: 'Kemarin' },
              { id: 'WEEK', label: '7 Hari Terakhir' },
              { id: 'MONTH', label: 'Bulan Ini' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  dateFilter === f.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <p className="text-xs text-slate-400 font-medium mb-1">Total Omset Penjualan</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">
                {formatRupiah(totalOmset)}
              </p>
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{totalTrxCount} transaksi sukses</span>
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <p className="text-xs text-slate-400 font-medium mb-1">Estimasi Laba Bersih</p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
                {formatRupiah(totalProfit)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Laba = Omset - HPP Modal</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <p className="text-xs text-slate-400 font-medium mb-1">Rata-rata Nilai Nota</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">
                {formatRupiah(avgTicketSize)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Per transaksi pelanggan</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <p className="text-xs text-slate-400 font-medium mb-1">Ekspor Laporan</p>
              <button
                onClick={handleExportCSV}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Unduh CSV Excel</span>
              </button>
            </div>
          </div>

          {/* Charts & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <h3 className="font-bold text-slate-100 text-sm mb-4">Grafik Penjualan & Laba Bersih</h3>
              <div className="h-64 w-full">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Belum ada data transaksi pada periode ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `Rp${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => formatRupiah(Number(val))}
                      />
                      <Bar dataKey="omset" name="Omset Penjualan" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="laba" name="Laba Bersih" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-100 text-sm mb-3">🔥 5 Produk Terlaris</h3>
                <div className="space-y-2.5">
                  {topSellingProducts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Belum ada transaksi.</p>
                  ) : (
                    topSellingProducts.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-slate-850 p-2.5 rounded-xl border border-slate-800"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-200 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-500">Total: {formatRupiah(p.totalSales)}</p>
                        </div>
                        <span className="font-extrabold text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 shrink-0">
                          {p.qty} terjual
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm">Riwayat Transaksi Toko</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchInvoice}
                    onChange={(e) => setSearchInvoice(e.target.value)}
                    placeholder="Cari No. Invoice / Pelanggan..."
                    className="bg-slate-850 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-850 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="LUNAS">Lunas</option>
                  <option value="KASBON">Kasbon</option>
                  <option value="BATAL">Batal (Void)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-850 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">No. Invoice</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Metode</th>
                    <th className="py-3 px-4 text-right">Total Nota</th>
                    <th className="py-3 px-4 text-right">Laba</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Tidak ada riwayat transaksi ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-850/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-300">
                          {trx.id}
                          {trx.customer && (
                            <p className="text-[10px] text-slate-400 font-normal">
                              {trx.customer.name}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {formatDateIndo(trx.date)}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {trx.paymentMethod}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                          {formatRupiah(trx.total)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          +{formatRupiah(trx.profit)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              trx.status === 'LUNAS'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : trx.status === 'KASBON'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {trx.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setActiveReceiptTransaction(trx)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 transition-colors"
                              title="Cetak Struk"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {trx.status !== 'BATAL' && (
                              <button
                                onClick={() => handleInitiateVoid(trx.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors flex items-center gap-1"
                                title="Batalkan Transaksi (Butuh PIN Owner)"
                              >
                                <Lock className="w-3 h-3 text-amber-400" />
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* AUDIT LOG TAB */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Log Audit Keamanan Kasir (Anti-Fraud)</span>
            </div>
            <span className="text-xs text-slate-400">
              Mencatat seluruh aksi sensitif: Void nota, Diskon manual, dan Buka laci kasir
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-850 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Tipe Aksi</th>
                  <th className="py-3 px-4">Kasir Penanggung Jawab</th>
                  <th className="py-3 px-4">Keterangan Aktivitas</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada catatan aksi sensitif yang mencurigakan.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                        {formatDateIndo(log.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            log.type === 'VOID'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : log.type === 'MANUAL_DISCOUNT'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-blue-950 text-blue-300 border-blue-800'
                          }`}
                        >
                          {log.type === 'VOID'
                            ? 'BATAL / VOID'
                            : log.type === 'MANUAL_DISCOUNT'
                            ? 'DISKON MANUAL'
                            : 'BUKA LACI MANUAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {log.cashierName}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                        {log.amount ? formatRupiah(log.amount) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PIN Gate Modal for Void */}
      <PinAuthModal
        isOpen={isPinModalOpen}
        title="Otorisasi Pembatalan Nota (Void)"
        description="Pembatalan transaksi akan mengembalikan stok produk dan dicatat dalam audit log kasir. Masukkan PIN Owner untuk menyetujui."
        onSuccess={handlePinSuccess}
        onCancel={() => {
          setSelectedTrxToVoid(null);
          setIsPinModalOpen(false);
        }}
      />
    </div>
  );
};
