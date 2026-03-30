
// Route configuration and imports
import { Suspense, lazy } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { AdminGuard } from "@/components/guards/AdminGuard";

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
const RegistroPage = lazy(() => import("./pages/management-control-2/RegistroPage"));
const MovimentiFinanziariPage = lazy(() => import("./pages/management-control-2/MovimentiFinanziariPage"));
const ChartOfAccountsPage = lazy(() => import("./pages/management-control-2/ChartOfAccountsPage"));
const CostCentersPage = lazy(() => import("./pages/management-control-2/CostCentersPage"));
const PrimaNotaPageMC2 = lazy(() => import("./pages/management-control-2/PrimaNotaPage"));
const AccountingEnginePage = lazy(() => import("./pages/management-control-2/AccountingEnginePage"));
const ScadenziarioPage = lazy(() => import("./pages/management-control-2/ScadenziarioPage"));
const MastrinoPage = lazy(() => import("./pages/management-control-2/MastrinoPage"));
const DocumentiPage = lazy(() => import("./pages/contabilita/DocumentiPage"));
const RegistroContabilePageContabilita = lazy(() => import("./pages/contabilita/RegistroContabilePage"));
const RegistroContabilePage = lazy(() => import("./pages/management-control-2/RegistroContabilePage"));
const SetupContabilePage = lazy(() => import("./pages/management-control-2/SetupContabilePage"));
const EventClassificationPage = lazy(() => import("./pages/management-control-2/EventClassificationPage"));
const DashboardMarginalitaPage = lazy(() => import("./pages/controllo-gestione/DashboardMarginalitaPage"));
const CostiPage = lazy(() => import("./pages/controllo-gestione/CostiPage"));
const CentriDiCostoGestionePage = lazy(() => import("./pages/controllo-gestione/CentriDiCostoGestionePage"));
const AnalisiVenditeCostiPage = lazy(() => import("./pages/controllo-gestione/AnalisiVenditeCostiPage"));
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
const BeccaPage = lazy(() => import("./pages/becca/BeccaPage"));
const TasksPage = lazy(() => import("./pages/tasks/TasksPage").then(m => ({ default: m.TasksPage })));
const ContentCreationPage = lazy(() => import("./pages/marketing/ContentCreationPage"));
const CompetitorAnalysisPage = lazy(() => import("./pages/marketing/CompetitorAnalysisPage"));
const ScrapingPage = lazy(() => import("./pages/marketing/ScrapingPage"));
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
const TesoreriaPage = lazy(() => import("./pages/finanza/TesoreriaPage"));

// Loading fallback for lazy routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

// Wrapper that combines ErrorBoundary + Suspense for lazy routes
const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </ErrorBoundary>
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
                <Route path="direzione/dashboard" element={<LazyPage><DirectionalDashboardPage /></LazyPage>} />
                <Route path="direzione/calendario" element={<LazyPage><CalendarioAziendale /></LazyPage>} />
                <Route path="direzione/task-kpi" element={<LazyPage><TaskKpiPage /></LazyPage>} />
                <Route path="direzione/strategy" element={<LazyPage><StrategyPage /></LazyPage>} />
                <Route path="direzione/riepilogo-operativo" element={<LazyPage><RiepilogoOperativoPage /></LazyPage>} />
                <Route path="direzione/orders" element={<LazyPage><OrdersPage /></LazyPage>} />
                <Route path="direzione/commesse" element={<LazyPage><CommesseUnificatePage /></LazyPage>} />
                
                <Route path="personal-area" element={<LazyPage><DashboardPage /></LazyPage>} />
                <Route path="dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />
                
                <Route path="hr/people" element={<LazyPage><PeoplePage /></LazyPage>} />
                <Route path="hr/safety" element={<LazyPage><SafetyPage /></LazyPage>} />
                <Route path="hr/technicians" element={<LazyPage><TechniciansPage /></LazyPage>} />
                <Route path="hr/technicians-debug" element={<LazyPage><TechniciansPageDebug /></LazyPage>} />
                <Route path="mfg/bom" element={<LazyPage><BomPage /></LazyPage>} />
                <Route path="mfg/work-orders" element={<LazyPage><ProductionOrdersPage /></LazyPage>} />
                <Route path="mfg/executions" element={<LazyPage><ExecutionsPage /></LazyPage>} />
                <Route path="mfg/certifications" element={<LazyPage><CertificationsPage /></LazyPage>} />
                <Route path="mfg/serials" element={<LazyPage><SerialsPage /></LazyPage>} />
                <Route path="mfg/rma" element={<LazyPage><RmaPage /></LazyPage>} />
                <Route path="mfg/projects" element={<LazyPage><ProductionProjectsPage /></LazyPage>} />
                <Route path="crm/leads" element={<LazyPage><LeadsPage /></LazyPage>} />
                <Route path="crm/leads/kpi" element={<LazyPage><LeadKpiPage /></LazyPage>} />
                <Route path="marketing/email-marketing" element={<LazyPage><EmailMarketingPage /></LazyPage>} />
                <Route path="marketing/campaigns" element={<LazyPage><CampaignsPage /></LazyPage>} />
                <Route path="marketing/automation" element={<LazyPage><MarketingAutomationPage /></LazyPage>} />
                <Route path="crm/customers" element={<LazyPage><CustomersPage /></LazyPage>} />
                <Route path="crm/offers" element={<LazyPage><OffersPage /></LazyPage>} />
                <Route path="crm/call-records" element={<LazyPage><CallRecordsPage /></LazyPage>} />
                <Route path="crm/phone-extensions" element={<LazyPage><PhoneExtensionsPage /></LazyPage>} />
                <Route path="crm/whatsapp" element={<LazyPage><WhatsAppPage /></LazyPage>} />
                <Route path="crm/wasender" element={<LazyPage><WaSenderPage /></LazyPage>} />
                <Route path="crm/product-configurator" element={<LazyPage><ProductConfiguratorPage /></LazyPage>} />
                <Route path="mfg/products" element={<LazyPage><ProductCatalogPage /></LazyPage>} />
                <Route path="warehouse/materials" element={<LazyPage><MaterialsPage /></LazyPage>} />
                <Route path="warehouse/shipping-orders" element={<LazyPage><ShippingCommissionsPage /></LazyPage>} />
                <Route path="wms/stock" element={<LazyPage><StockPage /></LazyPage>} />
                <Route path="wms/movements" element={<LazyPage><MovementsPage /></LazyPage>} />
                <Route path="wms/inventory" element={<LazyPage><InventoryPage /></LazyPage>} />
                <Route path="wms/ddt" element={<LazyPage><DdtPage /></LazyPage>} />
                <Route path="procurement/suppliers" element={<LazyPage><SuppliersPage /></LazyPage>} />
                <Route path="procurement/rfq" element={<LazyPage><RfqPage /></LazyPage>} />
                <Route path="procurement/po" element={<LazyPage><PurchaseOrdersPage /></LazyPage>} />
                <Route path="procurement/purchase-orders" element={<LazyPage><PurchaseOrdersPage /></LazyPage>} />
                <Route path="procurement/receipts" element={<LazyPage><ReceiptsPage /></LazyPage>} />
                <Route path="procurement/quality-control" element={<LazyPage><QualityControlPage /></LazyPage>} />
                <Route path="procurement/replenishment" element={<LazyPage><ReplenishmentPage /></LazyPage>} />
                <Route path="partnerships/importers" element={<LazyPage><ImportersPage /></LazyPage>} />
                <Route path="partnerships/installers" element={<LazyPage><InstallersPage /></LazyPage>} />
                <Route path="partnerships/resellers" element={<LazyPage><ResellersPage /></LazyPage>} />
                <Route path="management-control-2/registro" element={<LazyPage><RegistroPage /></LazyPage>} />
                <Route path="management-control-2/movimenti-finanziari" element={<LazyPage><PrimaNotaPageMC2 /></LazyPage>} />
                <Route path="management-control-2/setup-contabile" element={<LazyPage><SetupContabilePage /></LazyPage>} />
                <Route path="management-control-2/chart-of-accounts" element={<LazyPage><ChartOfAccountsPage /></LazyPage>} />
                <Route path="management-control-2/cost-centers" element={<LazyPage><CostCentersPage /></LazyPage>} />
                <Route path="management-control-2/prima-nota" element={<LazyPage><PrimaNotaPageMC2 /></LazyPage>} />
                <Route path="management-control-2/accounting-engine" element={<LazyPage><AccountingEnginePage /></LazyPage>} />
                <Route path="management-control-2/scadenziario" element={<LazyPage><ScadenziarioPage /></LazyPage>} />
                <Route path="contabilita/documenti" element={<LazyPage><DocumentiPage /></LazyPage>} />
                <Route path="contabilita/registro-contabile" element={<LazyPage><RegistroContabilePageContabilita /></LazyPage>} />
                <Route path="management-control-2/mastrino" element={<LazyPage><MastrinoPage /></LazyPage>} />
                <Route path="management-control-2/classificazione-eventi" element={<LazyPage><PrimaNotaPageMC2 /></LazyPage>} />
                <Route path="management-control-2/registro-fatture" element={<LazyPage><PrimaNotaPageMC2 /></LazyPage>} />
                <Route path="hr/fluida" element={<LazyPage><FluidaPage /></LazyPage>} />
                <Route path="hr/ticket-restaurant" element={<LazyPage><TicketRestaurantPage /></LazyPage>} />
                <Route path="hr/z-app" element={<LazyPage><ZAppPage /></LazyPage>} />
                <Route path="hr/z-app/rapporti" element={<LazyPage><ZAppServiceReportsPage /></LazyPage>} />
                <Route path="hr/z-app/rapporti/nuovo" element={<LazyPage><ZAppNewServiceReportPage /></LazyPage>} />
                <Route path="hr/z-app/registro" element={<LazyPage><ZAppRegistroPage /></LazyPage>} />
                <Route path="hr/z-app/magazzino" element={<LazyPage><ZAppMagazzino /></LazyPage>} />
                <Route path="hr/z-app/commesse" element={<LazyPage><ZAppCommesse /></LazyPage>} />
                <Route path="hr/z-app/calendario" element={<LazyPage><ZAppCalendarioPage /></LazyPage>} />
                <Route path="hr/z-app/comunicazioni" element={<LazyPage><ZAppComunicazioniPage /></LazyPage>} />
                <Route path="hr/z-app/ordini" element={<LazyPage><ZAppOrdiniPage /></LazyPage>} />
                <Route path="hr/z-app/ordini-fornitori" element={<LazyPage><ZAppOrdiniFornitoriPage /></LazyPage>} />
                <Route path="hr/z-app/impostazioni" element={<LazyPage><ZAppImpostazioniPage /></LazyPage>} />
                <Route path="hr/z-app/whatsapp" element={<LazyPage><ZAppWhatsAppPage /></LazyPage>} />
                <Route path="hr/z-app/timbratura" element={<LazyPage><ZAppTimbraturaPage /></LazyPage>} />
                <Route path="hr/z-app/riepilogo-timbrature" element={<LazyPage><ZAppRiepilogoTimbraturePage /></LazyPage>} />
                <Route path="hr/time-attendance" element={<LazyPage><AttendanceDashboardPage /></LazyPage>} />
                <Route path="hr/time-attendance/shifts" element={<LazyPage><ShiftsPage /></LazyPage>} />
                <Route path="hr/time-attendance/presenze" element={<LazyPage><AttendancePresenzePage /></LazyPage>} />
                <Route path="hr/time-attendance/overtime" element={<LazyPage><OvertimePage /></LazyPage>} />
                <Route path="hr/time-attendance/travel" element={<LazyPage><TravelPage /></LazyPage>} />
                <Route path="hr/time-attendance/anomalies" element={<LazyPage><AnomaliesPage /></LazyPage>} />
                <Route path="hr/time-attendance/reports" element={<LazyPage><AttendanceReportsPage /></LazyPage>} />
                <Route path="hr/time-attendance/geofences" element={<LazyPage><GeofencesPage /></LazyPage>} />
                <Route path="hr/time-attendance/settings" element={<LazyPage><AttendanceSettingsPage /></LazyPage>} />
                <Route path="hr/time-attendance/leaves" element={<LazyPage><LeavesPage /></LazyPage>} />
                <Route path="hr/time-attendance/corrections" element={<LazyPage><CorrectionsPage /></LazyPage>} />
                <Route path="docs" element={<LazyPage><DocumentationPage /></LazyPage>} />
                <Route path="docs/technical-sheets" element={<LazyPage><TechnicalSheetsPage /></LazyPage>} />
                <Route path="docs/technical-sheets/blast-chillers" element={<LazyPage><BlastChillersPage /></LazyPage>} />
                <Route path="docs/technical-sheets/ovens" element={<LazyPage><OvensPage /></LazyPage>} />
                <Route path="docs/compliance" element={<LazyPage><CompliancePage /></LazyPage>} />
                <Route path="docs/manuals" element={<LazyPage><ManualsPage /></LazyPage>} />
                <Route path="docs/price-lists" element={<LazyPage><PriceListsPage /></LazyPage>} />
                <Route path="support" element={<LazyPage><SupportPage /></LazyPage>} />
                <Route path="support/service-reports" element={<LazyPage><ServiceReportsPage /></LazyPage>} />
                <Route path="support/work-orders" element={<LazyPage><ServiceOrdersPage /></LazyPage>} />
                <Route path="support/tickets" element={<LazyPage><TicketsPage /></LazyPage>} />
                <Route path="support/service-report-settings" element={<LazyPage><ServiceReportSettingsPage /></LazyPage>} />
                <Route path="crm/cost-estimator" element={<LazyPage><CostEstimatorPage /></LazyPage>} />
                <Route path="marketing/archive" element={<LazyPage><ArchivePage /></LazyPage>} />
                <Route path="marketing/content-creation" element={<LazyPage><ContentCreationPage /></LazyPage>} />
                <Route path="marketing/brandkit" element={<LazyPage><BrandkitPage /></LazyPage>} />
                <Route path="marketing/competitor-analysis" element={<LazyPage><CompetitorAnalysisPage /></LazyPage>} />
                <Route path="marketing/scraping" element={<LazyPage><ScrapingPage /></LazyPage>} />
                <Route path="marketing/brandkit/:brandId" element={<LazyPage><BrandAssetManager /></LazyPage>} />
                <Route path="integrations" element={<LazyPage><IntegrationsPage /></LazyPage>} />
                <Route path="becca" element={<LazyPage><BeccaPage /></LazyPage>} />
                <Route path="tasks" element={<LazyPage><TasksPage /></LazyPage>} />
                <Route path="settings" element={<LazyPage><SettingsPage /></LazyPage>} />
                <Route path="personal-area/calendario" element={<LazyPage><CalendarioPersonale /></LazyPage>} />
                <Route path="finanza/tesoreria" element={<LazyPage><TesoreriaPage /></LazyPage>} />
                <Route path="contabilita/tesoreria" element={<LazyPage><TesoreriaPage /></LazyPage>} />
                <Route path="controllo-gestione/dashboard" element={<LazyPage><AdminGuard section="Controllo di Gestione"><DashboardMarginalitaPage /></AdminGuard></LazyPage>} />
                <Route path="controllo-gestione/costi" element={<LazyPage><AdminGuard section="Controllo di Gestione"><CostiPage /></AdminGuard></LazyPage>} />
                <Route path="controllo-gestione/centri-costo" element={<LazyPage><AdminGuard section="Controllo di Gestione"><CentriDiCostoGestionePage /></AdminGuard></LazyPage>} />
                <Route path="controllo-gestione/analisi" element={<LazyPage><AdminGuard section="Controllo di Gestione"><AnalisiVenditeCostiPage /></AdminGuard></LazyPage>} />
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
