import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SetupPage = () => {
  const [activeTab, setActiveTab] = useState("chart-accounts");
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());

  useEffect(() => {
    loadChartOfAccounts();
  }, []);

  const loadChartOfAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setChartOfAccounts(data || []);
    } catch (error) {
      console.error('Error loading chart of accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (code) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedAccounts(newExpanded);
  };

  const renderAccountHierarchy = (accounts) => {
    const level1Accounts = accounts.filter(acc => acc.level === 1);
    
    return level1Accounts.map((account) => {
      const childAccounts = accounts.filter(acc => acc.parent_code === account.code);
      const isExpanded = expandedAccounts.has(account.code);
      
      return (
        <div key={account.code} className="space-y-2">
          {/* Level 1 Account */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleExpanded(account.code)}
                  className="p-0 h-auto"
                >
                  {childAccounts.length > 0 ? (
                    isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </Button>
                <span className="font-mono text-sm font-bold">{account.code}</span>
                <span className="font-bold text-lg">{account.name}</span>
                <Badge className={getTypeColor(account.account_type)}>
                  {account.account_type}
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Level 2 Accounts (Children) */}
          {isExpanded && childAccounts.map((childAccount) => (
            <div key={childAccount.code} className="ml-8 p-3 border rounded-lg border-l-4 border-l-primary/30">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-medium">{childAccount.code}</span>
                    <span className="font-medium">{childAccount.name}</span>
                    <Badge variant="outline">{childAccount.category}</Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    });
  };

  const costCenters = [
    { code: "CC001", name: "Produzione", description: "Centro di costo per attività produttive" },
    { code: "CC002", name: "Installazioni", description: "Centro di costo per installazioni" },
    { code: "CC003", name: "Service/Manutenzione", description: "Centro di costo per service e manutenzione" },
    { code: "CC004", name: "Commerciale & Marketing", description: "Centro di costo per attività commerciali" },
    { code: "CC005", name: "Amministrazione", description: "Centro di costo per attività amministrative" },
  ];

  const profitCenters = [
    { code: "PC001", name: "Macchine", description: "Centro di profitto per vendita macchine" },
    { code: "PC002", name: "Installazioni", description: "Centro di profitto per installazioni" },
    { code: "PC003", name: "Service/Manutenzione", description: "Centro di profitto per service e manutenzione" },
  ];

  const standardCosts = [
    { type: "technician_hour", description: "Ora tecnico installazione standard", cost: 45.00, unit: "hour" },
    { type: "transport_per_job", description: "Trasporto medio per consegna", cost: 150.00, unit: "job" },
  ];

  const kpiDrivers = [
    { name: "Macchine Prodotte", target: 20, current: 18, unit: "units" },
    { name: "Macchine Vendute", target: 18, current: 16, unit: "units" },
    { name: "Installazioni", target: 15, current: 14, unit: "units" },
    { name: "Contratti Manutenzione Attivi", target: 50, current: 48, unit: "contracts" },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "revenue": return "text-green-600 bg-green-100 dark:bg-green-900";
      case "cost": return "text-red-600 bg-red-100 dark:bg-red-900";
      case "opex": return "text-orange-600 bg-orange-100 dark:bg-orange-900";
      case "depreciation": return "text-purple-600 bg-purple-100 dark:bg-purple-900";
      case "extraordinary": return "text-blue-600 bg-blue-100 dark:bg-blue-900";
      case "capex": return "text-blue-600 bg-blue-100 dark:bg-blue-900";
      default: return "text-gray-600 bg-gray-100 dark:bg-gray-900";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Setup Controllo di Gestione</h1>
        <p className="text-muted-foreground">
          Configurazione iniziale del sistema di controllo di gestione
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="chart-accounts">Piano dei Conti</TabsTrigger>
          <TabsTrigger value="cost-centers">Centri di Costo</TabsTrigger>
          <TabsTrigger value="profit-centers">Centri di Profitto</TabsTrigger>
          <TabsTrigger value="standard-costs">Costi Standard</TabsTrigger>
          <TabsTrigger value="kpi-drivers">KPI Drivers</TabsTrigger>
        </TabsList>

        <TabsContent value="chart-accounts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Piano dei Conti Gestionale</CardTitle>
                  <CardDescription>
                    Mapping delle categorie di ricavi e costi per il controllo di gestione
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Conto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div>Caricamento...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {renderAccountHierarchy(chartOfAccounts)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-centers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Centri di Costo</CardTitle>
                  <CardDescription>
                    Definizione dei centri di costo per l'allocazione delle spese
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Centro di Costo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costCenters.map((center) => (
                  <div key={center.code} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-mono text-sm font-medium">{center.code}</span>
                        <span className="font-medium">{center.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{center.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit-centers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Centri di Profitto</CardTitle>
                  <CardDescription>
                    Definizione dei centri di profitto per l'analisi dei ricavi
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Centro di Profitto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profitCenters.map((center) => (
                  <div key={center.code} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-mono text-sm font-medium">{center.code}</span>
                        <span className="font-medium">{center.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{center.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standard-costs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Costi Standard</CardTitle>
                  <CardDescription>
                    Definizione dei costi standard per la valorizzazione automatica
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Costo Standard
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {standardCosts.map((cost, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-medium">{cost.description}</span>
                        <Badge variant="outline">{cost.type}</Badge>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-lg font-medium text-primary">€ {cost.cost.toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">per {cost.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpi-drivers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>KPI Drivers</CardTitle>
                  <CardDescription>
                    Indicatori chiave di performance operativi
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo KPI
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpiDrivers.map((kpi, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-medium">{kpi.name}</span>
                        <Badge variant="outline">{kpi.unit}</Badge>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Target: </span>
                          <span className="font-medium">{kpi.target}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Attuale: </span>
                          <span className={`font-medium ${kpi.current >= kpi.target ? 'text-green-600' : 'text-red-600'}`}>
                            {kpi.current}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Performance: </span>
                          <span className={`font-medium ${kpi.current >= kpi.target ? 'text-green-600' : 'text-red-600'}`}>
                            {((kpi.current / kpi.target) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SetupPage;