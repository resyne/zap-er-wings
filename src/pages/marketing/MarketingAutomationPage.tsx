import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageCircle, Zap } from "lucide-react";
import { AutomationManager } from "@/components/crm/AutomationManager";
import { WhatsAppAutomationManager } from "@/components/marketing/WhatsAppAutomationManager";

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

        {/* Email Automation Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Automation
              </CardTitle>
              <CardDescription>
                Gestisci le tue automazioni email di follow-up e monitora gli invii programmati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutomationManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Automation Tab */}
        <TabsContent value="whatsapp">
          <WhatsAppAutomationManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
