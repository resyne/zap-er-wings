import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/app-layout";
import AuthPage from "./pages/auth/AuthPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import BomPage from "./pages/production/BomPage";
import WorkOrdersPage from "./pages/production/WorkOrdersPage";
import ExecutionsPage from "./pages/production/ExecutionsPage";
import SerialsPage from "./pages/production/SerialsPage";
import RmaPage from "./pages/production/RmaPage";
import CrmPage from "./pages/crm/CrmPage";
import OrdersPage from "./pages/crm/OrdersPage";
import CustomersPage from "./pages/crm/CustomersPage";
import StockPage from "./pages/warehouse/StockPage";
import MovementsPage from "./pages/warehouse/MovementsPage";
import BatchesSerialsPage from "./pages/warehouse/BatchesSerialsPage";
import InventoryPage from "./pages/warehouse/InventoryPage";
import PickingPage from "./pages/warehouse/PickingPage";
import DdtPage from "./pages/warehouse/DdtPage";
import SuppliersPage from "./pages/procurement/SuppliersPage";
import RfqPage from "./pages/procurement/RfqPage";
import PurchaseOrdersPage from "./pages/procurement/PurchaseOrdersPage";
import ReceiptsPage from "./pages/procurement/ReceiptsPage";
import QualityControlPage from "./pages/procurement/QualityControlPage";
import ReplenishmentPage from "./pages/procurement/ReplenishmentPage";
import ImportersPage from "./pages/partnerships/ImportersPage";
import InstallersPage from "./pages/partnerships/InstallersPage";
import ResellersPage from "./pages/partnerships/ResellersPage";
import PrimaNotaPage from "./pages/finance/PrimaNotaPage";
import InvoicesPage from "./pages/finance/InvoicesPage";
import FluidaPage from "./pages/hr/FluidaPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route index element={<DashboardPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="mfg/bom" element={<BomPage />} />
                <Route path="mfg/work-orders" element={<WorkOrdersPage />} />
                <Route path="mfg/executions" element={<ExecutionsPage />} />
                <Route path="mfg/serials" element={<SerialsPage />} />
                <Route path="mfg/rma" element={<RmaPage />} />
                <Route path="crm/dashboard" element={<CrmPage />} />
                <Route path="crm/orders" element={<OrdersPage />} />
                <Route path="crm/customers" element={<CustomersPage />} />
                <Route path="wms/stock" element={<StockPage />} />
                <Route path="wms/movements" element={<MovementsPage />} />
                <Route path="wms/batches-serials" element={<BatchesSerialsPage />} />
                <Route path="wms/inventory" element={<InventoryPage />} />
                <Route path="wms/picking" element={<PickingPage />} />
                <Route path="wms/ddt" element={<DdtPage />} />
                <Route path="procurement/suppliers" element={<SuppliersPage />} />
                <Route path="procurement/rfq" element={<RfqPage />} />
                <Route path="procurement/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="procurement/receipts" element={<ReceiptsPage />} />
                <Route path="procurement/quality-control" element={<QualityControlPage />} />
                <Route path="procurement/replenishment" element={<ReplenishmentPage />} />
                <Route path="partnerships/importers" element={<ImportersPage />} />
                <Route path="partnerships/installers" element={<InstallersPage />} />
                <Route path="partnerships/resellers" element={<ResellersPage />} />
                <Route path="finance/prima-nota" element={<PrimaNotaPage />} />
                <Route path="finance/invoices" element={<InvoicesPage />} />
                <Route path="hr/fluida" element={<FluidaPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
