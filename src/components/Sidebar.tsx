import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import {
  BarChart3,
  Boxes,
  Calculator,
  Settings,
  Users,
  Store,
  ChevronLeft,
  Keyboard
} from 'lucide-react';
import { KeyboardShortcutsModal } from './shortcuts/KeyboardShortcutsModal';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    products,
    customers,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    settings
  } = usePOS();

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Count low stock items
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  // Count customers with unpaid debt
  const debtCustomerCount = customers.filter((c) => c.totalDebt > 0).length;

  const navItems = [
    {
      id: 'kasir' as const,
      label: 'Transaksi (Kasir)',
      icon: Calculator,
      badge: null,
    },
    {
      id: 'produk' as const,
      label: 'Produk & Stok',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'pelanggan' as const,
      label: 'Pelanggan & Kasbon',
      icon: Users,
      badge: debtCustomerCount > 0 ? debtCustomerCount : null,
      badgeColor: 'bg-amber-500 text-slate-900',
    },
    {
      id: 'laporan' as const,
      label: 'Laporan Penjualan',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'pengaturan' as const,
      label: 'Pengaturan Toko',
      icon: Settings,
      badge: null,
    },
  ];

  if (!isSidebarOpen) return null;

  return (
    <>
      {/* Mobile Sidebar Overlay Drawer (Slide-Over from Left) */}
      <div className="md:hidden fixed inset-0 z-50 flex select-none animate-in fade-in duration-200">
        {/* Backdrop Overlay */}
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Vertical Sidebar Drawer */}
        <aside className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
          {/* Store Header in Mobile Drawer */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm text-slate-900 truncate">
                  {settings.storeName}
                </h2>
                <p className="text-[11px] text-slate-500 truncate">{settings.address || 'Kasirio POS'}</p>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors"
              title="Tutup Menu"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items Vertical List */}
          <div className="p-3 flex-1 space-y-1.5 overflow-y-auto">
            <p className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Menu Utama Kasir
            </p>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false); // Close drawer after selection
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                      : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        item.badgeColor || 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Pintasan Keyboard Button Mobile */}
            <div className="pt-2 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsShortcutsOpen(true);
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Keyboard className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm">Pintasan Keyboard</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                  Hotkeys
                </span>
              </button>
            </div>
          </div>

          {/* Footer in Mobile Drawer */}
          <div className="p-3.5 border-t border-slate-100 text-xs text-slate-400 space-y-1 bg-slate-50">
            <div className="flex items-center justify-between text-slate-700 font-medium">
              <span className="text-xs font-semibold">Status Sistem</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Aktif
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Kasirio POS • Fast Experience</p>
          </div>
        </aside>
      </div>

      {/* Desktop Sidebar (Collapsible) */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 shrink-0 select-none min-h-[calc(100vh-53px)] shadow-xs transition-all">
        {/* Store Title Header in Sidebar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-xs text-slate-900 truncate">
                {settings.storeName}
              </h2>
              <p className="text-[10px] text-slate-500 truncate">{settings.address || 'Kasirio POS'}</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="Tutup Menu"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 flex-1 space-y-1">
          <p className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Menu Utama Kasir
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      item.badgeColor || 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Pintasan Keyboard Desktop Sidebar */}
          <div className="pt-2 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-emerald-600" />
                <span>Pintasan Keyboard</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                Hotkeys
              </span>
            </button>
          </div>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-3 border-t border-slate-100 text-xs text-slate-400 space-y-1 bg-slate-50/50">
          <div className="flex items-center justify-between text-slate-600 font-medium">
            <span className="text-[11px]">Sistem Kasir</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Aktif
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Kasirio POS v2.5 • Fast Experience</p>
        </div>
      </aside>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
};
