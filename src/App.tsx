import React, { useState } from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { POSView } from './components/pos/POSView';
import { InventoryView } from './components/inventory/InventoryView';
import { CustomersView } from './components/customers/CustomersView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { OwnerDashboardView } from './components/backoffice/OwnerDashboardView';
import { OfficePortalView } from './components/office/OfficePortalView';
import { ShiftModal } from './components/shift/ShiftModal';
import { AddCustomerModal } from './components/customers/AddCustomerModal';
import { AddEditProductModal } from './components/inventory/AddEditProductModal';

const AppContent: React.FC = () => {
  const { activeTab } = usePOS();

  // Shared Global Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isGlobalCustomerModalOpen, setIsGlobalCustomerModalOpen] = useState(false);
  const [isGlobalAddProductModalOpen, setIsGlobalAddProductModalOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* Top Bar */}
      <Header onOpenShiftModal={() => setIsShiftModalOpen(true)} />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Tab View Area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {activeTab === 'kasir' && (
            <POSView
              onOpenCustomerModal={() => setIsGlobalCustomerModalOpen(true)}
              onOpenAddProductModal={() => setIsGlobalAddProductModalOpen(true)}
            />
          )}

          {activeTab === 'produk' && (
            <InventoryView
              isAddProductOpenExternal={isGlobalAddProductModalOpen}
              onCloseAddProductExternal={() => setIsGlobalAddProductModalOpen(false)}
            />
          )}

          {activeTab === 'pelanggan' && (
            <CustomersView
              isAddExternalOpen={isGlobalCustomerModalOpen}
              onCloseAddExternal={() => setIsGlobalCustomerModalOpen(false)}
            />
          )}

          {activeTab === 'laporan' && <ReportsView />}

          {activeTab === 'backoffice' && <OwnerDashboardView />}
          {activeTab === 'office' && <OfficePortalView />}
          {activeTab === 'pengaturan' && <SettingsView />}
        </main>
      </div>

      {/* Global Modals */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />

      <AddCustomerModal
        isOpen={isGlobalCustomerModalOpen}
        onClose={() => setIsGlobalCustomerModalOpen(false)}
      />

      <AddEditProductModal
        isOpen={isGlobalAddProductModalOpen}
        onClose={() => setIsGlobalAddProductModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <POSProvider>
      <AppContent />
    </POSProvider>
  );
}
