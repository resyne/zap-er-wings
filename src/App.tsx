
// Route configuration and imports
import { Suspense, lazy } from "react";
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

// Public routes - loaded eagerly since they're entry points
import AuthPage from "./pages/auth/AuthPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PublicOfferPage from "./pages/PublicOfferPage";
import PublicDDTPage from "./pages/PublicDDTPage";
import PublicConfiguratorPage from "./pages/PublicConfiguratorPage";
import PublicRiepilogoOperativoPage from "./pages/PublicRiepilogoOperativoPage";
import SupplierPortalPage from "./pages/procurement/SupplierPortalPage";
import PurchaseOrderConfirmPage from "./pages/procurement/PurchaseOrderConfirmPage";

// Lazy-loaded pages - only loaded when navigated to
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const DirectionalDashboardPage = lazy(() => import("./pages/dashboard/DirectionalDashboardPage").then(m => ({ default: m.DirectionalDashboardPage })));
const PeoplePage = lazy(() => import("./pages/hr/PeoplePage"));
const SafetyPage = lazy(() => import("./pages/hr/SafetyPage"));
const CallRecordsPage = lazy(() => import("./pages/crm/CallRecordsPage"));
const PhoneExtensionsPage = lazy(() => import("./pages/crm/PhoneExtensionsPage"));
const WhatsAppPage = lazy(() => import("./pages/crm/WhatsAppPage"));
const WaSenderPage = lazy(() => import("./pages/crm/WaSenderPage"));
const TechniciansPage = lazy(() => import("./pages/hr/TechniciansPage"));
const TechniciansPageDebug = lazy(() => import("./pages/hr/TechniciansPageDebug"));
const BomPage = lazy(() => import("./pages/production/BomPage"));
const ProductionOrdersPage = lazy(() => import("./pages/production/ProductionOrdersPage"));
const ExecutionsPage = lazy(() => import("./pages/production/ExecutionsPage"));
const SerialsPage = lazy(() => import("./pages/production/SerialsPage"));
const RmaPage = lazy(() => import("./pages/production/RmaPage"));
const CertificationsPage = lazy(() => import("./pages/production/CertificationsPage"));
const ProductionProjectsPage = lazy(() => import("./pages/production/ProductionProjectsPage"));
const LeadsPage = lazy(() => import("./pages/crm/LeadsPage"));
const LeadKpiPage = lazy(() => import("./pages/crm/LeadKpiPage"));
const EmailMarketingPage = lazy(() => import("./pages/marketing/EmailMarketingPage"));
const CampaignsPage = lazy(() => import("./pages/marketing/CampaignsPage"));
const MarketingAutomationPage = lazy(() => import("./pages/marketing/MarketingAutomationPage"));
const OrdersPage = lazy(() => import("./pages/crm/OrdersPage"));
const CommesseUnificatePage = lazy(() => import("./pages/direzione/CommesseUnificatePage"));
const CustomersPage = lazy(() => import("./pages/crm/CustomersPage"));
const OffersPage = lazy(() => import("./pages/crm/OffersPage"));
const ProductCatalogPage = lazy(() => import("./pages/crm/ProductCatalogPage"));
const ProductConfiguratorPage = lazy(() => import("./pages/crm/ProductConfiguratorPage"));
const StockPage = lazy(() => import("./pages/warehouse/StockPage"));
const MovementsPage = lazy(() => import("./pages/warehouse/MovementsPage"));
const InventoryPage = lazy(() => import("./pages/warehouse/InventoryPage"));
const DdtPage = lazy(() => import("./pages/warehouse/DdtPage"));
const SuppliersPage = lazy(() => import("./pages/procurement/SuppliersPage"));
const RfqPage = lazy(() => import("./pages/procurement/RfqPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/procurement/PurchaseOrdersPage"));
const ReceiptsPage = lazy(() => import("./pages/procurement/ReceiptsPage"));
const QualityControlPage = lazy(() => import("./pages/procurement/QualityControlPage"));
const ReplenishmentPage = lazy(() => import("./pages/procurement/ReplenishmentPage"));
const ImportersPage = lazy(() => import("./pages/partnerships/ImportersPage"));
const InstallersPage = lazy(() => import("./pages/partnerships/InstallersPage"));
const ResellersPage = lazy(() => import("./pages/partnerships/ResellersPage"));
const PrimaNotaPage = lazy(() => import("./pages/finance/PrimaNotaPage"));
const InvoicesPage = lazy(() => import("./pages/finance/InvoicesPage"));
const ManagementControlPage = lazy(() => import("./pages/management-control/ManagementControlPage"));
const SetupPage = lazy(() => import("./pages/management-control/SetupPage"));
const ProjectsPage = lazy(() => import("./pages/management-control/ProjectsPage"));
const BudgetPage = lazy(() => import("./pages/management-control/BudgetPage"));
const MovementsPageMC = lazy(() => import("./pages/management-control/MovementsPage"));
const CreditsDebtsPage = lazy(() => import("./pages/management-control/CreditsDebtsPage"));
const RegistroPage = lazy(() => import("./pages/management-control-2/RegistroPage"));
const MovimentiFinanziariPage = lazy(() => import("./pages/management-control-2/MovimentiFinanziariPage"));
const ChartOfAccountsPage = lazy(() => import("./pages/management-control-2/ChartOfAccountsPage"));
const CostCentersPage = lazy(() => import("./pages/management-control-2/CostCentersPage"));
const PrimaNotaPageMC2 = lazy(() => import("./pages/management-control-2/PrimaNotaPage"));
const AccountingEnginePage = lazy(() => import("./pages/management-control-2/AccountingEnginePage"));
const ScadenziarioPage = lazy(() => import("./pages/management-control-2/ScadenziarioPage"));
const MastrinoPage = lazy(() => import("./pages/management-control-2/MastrinoPage"));
const RegistroContabilePage = lazy(() => import("./pages/management-control-2/RegistroContabilePage"));
const SetupContabilePage = lazy(() => import("./pages/management-control-2/SetupContabilePage"));
const FluidaPage = lazy(() => import("./pages/hr/FluidaPage"));
const DocumentationPage = lazy(() => import("./pages/documentation/DocumentationPage"));
const TechnicalSheetsPage = lazy(() => import("./pages/documentation/TechnicalSheetsPage"));
const BlastChillersPage = lazy(() => import("./pages/documentation/BlastChillersPage"));
const OvensPage = lazy(() => import("./pages/documentation/OvensPage"));
const CompliancePage = lazy(() => import("./pages/documentation/CompliancePage"));
const ManualsPage = lazy(() => import("./pages/documentation/ManualsPage"));
const PriceListsPage = lazy(() => import("./pages/documentation/PriceListsPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const CalendarioAziendale = lazy(() => import("./pages/direzione/CalendarioAziendaleNew"));
const RiepilogoOperativoPage = lazy(() => import("./pages/direzione/RiepilogoOperativoPage"));
const SupportPage = lazy(() => import("./pages/support/SupportPage"));
const ServiceReportsPage = lazy(() => import("./pages/support/ServiceReportsPage"));
const ServiceOrdersPage = lazy(() => import("./pages/support/ServiceOrdersPage"));
const ServiceReportSettingsPage = lazy(() => import("./pages/support/ServiceReportSettingsPage"));
const TicketsPage = lazy(() => import("./pages/support/TicketsPage"));
const CostEstimatorPage = lazy(() => import("./pages/crm/CostEstimatorPage"));
const MaterialsPage = lazy(() => import("./pages/warehouse/MaterialsPage"));
const ShippingCommissionsPage = lazy(() => import("./pages/warehouse/ShippingCommissionsPage"));
const EmailPage = lazy(() => import("./pages/communication/EmailPage"));
const ArchivePage = lazy(() => import("./pages/marketing/ArchivePage"));
const BrandkitPage = lazy(() => import("./pages/marketing/BrandkitPage"));
const BrandAssetManager = lazy(() => import("./pages/marketing/BrandAssetManager"));
const TicketRestaurantPage = lazy(() => import("./pages/hr/TicketRestaurantPage"));
const IntegrationsPage = lazy(() => import("./pages/integrations/IntegrationsPage"));
const TasksPage = lazy(() => import("./pages/tasks/TasksPage").then(m => ({ default: m.TasksPage })));
const ContentCreationPage = lazy(() => import("./pages/marketing/ContentCreationPage"));
const CompetitorAnalysisPage = lazy(() => import("./pages/marketing/CompetitorAnalysisPage"));
const CalendarioPersonale = lazy(() => import("./pages/personal-area/CalendarioPersonale"));
const TaskKpiPage = lazy(() => import("./pages/direzione/TaskKpiPage"));
const ZAppPage = lazy(() => import("./pages/hr/ZAppPage"));
const ZAppServiceReportsPage = lazy(() => import("./pages/hr/ZAppServiceReportsPage"));
const ZAppNewServiceReportPage = lazy(() => import("./pages/hr/ZAppNewServiceReportPage"));
const ZAppRegistroPage = lazy(() => import("./pages/hr/ZAppRegistroPage"));
const ZAppMagazzino = lazy(() => import("./pages/hr/ZAppMagazzino"));
const ZAppCommesse = lazy(() => import("./pages/hr/ZAppCommesse"));
const ZAppCalendarioPage = lazy(() => import("./pages/hr/ZAppCalendarioPage"));
const ZAppComunicazioniPage = lazy(() => import("./pages/hr/ZAppComunicazioniPage"));
const ZAppOrdiniPage = lazy(() => import("./pages/hr/ZAppOrdiniPage"));
const ZAppOrdiniFornitoriPage = lazy(() => import("./pages/hr/ZAppOrdiniFornitoriPage"));
const ZAppImpostazioniPage = lazy(() => import("./pages/hr/ZAppImpostazioniPage"));
const ZAppWhatsAppPage = lazy(() => import("./pages/hr/ZAppWhatsAppPage"));
const StrategyPage = lazy(() => import("./pages/direzione/StrategyPage"));

// Loading fallback for lazy routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s - riduce refetch inutili
      gcTime: 5 * 60_000, // 5min - mantiene cache più a lungo
      retry: 1, // Solo 1 retry per query fallite
      refetchOnWindowFocus: false, // Evita refetch al cambio tab
    },
  },
});

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
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/offerta/:code" element={<PublicOfferPage />} />
              <Route path="/ddt/:code" element={<PublicDDTPage />} />
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
                <Route path="direzione/commesse" element={<CommesseUnificatePage />} />
                
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
                <Route path="hr/z-app/rapporti/nuovo" element={<ZAppNewServiceReportPage />} />
                <Route path="hr/z-app/registro" element={<ZAppRegistroPage />} />
                <Route path="hr/z-app/magazzino" element={<ZAppMagazzino />} />
                <Route path="hr/z-app/commesse" element={<ZAppCommesse />} />
                <Route path="hr/z-app/calendario" element={<ZAppCalendarioPage />} />
                <Route path="hr/z-app/comunicazioni" element={<ZAppComunicazioniPage />} />
                <Route path="hr/z-app/ordini" element={<ZAppOrdiniPage />} />
                <Route path="hr/z-app/ordini-fornitori" element={<ZAppOrdiniFornitoriPage />} />
                <Route path="hr/z-app/impostazioni" element={<ZAppImpostazioniPage />} />
                <Route path="hr/z-app/whatsapp" element={<ZAppWhatsAppPage />} />
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
                <Route path="support/service-report-settings" element={<ServiceReportSettingsPage />} />
                <Route path="crm/cost-estimator" element={<CostEstimatorPage />} />
                <Route path="marketing/archive" element={<ArchivePage />} />
                <Route path="marketing/content-creation" element={<ContentCreationPage />} />
                <Route path="marketing/brandkit" element={<BrandkitPage />} />
                <Route path="marketing/competitor-analysis" element={<CompetitorAnalysisPage />} />
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
