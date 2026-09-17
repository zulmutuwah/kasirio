import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatDateIndo, formatRupiah } from '../../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Search,
  Download,
  XCircle,
  Eye,
  Calendar,
  CreditCard,
  CheckCircle2
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    transactions,
    cancelTransaction,
    setActiveReceiptTransaction,
    products,
  } = usePOS();

  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LUNAS' | 'KASBON' | 'BATAL'>('ALL');

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

  // Filter by Status & Invoice Search
  const filteredTransactions = filteredTransactionsByDate.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesSearch =
      t.id.toLowerCase().includes(searchInvoice.toLowerCase()) ||
      (t.customer?.name || '').toLowerCase().includes(searchInvoice.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate Metrics (Excluding BATAL status)
  const validTransactions = filteredTransactionsByDate.filter((t) => t.status !== 'BATAL');

  const totalOmset = validTransactions.reduce((acc, t) => acc + t.total, 0);
  const totalHpp = validTransactions.reduce((acc, t) => acc + t.totalCost, 0);
  const totalLabaBersih = totalOmset - totalHpp;
  const totalTrxCount = validTransactions.length;
  const avgTicketSize = totalTrxCount > 0 ? Math.round(totalOmset / totalTrxCount) : 0;

  // Chart 1: Revenue vs Profit per Date
  const dateGroupedData: { [key: string]: { date: string; omset: number; laba: number } } = {};

  validTransactions.forEach((t) => {
    const dateKey = new Date(t.date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
    if (!dateGroupedData[dateKey]) {
      dateGroupedData[dateKey] = { date: dateKey, omset: 0, laba: 0 };
    }
    dateGroupedData[dateKey].omset += t.total;
    dateGroupedData[dateKey].laba += t.profit;
  });

  const chartData = Object.values(dateGroupedData).reverse();

  // Chart 2: Payment Method Distribution
  const paymentDistribution = [
    { name: 'Tunai', value: validTransactions.filter((t) => t.paymentMethod === 'TUNAI').reduce((acc, t) => acc + t.total, 0), color: '#10B981' },
    { name: 'QRIS', value: validTransactions.filter((t) => t.paymentMethod === 'QRIS').reduce((acc, t) => acc + t.total, 0), color: '#0EA5E9' },
    { name: 'Transfer', value: validTransactions.filter((t) => t.paymentMethod === 'TRANSFER').reduce((acc, t) => acc + t.total, 0), color: '#8B5CF6' },
    { name: 'Kasbon', value: validTransactions.filter((t) => t.paymentMethod === 'KASBON').reduce((acc, t) => acc + t.total, 0), color: '#F59E0B' },
  ].filter((d) => d.value > 0);

  // Top Selling Products Breakdown
  const productSalesCount: { [key: string]: { name: string; qty: number; totalSales: number } } = {};

  validTransactions.forEach((t) => {
    t.items.forEach((item) => {
      if (!productSalesCount[item.productName]) {
        productSalesCount[item.productName] = { name: item.productName, qty: 0, totalSales: 0 };
      }
      productSalesCount[item.productName].qty += item.quantity;
      productSalesCount[item.productName].totalSales += item.subtotal;
    });
  });

  const topSellingProducts = Object.values(productSalesCount)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Download CSV helper
  const handleExportCSV = () => {
    const headers = ['No. Invoice', 'Tanggal', 'Metode Pembayaran', 'Total', 'HPP', 'Laba', 'Status'];
    const rows = filteredTransactions.map((t) => [
      t.id,
      formatDateIndo(t.date),
      t.paymentMethod,
      t.total,
      t.totalCost,
      t.profit,
      t.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 space-y-5">
      
      {/* Header & Date Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Laporan Keuangan & Analisis Penjualan
          </h2>
          <p className="text-xs text-slate-400">
            Rekap omset, profit bersih HPP, dan performa transaksi Kasir Pintar
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'WEEK', label: '7 Hari' },
            { id: 'MONTH', label: 'Bulan Ini' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                dateFilter === f.id
                  ? 'bg-teal-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs text-slate-400 font-medium mb-1">Total Omset Penjualan</p>
          <p className="text-xl sm:text-2xl font-extrabold text-teal-400 font-mono">
            {formatRupiah(totalOmset)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Bruto dari seluruh transaksi</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs text-slate-400 font-medium mb-1">Total Keuntungan Bersih (Profit)</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
            {formatRupiah(totalLabaBersih)}
          </p>
          <p className="text-[10px] text-emerald-500/80 font-medium mt-1">
            Laba = Omset - HPP Modal
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs text-slate-400 font-medium mb-1">Total Transaksi</p>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">
            {totalTrxCount} <span className="text-xs text-slate-400 font-normal">Nota</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Rata-rata: {formatRupiah(avgTicketSize)} / nota</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <p className="text-xs text-slate-400 font-medium mb-1">Export Data</p>
          <button
            onClick={handleExportCSV}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Excel</span>
          </button>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Chart 1: Sales & Profit Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <h3 className="font-bold text-slate-100 text-sm mb-4">
            Grafik Penjualan & Laba Bersih
          </h3>
          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Belum ada data transaksi pada periode ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `Rp${v/1000}k`} />
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
                  <Bar dataKey="omset" name="Omset Penjualan" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="laba" name="Laba Bersih" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Selling Products List */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm mb-3">
              🔥 5 Produk Terlaris
            </h3>
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
                    <span className="font-extrabold text-teal-400 font-mono bg-teal-950 px-2 py-0.5 rounded border border-teal-800 shrink-0">
                      {p.qty} terjual
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-400" />
            Riwayat Transaksi Penjualan ({filteredTransactions.length})
          </h3>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                placeholder="Cari No. Invoice / Pelanggan..."
                className="bg-slate-850 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-850 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="LUNAS">Lunas</option>
              <option value="KASBON">Kasbon</option>
              <option value="BATAL">Batal</option>
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
                    <td className="py-3 px-4 font-mono font-bold text-teal-300">
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
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 transition-colors"
                          title="Cetak Struk"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {trx.status !== 'BATAL' && (
                          <button
                            onClick={() => cancelTransaction(trx.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors"
                            title="Batalkan Transaksi & Kembalikan Stok"
                          >
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
    </div>
  );
};
