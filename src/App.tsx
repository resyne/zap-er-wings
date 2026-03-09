
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
const ZAppTimbraturaPage = lazy(() => import("./pages/hr/ZAppTimbraturaPage"));
const ZAppRiepilogoTimbraturePage = lazy(() => import("./pages/hr/ZAppRiepilogoTimbraturePage"));
const AttendanceDashboardPage = lazy(() => import("./pages/hr/attendance/AttendanceDashboardPage"));
const ShiftsPage = lazy(() => import("./pages/hr/attendance/ShiftsPage"));
const AttendancePresenzePage = lazy(() => import("./pages/hr/attendance/AttendancePresenzePage"));
const OvertimePage = lazy(() => import("./pages/hr/attendance/OvertimePage"));
const TravelPage = lazy(() => import("./pages/hr/attendance/TravelPage"));
const AnomaliesPage = lazy(() => import("./pages/hr/attendance/AnomaliesPage"));
const AttendanceReportsPage = lazy(() => import("./pages/hr/attendance/AttendanceReportsPage"));
const GeofencesPage = lazy(() => import("./pages/hr/attendance/GeofencesPage"));
const AttendanceSettingsPage = lazy(() => import("./pages/hr/attendance/AttendanceSettingsPage"));
const LeavesPage = lazy(() => import("./pages/hr/attendance/LeavesPage"));
const CorrectionsPage = lazy(() => import("./pages/hr/attendance/CorrectionsPage"));

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
                <Route path="direzione/dashboard" element={<Suspense fallback={<PageLoader />}><DirectionalDashboardPage /></Suspense>} />
                <Route path="direzione/calendario" element={<Suspense fallback={<PageLoader />}><CalendarioAziendale /></Suspense>} />
                <Route path="direzione/task-kpi" element={<Suspense fallback={<PageLoader />}><TaskKpiPage /></Suspense>} />
                <Route path="direzione/strategy" element={<Suspense fallback={<PageLoader />}><StrategyPage /></Suspense>} />
                <Route path="direzione/riepilogo-operativo" element={<Suspense fallback={<PageLoader />}><RiepilogoOperativoPage /></Suspense>} />
                <Route path="direzione/orders" element={<Suspense fallback={<PageLoader />}><OrdersPage /></Suspense>} />
                <Route path="direzione/commesse" element={<Suspense fallback={<PageLoader />}><CommesseUnificatePage /></Suspense>} />
                
                <Route path="personal-area" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
                <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
                
                <Route path="hr/people" element={<Suspense fallback={<PageLoader />}><PeoplePage /></Suspense>} />
                <Route path="hr/safety" element={<Suspense fallback={<PageLoader />}><SafetyPage /></Suspense>} />
                <Route path="hr/technicians" element={<Suspense fallback={<PageLoader />}><TechniciansPage /></Suspense>} />
                <Route path="hr/technicians-debug" element={<Suspense fallback={<PageLoader />}><TechniciansPageDebug /></Suspense>} />
                <Route path="mfg/bom" element={<Suspense fallback={<PageLoader />}><BomPage /></Suspense>} />
                <Route path="mfg/work-orders" element={<Suspense fallback={<PageLoader />}><ProductionOrdersPage /></Suspense>} />
                <Route path="mfg/executions" element={<Suspense fallback={<PageLoader />}><ExecutionsPage /></Suspense>} />
                <Route path="mfg/certifications" element={<Suspense fallback={<PageLoader />}><CertificationsPage /></Suspense>} />
                <Route path="mfg/serials" element={<Suspense fallback={<PageLoader />}><SerialsPage /></Suspense>} />
                <Route path="mfg/rma" element={<Suspense fallback={<PageLoader />}><RmaPage /></Suspense>} />
                <Route path="mfg/projects" element={<Suspense fallback={<PageLoader />}><ProductionProjectsPage /></Suspense>} />
                <Route path="crm/leads" element={<Suspense fallback={<PageLoader />}><LeadsPage /></Suspense>} />
                <Route path="crm/leads/kpi" element={<Suspense fallback={<PageLoader />}><LeadKpiPage /></Suspense>} />
                <Route path="marketing/email-marketing" element={<Suspense fallback={<PageLoader />}><EmailMarketingPage /></Suspense>} />
                <Route path="marketing/campaigns" element={<Suspense fallback={<PageLoader />}><CampaignsPage /></Suspense>} />
                <Route path="marketing/automation" element={<Suspense fallback={<PageLoader />}><MarketingAutomationPage /></Suspense>} />
                <Route path="crm/customers" element={<Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>} />
                <Route path="crm/offers" element={<Suspense fallback={<PageLoader />}><OffersPage /></Suspense>} />
                <Route path="crm/call-records" element={<Suspense fallback={<PageLoader />}><CallRecordsPage /></Suspense>} />
                <Route path="crm/phone-extensions" element={<Suspense fallback={<PageLoader />}><PhoneExtensionsPage /></Suspense>} />
                <Route path="crm/whatsapp" element={<Suspense fallback={<PageLoader />}><WhatsAppPage /></Suspense>} />
                <Route path="crm/wasender" element={<Suspense fallback={<PageLoader />}><WaSenderPage /></Suspense>} />
                <Route path="crm/product-configurator" element={<Suspense fallback={<PageLoader />}><ProductConfiguratorPage /></Suspense>} />
                <Route path="mfg/products" element={<Suspense fallback={<PageLoader />}><ProductCatalogPage /></Suspense>} />
                <Route path="warehouse/materials" element={<Suspense fallback={<PageLoader />}><MaterialsPage /></Suspense>} />
                <Route path="warehouse/shipping-orders" element={<Suspense fallback={<PageLoader />}><ShippingCommissionsPage /></Suspense>} />
                <Route path="wms/stock" element={<Suspense fallback={<PageLoader />}><StockPage /></Suspense>} />
                <Route path="wms/movements" element={<Suspense fallback={<PageLoader />}><MovementsPage /></Suspense>} />
                <Route path="wms/inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />
                <Route path="wms/ddt" element={<Suspense fallback={<PageLoader />}><DdtPage /></Suspense>} />
                <Route path="procurement/suppliers" element={<Suspense fallback={<PageLoader />}><SuppliersPage /></Suspense>} />
                <Route path="procurement/rfq" element={<Suspense fallback={<PageLoader />}><RfqPage /></Suspense>} />
                <Route path="procurement/po" element={<Suspense fallback={<PageLoader />}><PurchaseOrdersPage /></Suspense>} />
                <Route path="procurement/purchase-orders" element={<Suspense fallback={<PageLoader />}><PurchaseOrdersPage /></Suspense>} />
                <Route path="procurement/receipts" element={<Suspense fallback={<PageLoader />}><ReceiptsPage /></Suspense>} />
                <Route path="procurement/quality-control" element={<Suspense fallback={<PageLoader />}><QualityControlPage /></Suspense>} />
                <Route path="procurement/replenishment" element={<Suspense fallback={<PageLoader />}><ReplenishmentPage /></Suspense>} />
                <Route path="partnerships/importers" element={<Suspense fallback={<PageLoader />}><ImportersPage /></Suspense>} />
                <Route path="partnerships/installers" element={<Suspense fallback={<PageLoader />}><InstallersPage /></Suspense>} />
                <Route path="partnerships/resellers" element={<Suspense fallback={<PageLoader />}><ResellersPage /></Suspense>} />
                <Route path="finance/prima-nota" element={<Suspense fallback={<PageLoader />}><PrimaNotaPage /></Suspense>} />
                <Route path="finance/invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
                <Route path="management-control" element={<Suspense fallback={<PageLoader />}><ManagementControlPage /></Suspense>} />
                <Route path="management-control/setup" element={<Suspense fallback={<PageLoader />}><SetupPage /></Suspense>} />
                <Route path="management-control/movements" element={<Suspense fallback={<PageLoader />}><MovementsPageMC /></Suspense>} />
                <Route path="management-control/projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
                <Route path="management-control/budget" element={<Suspense fallback={<PageLoader />}><BudgetPage /></Suspense>} />
                <Route path="management-control/credits-debts" element={<Suspense fallback={<PageLoader />}><CreditsDebtsPage /></Suspense>} />
                <Route path="management-control-2/registro" element={<Suspense fallback={<PageLoader />}><PrimaNotaPageMC2 /></Suspense>} />
                <Route path="management-control-2/movimenti-finanziari" element={<Suspense fallback={<PageLoader />}><MovimentiFinanziariPage /></Suspense>} />
                <Route path="management-control-2/setup-contabile" element={<Suspense fallback={<PageLoader />}><SetupContabilePage /></Suspense>} />
                <Route path="management-control-2/chart-of-accounts" element={<Suspense fallback={<PageLoader />}><ChartOfAccountsPage /></Suspense>} />
                <Route path="management-control-2/cost-centers" element={<Suspense fallback={<PageLoader />}><CostCentersPage /></Suspense>} />
                <Route path="management-control-2/prima-nota" element={<Suspense fallback={<PageLoader />}><PrimaNotaPageMC2 /></Suspense>} />
                <Route path="management-control-2/accounting-engine" element={<Suspense fallback={<PageLoader />}><AccountingEnginePage /></Suspense>} />
                <Route path="management-control-2/scadenziario" element={<Suspense fallback={<PageLoader />}><ScadenziarioPage /></Suspense>} />
                <Route path="management-control-2/mastrino" element={<Suspense fallback={<PageLoader />}><MastrinoPage /></Suspense>} />
                <Route path="management-control-2/registro-fatture" element={<Suspense fallback={<PageLoader />}><RegistroContabilePage /></Suspense>} />
                <Route path="hr/fluida" element={<Suspense fallback={<PageLoader />}><FluidaPage /></Suspense>} />
                <Route path="hr/ticket-restaurant" element={<Suspense fallback={<PageLoader />}><TicketRestaurantPage /></Suspense>} />
                <Route path="hr/z-app" element={<Suspense fallback={<PageLoader />}><ZAppPage /></Suspense>} />
                <Route path="hr/z-app/rapporti" element={<Suspense fallback={<PageLoader />}><ZAppServiceReportsPage /></Suspense>} />
                <Route path="hr/z-app/rapporti/nuovo" element={<Suspense fallback={<PageLoader />}><ZAppNewServiceReportPage /></Suspense>} />
                <Route path="hr/z-app/registro" element={<Suspense fallback={<PageLoader />}><ZAppRegistroPage /></Suspense>} />
                <Route path="hr/z-app/magazzino" element={<Suspense fallback={<PageLoader />}><ZAppMagazzino /></Suspense>} />
                <Route path="hr/z-app/commesse" element={<Suspense fallback={<PageLoader />}><ZAppCommesse /></Suspense>} />
                <Route path="hr/z-app/calendario" element={<Suspense fallback={<PageLoader />}><ZAppCalendarioPage /></Suspense>} />
                <Route path="hr/z-app/comunicazioni" element={<Suspense fallback={<PageLoader />}><ZAppComunicazioniPage /></Suspense>} />
                <Route path="hr/z-app/ordini" element={<Suspense fallback={<PageLoader />}><ZAppOrdiniPage /></Suspense>} />
                <Route path="hr/z-app/ordini-fornitori" element={<Suspense fallback={<PageLoader />}><ZAppOrdiniFornitoriPage /></Suspense>} />
                <Route path="hr/z-app/impostazioni" element={<Suspense fallback={<PageLoader />}><ZAppImpostazioniPage /></Suspense>} />
                <Route path="hr/z-app/whatsapp" element={<Suspense fallback={<PageLoader />}><ZAppWhatsAppPage /></Suspense>} />
                <Route path="hr/z-app/timbratura" element={<Suspense fallback={<PageLoader />}><ZAppTimbraturaPage /></Suspense>} />
                <Route path="hr/z-app/riepilogo-timbrature" element={<Suspense fallback={<PageLoader />}><ZAppRiepilogoTimbraturePage /></Suspense>} />
                <Route path="hr/time-attendance" element={<Suspense fallback={<PageLoader />}><AttendanceDashboardPage /></Suspense>} />
                <Route path="hr/time-attendance/shifts" element={<Suspense fallback={<PageLoader />}><ShiftsPage /></Suspense>} />
                <Route path="hr/time-attendance/presenze" element={<Suspense fallback={<PageLoader />}><AttendancePresenzePage /></Suspense>} />
                <Route path="hr/time-attendance/overtime" element={<Suspense fallback={<PageLoader />}><OvertimePage /></Suspense>} />
                <Route path="hr/time-attendance/travel" element={<Suspense fallback={<PageLoader />}><TravelPage /></Suspense>} />
                <Route path="hr/time-attendance/anomalies" element={<Suspense fallback={<PageLoader />}><AnomaliesPage /></Suspense>} />
                <Route path="hr/time-attendance/reports" element={<Suspense fallback={<PageLoader />}><AttendanceReportsPage /></Suspense>} />
                <Route path="hr/time-attendance/geofences" element={<Suspense fallback={<PageLoader />}><GeofencesPage /></Suspense>} />
                <Route path="hr/time-attendance/settings" element={<Suspense fallback={<PageLoader />}><AttendanceSettingsPage /></Suspense>} />
                <Route path="hr/time-attendance/leaves" element={<Suspense fallback={<PageLoader />}><LeavesPage /></Suspense>} />
                <Route path="hr/time-attendance/corrections" element={<Suspense fallback={<PageLoader />}><CorrectionsPage /></Suspense>} />
                <Route path="docs" element={<Suspense fallback={<PageLoader />}><DocumentationPage /></Suspense>} />
                <Route path="docs/technical-sheets" element={<Suspense fallback={<PageLoader />}><TechnicalSheetsPage /></Suspense>} />
                <Route path="docs/technical-sheets/blast-chillers" element={<Suspense fallback={<PageLoader />}><BlastChillersPage /></Suspense>} />
                <Route path="docs/technical-sheets/ovens" element={<Suspense fallback={<PageLoader />}><OvensPage /></Suspense>} />
                <Route path="docs/compliance" element={<Suspense fallback={<PageLoader />}><CompliancePage /></Suspense>} />
                <Route path="docs/manuals" element={<Suspense fallback={<PageLoader />}><ManualsPage /></Suspense>} />
                <Route path="docs/price-lists" element={<Suspense fallback={<PageLoader />}><PriceListsPage /></Suspense>} />
                <Route path="support" element={<Suspense fallback={<PageLoader />}><SupportPage /></Suspense>} />
                <Route path="support/service-reports" element={<Suspense fallback={<PageLoader />}><ServiceReportsPage /></Suspense>} />
                <Route path="support/work-orders" element={<Suspense fallback={<PageLoader />}><ServiceOrdersPage /></Suspense>} />
                <Route path="support/tickets" element={<Suspense fallback={<PageLoader />}><TicketsPage /></Suspense>} />
                <Route path="support/service-report-settings" element={<Suspense fallback={<PageLoader />}><ServiceReportSettingsPage /></Suspense>} />
                <Route path="crm/cost-estimator" element={<Suspense fallback={<PageLoader />}><CostEstimatorPage /></Suspense>} />
                <Route path="marketing/archive" element={<Suspense fallback={<PageLoader />}><ArchivePage /></Suspense>} />
                <Route path="marketing/content-creation" element={<Suspense fallback={<PageLoader />}><ContentCreationPage /></Suspense>} />
                <Route path="marketing/brandkit" element={<Suspense fallback={<PageLoader />}><BrandkitPage /></Suspense>} />
                <Route path="marketing/competitor-analysis" element={<Suspense fallback={<PageLoader />}><CompetitorAnalysisPage /></Suspense>} />
                <Route path="marketing/brandkit/:brandId" element={<Suspense fallback={<PageLoader />}><BrandAssetManager /></Suspense>} />
                <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
                <Route path="tasks" element={<Suspense fallback={<PageLoader />}><TasksPage /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                <Route path="personal-area/calendario" element={<Suspense fallback={<PageLoader />}><CalendarioPersonale /></Suspense>} />
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
