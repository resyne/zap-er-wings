import React from "react";
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
import { DirectionalDashboardPage } from "./pages/dashboard/DirectionalDashboardPage";
import PeoplePage from "./pages/hr/PeoplePage";
import TechniciansPage from "./pages/hr/TechniciansPage";
import TechniciansPageDebug from "./pages/hr/TechniciansPageDebug";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import BomPage from "./pages/production/BomPage";
import WorkOrdersPage from "./pages/production/WorkOrdersPage";
import ExecutionsPage from "./pages/production/ExecutionsPage";
import SerialsPage from "./pages/production/SerialsPage";
import RmaPage from "./pages/production/RmaPage";
import LeadsPage from "./pages/crm/LeadsPage";
import EmailMarketingPage from "./pages/marketing/EmailMarketingPage";
import OrdersPage from "./pages/crm/OrdersPage";
import CustomersPage from "./pages/crm/CustomersPage";
import OffersPage from "./pages/crm/OffersPage";
import StockPage from "./pages/warehouse/StockPage";
import MovementsPage from "./pages/warehouse/MovementsPage";

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
import ManagementControlPage from "./pages/management-control/ManagementControlPage";
import SetupPage from "./pages/management-control/SetupPage";
import ProjectsPage from "./pages/management-control/ProjectsPage";
import BudgetPage from "./pages/management-control/BudgetPage";
import MovementsPageMC from "./pages/management-control/MovementsPage";
import FluidaPage from "./pages/hr/FluidaPage";
import DocumentationPage from "./pages/documentation/DocumentationPage";
import TechnicalSheetsPage from "./pages/documentation/TechnicalSheetsPage";
import BlastChillersPage from "./pages/documentation/BlastChillersPage";
import OvensPage from "./pages/documentation/OvensPage";
import CompliancePage from "./pages/documentation/CompliancePage";
import ManualsPage from "./pages/documentation/ManualsPage";
import PriceListsPage from "./pages/documentation/PriceListsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import CalendarioAziendale from "./pages/direzione/CalendarioAziendale";
import CalendarioPersonale from "./pages/personal-area/CalendarioPersonale";
import SupportPage from "./pages/support/SupportPage";
import ServiceReportsPage from "./pages/support/ServiceReportsPage";
import WorkOrdersServicePage from "./pages/support/WorkOrdersServicePage";
import TicketsPage from "./pages/support/TicketsPage";
import WorkCostCalculatorPage from "./pages/support/WorkCostCalculatorPage";
import MaterialsPage from "./pages/warehouse/MaterialsPage";
import ShippingOrdersPage from "./pages/warehouse/ShippingOrdersPage";
import PurchaseOrderConfirmPage from "./pages/procurement/PurchaseOrderConfirmPage";
import EmailPage from "./pages/communication/EmailPage";
import ArchivePage from "./pages/marketing/ArchivePage";
import BrandkitPage from "./pages/marketing/BrandkitPage";
import BrandAssetManager from "./pages/marketing/BrandAssetManager";
import TicketRestaurantPage from "./pages/hr/TicketRestaurantPage";
import IntegrationsPage from "./pages/integrations/IntegrationsPage";
import { TasksPage } from "./pages/tasks/TasksPage";
import ContentCreationPage from "./pages/marketing/ContentCreationPage";

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
              <Route path="/procurement/purchase-order-confirm" element={<PurchaseOrderConfirmPage />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
              <Route index element={<Index />} />
                <Route path="direzione/dashboard" element={<DirectionalDashboardPage />} />
                <Route path="direzione/calendario" element={<CalendarioAziendale />} />
                <Route path="personal-area" element={<DashboardPage />} />
                
                <Route path="hr/people" element={<PeoplePage />} />
                <Route path="hr/technicians" element={<TechniciansPage />} />
                <Route path="hr/technicians-debug" element={<TechniciansPageDebug />} />
                <Route path="mfg/bom" element={<BomPage />} />
                <Route path="mfg/work-orders" element={<WorkOrdersPage />} />
                <Route path="mfg/executions" element={<ExecutionsPage />} />
                <Route path="mfg/serials" element={<SerialsPage />} />
                <Route path="mfg/rma" element={<RmaPage />} />
                <Route path="crm/leads" element={<LeadsPage />} />
                <Route path="marketing/email-marketing" element={<EmailMarketingPage />} />
                <Route path="crm/orders" element={<OrdersPage />} />
                <Route path="crm/customers" element={<CustomersPage />} />
                <Route path="crm/offers" element={<OffersPage />} />
                <Route path="warehouse/materials" element={<MaterialsPage />} />
                <Route path="warehouse/shipping-orders" element={<ShippingOrdersPage />} />
                <Route path="wms/stock" element={<StockPage />} />
                <Route path="wms/movements" element={<MovementsPage />} />
                
                <Route path="wms/inventory" element={<InventoryPage />} />
                <Route path="wms/picking" element={<PickingPage />} />
                <Route path="wms/ddt" element={<DdtPage />} />
                <Route path="procurement/suppliers" element={<SuppliersPage />} />
                <Route path="procurement/rfq" element={<RfqPage />} />
                <Route path="procurement/po" element={<PurchaseOrdersPage />} />
                <Route path="procurement/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="procurement/receipts" element={<ReceiptsPage />} />
                <Route path="procurement/quality-control" element={<QualityControlPage />} />
                <Route path="procurement/replenishment" element={<ReplenishmentPage />} />
                <Route path="partnerships/importers" element={<ImportersPage />} />
                <Route path="partnerships/installers" element={<InstallersPage />} />
                <Route path="partnerships/resellers" element={<ResellersPage />} />
                <Route path="finance/prima-nota" element={<PrimaNotaPage />} />
                <Route path="finance/invoices" element={<InvoicesPage />} />
                <Route path="management-control" element={<ManagementControlPage />} />
                <Route path="management-control/setup" element={<SetupPage />} />
                <Route path="management-control/movements" element={<MovementsPageMC />} />
                <Route path="management-control/projects" element={<ProjectsPage />} />
                <Route path="management-control/budget" element={<BudgetPage />} />
                <Route path="hr/fluida" element={<FluidaPage />} />
                <Route path="hr/ticket-restaurant" element={<TicketRestaurantPage />} />
                <Route path="docs" element={<DocumentationPage />} />
                <Route path="docs/technical-sheets" element={<TechnicalSheetsPage />} />
                <Route path="docs/technical-sheets/blast-chillers" element={<BlastChillersPage />} />
                <Route path="docs/technical-sheets/ovens" element={<OvensPage />} />
                <Route path="docs/compliance" element={<CompliancePage />} />
                <Route path="docs/manuals" element={<ManualsPage />} />
                <Route path="docs/price-lists" element={<PriceListsPage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="support/service-reports" element={<ServiceReportsPage />} />
                <Route path="support/work-orders" element={<WorkOrdersServicePage />} />
                <Route path="support/work-cost-calculator" element={<WorkCostCalculatorPage />} />
                <Route path="support/tickets" element={<TicketsPage />} />
                <Route path="marketing/archive" element={<ArchivePage />} />
                <Route path="marketing/content-creation" element={<ContentCreationPage />} />
                <Route path="marketing/brandkit" element={<BrandkitPage />} />
                <Route path="marketing/brandkit/:brandId" element={<BrandAssetManager />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="settings" element={<SettingsPage />} />
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
