import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "./components/layout/app-layout";
import { AuthPage } from "./pages/auth/AuthPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import NotFound from "./pages/NotFound";
import BomPage from "./pages/production/BomPage";
import WorkOrdersPage from "./pages/production/WorkOrdersPage";
import ExecutionsPage from "./pages/production/ExecutionsPage";
import SerialsPage from "./pages/production/SerialsPage";
import RmaPage from "./pages/production/RmaPage";
import ContactsPage from "./pages/crm/ContactsPage";
import CompaniesPage from "./pages/crm/CompaniesPage";
import DealsPage from "./pages/crm/DealsPage";
import NotesPage from "./pages/crm/NotesPage";
import LeadsPage from "./pages/crm/LeadsPage";
import OpportunitiesPage from "./pages/crm/OpportunitiesPage";
import OpportunityDetailsPage from "./pages/crm/OpportunityDetailsPage";
import QuotesPage from "./pages/crm/QuotesPage";
import OrdersPage from "./pages/crm/OrdersPage";
import CustomersPage from "./pages/crm/CustomersPage";
import PricingPage from "./pages/crm/PricingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="mfg/bom" element={<BomPage />} />
            <Route path="mfg/work-orders" element={<WorkOrdersPage />} />
            <Route path="mfg/executions" element={<ExecutionsPage />} />
            <Route path="mfg/serials" element={<SerialsPage />} />
            <Route path="mfg/rma" element={<RmaPage />} />
            <Route path="crm/leads" element={<LeadsPage />} />
            <Route path="crm/opportunities" element={<OpportunitiesPage />} />
            <Route path="crm/opportunities/:id" element={<OpportunityDetailsPage />} />
            <Route path="crm/quotes" element={<QuotesPage />} />
            <Route path="crm/orders" element={<OrdersPage />} />
            <Route path="crm/customers" element={<CustomersPage />} />
            <Route path="crm/pricing" element={<PricingPage />} />
            <Route path="crm/contacts" element={<ContactsPage />} />
            <Route path="crm/companies" element={<CompaniesPage />} />
            <Route path="crm/deals" element={<DealsPage />} />
            <Route path="crm/notes" element={<NotesPage />} />
              {/* CRM & Sales routes will be added here */}
              {/* Service routes will be added here */}
              {/* Other ERP module routes will be added here */}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
