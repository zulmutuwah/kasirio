import React, { useState, useEffect, useMemo } from 'react';
import { Product, StockLog, SmartReorderRecommendation } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { calculateReorderMetrics } from '../../utils/reorderMetrics';
import {
  Sparkles,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  Coins,
} from 'lucide-react';

interface SmartReorderWidgetProps {
  products: Product[];
  stockLogs: StockLog[];
  onOpenRestock: (product: Product, suggestedQty: number) => void;
}

export const SmartReorderWidget: React.FC<SmartReorderWidgetProps> = ({
  products,
  stockLogs,
  onOpenRestock,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  // Extract recent 7-day sales from stockLogs (type 'SALE')
  const salesHistory = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return stockLogs
      .filter((log) => log.type === 'SALE' && new Date(log.date) >= sevenDaysAgo)
      .map((log) => ({
        productId: log.productId,
        quantity: Math.abs(log.quantity),
        date: log.date,
      }));
  }, [stockLogs]);

  // Instant calculation via pure client logic (offline-first)
  const recommendations = useMemo(() => {
    return calculateReorderMetrics(products, salesHistory, 7);
  }, [products, salesHistory]);

  const criticalItems = useMemo(
    () => recommendations.filter((r) => r.urgency === 'CRITICAL'),
    [recommendations]
  );
  const warningItems = useMemo(
    () => recommendations.filter((r) => r.urgency === 'WARNING'),
    [recommendations]
  );

  const totalRestockBudget = useMemo(() => {
    return recommendations
      .filter((r) => r.urgency !== 'SAFE')
      .reduce((sum, r) => sum + r.estimatedCost, 0);
  }, [recommendations]);

  // Fetch contextual AI narrative from backend proxy if online
  const fetchAiAnalysis = async () => {
    setIsLoadingAi(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/smart-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products,
          salesData: salesHistory,
          windowDays: 7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.aiNarrative) {
          setAiNarrative(data.aiNarrative);
          return;
        }
      }
    } catch {
      // Offline fallback: Use default heuristic narrative
    } finally {
      setIsLoadingAi(false);
    }

    // Default offline fallback narrative
    if (criticalItems.length > 0) {
      setAiNarrative(
        `Terdapat ${criticalItems.length} produk berstatus Kritis yang diprediksi habis dalam 1-2 hari. Segera lakukan kulakan barang agar tidak kehilangan omzet kasir.`
      );
    } else if (warningItems.length > 0) {
      setAiNarrative(
        `Sebanyak ${warningItems.length} produk mulai menipis mendekati batas stok minimum. Siapkan rencana kulakan dalam 2-4 hari mendatang.`
      );
    } else {
      setAiNarrative(
        'Kondisi inventori toko aman terkendali. Tidak ada barang yang diprediksi habis dalam 5 hari ke depan.'
      );
    }
  };

  useEffect(() => {
    fetchAiAnalysis();
  }, [products.length, salesHistory.length]);

  const displayedItems = useMemo(() => {
    const needAttention = recommendations.filter((r) => r.urgency !== 'SAFE');
    if (selectedFilter === 'CRITICAL') return needAttention.filter((r) => r.urgency === 'CRITICAL');
    if (selectedFilter === 'WARNING') return needAttention.filter((r) => r.urgency === 'WARNING');
    return needAttention;
  }, [recommendations, selectedFilter]);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden transition-all">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">AI Smart Reorder & Prediksi Stok</h3>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Co-Pilot
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Analisis laju penjualan harian & estimasi waktu kulakan sebelum barang habis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={fetchAiAnalysis}
            disabled={isLoadingAi}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Muat ulang analisis AI"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoadingAi ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh AI</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 rounded-lg transition-colors"
            title={isExpanded ? 'Sembunyikan detail' : 'Buka detail'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 relative z-10">
        <div className="bg-slate-900/80 border border-rose-900/40 rounded-xl p-2.5 flex items-center gap-2.5">
          <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <span className="text-[11px] text-slate-400 block leading-tight">Habis &lt;2 Hari</span>
            <span className="text-base font-extrabold text-rose-400 font-mono">
              {criticalItems.length} <span className="text-xs font-normal text-slate-400">Produk</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-2.5 flex items-center gap-2.5">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <span className="text-[11px] text-slate-400 block leading-tight">Mendekati Min. Stok</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {warningItems.length} <span className="text-xs font-normal text-slate-400">Produk</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-xl p-2.5 flex items-center gap-2.5">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[11px] text-slate-400 block leading-tight">Stok Aman (&gt;5 Hari)</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {recommendations.filter((r) => r.urgency === 'SAFE').length}{' '}
              <span className="text-xs font-normal text-slate-400">Produk</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-indigo-900/40 rounded-xl p-2.5 flex items-center gap-2.5">
          <Coins className="w-6 h-6 text-indigo-400 shrink-0" />
          <div>
            <span className="text-[11px] text-slate-400 block leading-tight">Est. Modal Kulakan</span>
            <span className="text-sm font-extrabold text-indigo-300 font-mono">
              {formatRupiah(totalRestockBudget)}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 relative z-10 space-y-3.5">
          {/* AI Narrative Bubble */}
          <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-[11px] font-bold text-indigo-300 block uppercase tracking-wider mb-0.5">
                Rekomendasi Pintar Kasirio AI:
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {aiNarrative || 'Sedang menganalisis riwayat transaksi kasir...'}
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          {recommendations.some((r) => r.urgency !== 'SAFE') && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Filter Urgensi:</span>
              <button
                type="button"
                onClick={() => setSelectedFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Semua Butuh Restock ({criticalItems.length + warningItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Kritis Saja ({criticalItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('WARNING')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'WARNING'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Peringatan Saja ({warningItems.length})
              </button>
            </div>
          )}

          {/* List of recommended restock products */}
          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedItems.map((rec) => {
                const targetProduct = products.find((p) => p.id === rec.productId);
                const isCritical = rec.urgency === 'CRITICAL';

                return (
                  <div
                    key={rec.productId}
                    className={`bg-slate-900/90 border rounded-xl p-3 flex flex-col justify-between transition-all hover:border-slate-600 ${
                      isCritical ? 'border-rose-800/50' : 'border-amber-800/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 line-clamp-1">
                            {rec.productName}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            SKU: {rec.sku}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                            isCritical
                              ? 'bg-rose-950 text-rose-300 border-rose-800/80'
                              : 'bg-amber-950 text-amber-300 border-amber-800/80'
                          }`}
                        >
                          {isCritical ? '🚨 KRITIS' : '⚠️ WASPADA'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-2 rounded-lg mb-3">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Sisa Stok Saat Ini</span>
                          <span
                            className={`font-mono font-bold ${
                              rec.currentStock <= 0 ? 'text-rose-400' : 'text-slate-200'
                            }`}
                          >
                            {rec.currentStock} {rec.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Laju Penjualan</span>
                          <span className="font-mono font-semibold text-slate-200">
                            {rec.averageDailySales} {rec.unit}/hari
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Estimasi Habis</span>
                          <span
                            className={`font-mono font-bold ${
                              rec.daysUntilStockout <= 1 ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          >
                            {rec.daysUntilStockout <= 0 ? 'Sudah Habis!' : `${rec.daysUntilStockout} Hari Lagi`}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Saran Kulakan AI</span>
                          <span className="font-mono font-bold text-teal-400">
                            +{rec.suggestedReorderQty} {rec.unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Est. Modal Restock:</span>
                        <span className="text-xs font-bold font-mono text-slate-200">
                          {formatRupiah(rec.estimatedCost)}
                        </span>
                      </div>

                      {targetProduct && (
                        <button
                          type="button"
                          onClick={() => onOpenRestock(targetProduct, rec.suggestedReorderQty)}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>Restock Cepat</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-200">Stok Barang Toko Aman</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Semua produk memiliki persediaan yang cukup untuk memenuhi laju penjualan lebih dari 5 hari ke depan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
