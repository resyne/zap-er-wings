
// Route configuration and imports
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PresenceTracker } from "@/components/auth/PresenceTracker";
import { AppLayout } from "./components/layout/app-layout";
import AuthPage from "./pages/auth/AuthPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { DirectionalDashboardPage } from "./pages/dashboard/DirectionalDashboardPage";
import PeoplePage from "./pages/hr/PeoplePage";
import SafetyPage from "./pages/hr/SafetyPage";
import CallRecordsPage from "./pages/crm/CallRecordsPage";
import PhoneExtensionsPage from "./pages/crm/PhoneExtensionsPage";
import WhatsAppPage from "./pages/crm/WhatsAppPage";
import WaSenderPage from "./pages/crm/WaSenderPage";
import TechniciansPage from "./pages/hr/TechniciansPage";
import TechniciansPageDebug from "./pages/hr/TechniciansPageDebug";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import BomPage from "./pages/production/BomPage";
import ProductionOrdersPage from "./pages/production/ProductionOrdersPage";
import ExecutionsPage from "./pages/production/ExecutionsPage";
import SerialsPage from "./pages/production/SerialsPage";
import RmaPage from "./pages/production/RmaPage";
import CertificationsPage from "./pages/production/CertificationsPage";
import ProductionProjectsPage from "./pages/production/ProductionProjectsPage";
import LeadsPage from "./pages/crm/LeadsPage";
import LeadKpiPage from "./pages/crm/LeadKpiPage";
import EmailMarketingPage from "./pages/marketing/EmailMarketingPage";
import CampaignsPage from "./pages/marketing/CampaignsPage";
import MarketingAutomationPage from "./pages/marketing/MarketingAutomationPage";
import OrdersPage from "./pages/crm/OrdersPage";
import CustomersPage from "./pages/crm/CustomersPage";
import OffersPage from "./pages/crm/OffersPage";
import ProductCatalogPage from "./pages/crm/ProductCatalogPage";
import ProductConfiguratorPage from "./pages/crm/ProductConfiguratorPage";
import PublicConfiguratorPage from "./pages/PublicConfiguratorPage";
import SupplierPortalPage from "./pages/procurement/SupplierPortalPage";
import StockPage from "./pages/warehouse/StockPage";
import MovementsPage from "./pages/warehouse/MovementsPage";

import InventoryPage from "./pages/warehouse/InventoryPage";
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
import CreditsDebtsPage from "./pages/management-control/CreditsDebtsPage";
import RegistroPage from "./pages/management-control-2/RegistroPage";
import MovimentiFinanziariPage from "./pages/management-control-2/MovimentiFinanziariPage";

import ChartOfAccountsPage from "./pages/management-control-2/ChartOfAccountsPage";
import CostCentersPage from "./pages/management-control-2/CostCentersPage";
import PrimaNotaPageMC2 from "./pages/management-control-2/PrimaNotaPage";
import AccountingEnginePage from "./pages/management-control-2/AccountingEnginePage";
import ScadenziarioPage from "./pages/management-control-2/ScadenziarioPage";
import MastrinoPage from "./pages/management-control-2/MastrinoPage";

import RegistroContabilePage from "./pages/management-control-2/RegistroContabilePage";
import SetupContabilePage from "./pages/management-control-2/SetupContabilePage";
import FluidaPage from "./pages/hr/FluidaPage";
import DocumentationPage from "./pages/documentation/DocumentationPage";
import TechnicalSheetsPage from "./pages/documentation/TechnicalSheetsPage";
import BlastChillersPage from "./pages/documentation/BlastChillersPage";
import OvensPage from "./pages/documentation/OvensPage";
import CompliancePage from "./pages/documentation/CompliancePage";
import ManualsPage from "./pages/documentation/ManualsPage";
import PriceListsPage from "./pages/documentation/PriceListsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import CalendarioAziendale from "./pages/direzione/CalendarioAziendaleNew";
import RiepilogoOperativoPage from "./pages/direzione/RiepilogoOperativoPage";
import PublicRiepilogoOperativoPage from "./pages/PublicRiepilogoOperativoPage";

import SupportPage from "./pages/support/SupportPage";
import ServiceReportsPage from "./pages/support/ServiceReportsPage";
import ServiceOrdersPage from "./pages/support/ServiceOrdersPage";
import TicketsPage from "./pages/support/TicketsPage";
import CostEstimatorPage from "./pages/crm/CostEstimatorPage";
import MaterialsPage from "./pages/warehouse/MaterialsPage";
import ShippingCommissionsPage from "./pages/warehouse/ShippingCommissionsPage";
import PurchaseOrderConfirmPage from "./pages/procurement/PurchaseOrderConfirmPage";
import EmailPage from "./pages/communication/EmailPage";
import ArchivePage from "./pages/marketing/ArchivePage";
import BrandkitPage from "./pages/marketing/BrandkitPage";
import BrandAssetManager from "./pages/marketing/BrandAssetManager";
import TicketRestaurantPage from "./pages/hr/TicketRestaurantPage";
import IntegrationsPage from "./pages/integrations/IntegrationsPage";
import { TasksPage } from "./pages/tasks/TasksPage";
import ContentCreationPage from "./pages/marketing/ContentCreationPage";
import CalendarioPersonale from "./pages/personal-area/CalendarioPersonale";
import TaskKpiPage from "./pages/direzione/TaskKpiPage";
import ZAppPage from "./pages/hr/ZAppPage";
import ZAppServiceReportsPage from "./pages/hr/ZAppServiceReportsPage";
import ZAppRegistroPage from "./pages/hr/ZAppRegistroPage";
import ZAppMagazzino from "./pages/hr/ZAppMagazzino";
import ZAppCommesse from "./pages/hr/ZAppCommesse";
import ZAppCalendarioPage from "./pages/hr/ZAppCalendarioPage";
import ZAppComunicazioniPage from "./pages/hr/ZAppComunicazioniPage";
import StrategyPage from "./pages/direzione/StrategyPage";
import PublicOfferPage from "./pages/PublicOfferPage";
import PublicDDTPage from "./pages/PublicDDTPage";

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
              <Route path="/offerta/:code" element={<PublicOfferPage />} />
              <Route path="/ddt/:code" element={<PublicDDTPage />} />
              <Route path="/configurator/:code" element={<PublicConfiguratorPage />} />
              <Route path="/supplier/:supplierId" element={<SupplierPortalPage />} />
              <Route path="/procurement/purchase-order-confirm" element={<PurchaseOrderConfirmPage />} />
              <Route path="/riepilogo-operativo" element={<PublicRiepilogoOperativoPage />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <PresenceTracker />
                  <AppLayout />
                </ProtectedRoute>
              }>
              <Route index element={<Index />} />
                <Route path="direzione/dashboard" element={<DirectionalDashboardPage />} />
                <Route path="direzione/calendario" element={<CalendarioAziendale />} />
                <Route path="direzione/task-kpi" element={<TaskKpiPage />} />
                <Route path="direzione/strategy" element={<StrategyPage />} />
                <Route path="direzione/riepilogo-operativo" element={<RiepilogoOperativoPage />} />
                <Route path="direzione/orders" element={<OrdersPage />} />
                
                <Route path="personal-area" element={<DashboardPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                
                <Route path="hr/people" element={<PeoplePage />} />
                <Route path="hr/safety" element={<SafetyPage />} />
                <Route path="hr/technicians" element={<TechniciansPage />} />
                <Route path="hr/technicians-debug" element={<TechniciansPageDebug />} />
                <Route path="mfg/bom" element={<BomPage />} />
                <Route path="mfg/work-orders" element={<ProductionOrdersPage />} />
                <Route path="mfg/executions" element={<ExecutionsPage />} />
                <Route path="mfg/certifications" element={<CertificationsPage />} />
                <Route path="mfg/serials" element={<SerialsPage />} />
                <Route path="mfg/rma" element={<RmaPage />} />
                <Route path="mfg/projects" element={<ProductionProjectsPage />} />
                <Route path="crm/leads" element={<LeadsPage />} />
                <Route path="crm/leads/kpi" element={<LeadKpiPage />} />
                <Route path="marketing/email-marketing" element={<EmailMarketingPage />} />
                <Route path="marketing/campaigns" element={<CampaignsPage />} />
                <Route path="marketing/automation" element={<MarketingAutomationPage />} />
                <Route path="crm/customers" element={<CustomersPage />} />
                <Route path="crm/offers" element={<OffersPage />} />
                <Route path="crm/call-records" element={<CallRecordsPage />} />
                <Route path="crm/phone-extensions" element={<PhoneExtensionsPage />} />
                <Route path="crm/whatsapp" element={<WhatsAppPage />} />
                <Route path="crm/wasender" element={<WaSenderPage />} />
                <Route path="crm/product-configurator" element={<ProductConfiguratorPage />} />
                <Route path="mfg/products" element={<ProductCatalogPage />} />
                <Route path="warehouse/materials" element={<MaterialsPage />} />
                <Route path="warehouse/shipping-orders" element={<ShippingCommissionsPage />} />
                <Route path="wms/stock" element={<StockPage />} />
                <Route path="wms/movements" element={<MovementsPage />} />
                
                <Route path="wms/inventory" element={<InventoryPage />} />
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
                <Route path="management-control/credits-debts" element={<CreditsDebtsPage />} />
                <Route path="management-control-2/registro" element={<RegistroPage />} />
                <Route path="management-control-2/movimenti-finanziari" element={<MovimentiFinanziariPage />} />
                
                <Route path="management-control-2/setup-contabile" element={<SetupContabilePage />} />
                <Route path="management-control-2/chart-of-accounts" element={<ChartOfAccountsPage />} />
                <Route path="management-control-2/cost-centers" element={<CostCentersPage />} />
                <Route path="management-control-2/prima-nota" element={<PrimaNotaPageMC2 />} />
                <Route path="management-control-2/accounting-engine" element={<AccountingEnginePage />} />
                <Route path="management-control-2/scadenziario" element={<ScadenziarioPage />} />
                <Route path="management-control-2/mastrino" element={<MastrinoPage />} />
                
                <Route path="management-control-2/registro-fatture" element={<RegistroContabilePage />} />
                <Route path="hr/fluida" element={<FluidaPage />} />
                <Route path="hr/ticket-restaurant" element={<TicketRestaurantPage />} />
                <Route path="hr/z-app" element={<ZAppPage />} />
                <Route path="hr/z-app/rapporti" element={<ZAppServiceReportsPage />} />
                <Route path="hr/z-app/registro" element={<ZAppRegistroPage />} />
                <Route path="hr/z-app/magazzino" element={<ZAppMagazzino />} />
                <Route path="hr/z-app/commesse" element={<ZAppCommesse />} />
                <Route path="hr/z-app/calendario" element={<ZAppCalendarioPage />} />
                <Route path="hr/z-app/comunicazioni" element={<ZAppComunicazioniPage />} />
                <Route path="docs" element={<DocumentationPage />} />
                <Route path="docs/technical-sheets" element={<TechnicalSheetsPage />} />
                <Route path="docs/technical-sheets/blast-chillers" element={<BlastChillersPage />} />
                <Route path="docs/technical-sheets/ovens" element={<OvensPage />} />
                <Route path="docs/compliance" element={<CompliancePage />} />
                <Route path="docs/manuals" element={<ManualsPage />} />
                <Route path="docs/price-lists" element={<PriceListsPage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="support/service-reports" element={<ServiceReportsPage />} />
                <Route path="support/work-orders" element={<ServiceOrdersPage />} />
                <Route path="support/tickets" element={<TicketsPage />} />
                <Route path="crm/cost-estimator" element={<CostEstimatorPage />} />
                <Route path="marketing/archive" element={<ArchivePage />} />
                <Route path="marketing/content-creation" element={<ContentCreationPage />} />
                <Route path="marketing/brandkit" element={<BrandkitPage />} />
                <Route path="marketing/brandkit/:brandId" element={<BrandAssetManager />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="personal-area/calendario" element={<CalendarioPersonale />} />
                <Route path="*" element={<NotFound />} />
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
