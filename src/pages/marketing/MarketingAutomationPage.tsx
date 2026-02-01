import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageCircle, Zap } from "lucide-react";
import { WhatsAppAutomationManager } from "@/components/marketing/WhatsAppAutomationManager";

// Lazy load CampaignsPage to avoid circular dependencies
const CampaignsPage = lazy(() => import("./CampaignsPage"));

export default function MarketingAutomationPage() {
  const [activeTab, setActiveTab] = useState("email");

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketing Automation</h1>
            <p className="text-sm text-muted-foreground">
              Gestisci le tue campagne di automazione Email e WhatsApp
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Email Automation</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp Automation</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Email Automation Tab - Uses CampaignsPage */}
        <TabsContent value="email" className="-mx-6 -mt-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            <CampaignsPage />
          </Suspense>
        </TabsContent>

        {/* WhatsApp Automation Tab */}
        <TabsContent value="whatsapp">
          <WhatsAppAutomationManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
