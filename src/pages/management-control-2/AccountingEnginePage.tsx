import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Cog, FileText, Building2, ArrowRight, Calculator, CheckCircle2 } from "lucide-react";

interface AccountingRule {
  id: string;
  rule_id: string;
  tipo_evento: string;
  incide_ce: boolean;
  stato_finanziario: string | null;
  iva_mode: string | null;
  output_template: string;
  description: string | null;
  is_active: boolean;
  priority: number;
}

interface AccountingTemplate {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
}

interface TemplateLine {
  id: string;
  template_id: string;
  line_order: number;
  dare_conto_type: string;
  dare_conto_dynamic: string | null;
  avere_conto_type: string;
  avere_conto_dynamic: string | null;
  importo_type: string;
  note: string | null;
}

interface StructuralAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  category: string;
  is_structural: boolean;
}

export default function AccountingEnginePage() {
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["accounting-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_rules")
        .select("*")
        .order("priority", { ascending: true })
        .order("rule_id", { ascending: true });
      if (error) throw error;
      return data as AccountingRule[];
    },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["accounting-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_templates")
        .select("*")
        .order("template_id");
      if (error) throw error;
      return data as AccountingTemplate[];
    },
  });

  const { data: templateLines, isLoading: linesLoading } = useQuery({
    queryKey: ["accounting-template-lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_template_lines")
        .select("*")
        .order("line_order");
      if (error) throw error;
      return data as TemplateLine[];
    },
  });

  const { data: structuralAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["structural-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structural_accounts")
        .select("*")
        .order("code");
      if (error) throw error;
      return data as StructuralAccount[];
    },
  });

  const isLoading = rulesLoading || templatesLoading || linesLoading || accountsLoading;

  const getTemplateLines = (templateId: string) => {
    if (!templateLines || !templates) return [];
    const template = templates.find((t) => t.template_id === templateId);
    if (!template) return [];
    return templateLines.filter((l) => l.template_id === template.id);
  };

  const formatEventType = (type: string) => {
    const colors: Record<string, string> = {
      COSTO: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      RICAVO: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      FINANZIARIO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      ASSESTAMENTO: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return <Badge className={colors[type] || ""}>{type}</Badge>;
  };

  const formatFinancialStatus = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground">-</span>;
    const labels: Record<string, string> = {
      DA_PAGARE: "Da Pagare",
      DA_INCASSARE: "Da Incassare",
      PAGATO: "Pagato",
      INCASSATO: "Incassato",
      ANTICIPO_DIPENDENTE: "Anticipo Dip.",
      RIMBORSO_DIPENDENTE: "Rimborso Dip.",
    };
    return <span>{labels[status] || status}</span>;
  };

  const formatIvaMode = (mode: string | null) => {
    if (!mode) return <span className="text-muted-foreground">-</span>;
    const labels: Record<string, string> = {
      DOMESTICA_IMPONIBILE: "IVA Domestica",
      CESSIONE_UE_NON_IMPONIBILE: "Cessione UE",
      CESSIONE_EXTRA_UE_NON_IMPONIBILE: "Extra UE",
      VENDITA_RC_EDILE: "RC Edile (Vendita)",
      ACQUISTO_RC_EDILE: "RC Edile (Acquisto)",
    };
    return <Badge variant="outline">{labels[mode] || mode}</Badge>;
  };

  const formatDynamicAccount = (dynamic: string | null) => {
    if (!dynamic) return "-";
    const labels: Record<string, string> = {
      BANCA_CASSA_CARTA: "Banca/Cassa/Carta",
      BANCA_CASSA_CARTA_O_CREDITI: "Banca/Cassa/Carta oppure Crediti Clienti",
      BANCA_CASSA_CARTA_O_DEBITI: "Banca/Cassa/Carta oppure Debiti Fornitori",
      CREDITI_CLIENTI: "Crediti Clienti",
      DEBITI_FORNITORI: "Debiti Fornitori",
      DEBITI_DIPENDENTI: "Debiti Dipendenti",
      CONTO_ECONOMICO: "Conto Economico (dall'evento)",
      IVA_DEBITO: "IVA a Debito",
      IVA_CREDITO: "IVA a Credito",
    };
    return labels[dynamic] || dynamic;
  };

  const formatImportoType = (type: string) => {
    const labels: Record<string, string> = {
      TOTALE: "Totale",
      IMPONIBILE: "Imponibile",
      IVA: "IVA",
      IVA_CALCOLATA: "IVA Calcolata (RC)",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Cog className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Motore Contabile</h1>
          <p className="text-muted-foreground">
            Regole e template per la generazione automatica delle scritture Dare/Avere
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regole Attive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules?.filter((r) => r.is_active).length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Righe Template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateLines?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conti Strutturali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{structuralAccounts?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Engine Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Come Funziona il Motore
          </CardTitle>
          <CardDescription>
            Il motore genera automaticamente le scritture contabili partendo da un Evento classificato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <Card className="p-4 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="font-medium">Evento Classificato</p>
              <p className="text-xs text-muted-foreground">Tipo, Stato, IVA Mode</p>
            </Card>
            <ArrowRight className="h-6 w-6 mx-auto text-muted-foreground hidden md:block" />
            <Card className="p-4 text-center">
              <Cog className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="font-medium">Matching Regola</p>
              <p className="text-xs text-muted-foreground">IF/ELSE logica</p>
            </Card>
            <ArrowRight className="h-6 w-6 mx-auto text-muted-foreground hidden md:block" />
            <Card className="p-4 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Scritture Generate</p>
              <p className="text-xs text-muted-foreground">Dare/Avere bilanciate</p>
            </Card>
          </div>

          <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
            <p><strong>Principi Chiave:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>La Prima Nota è <strong>esecuzione</strong>, non decisione</li>
              <li>Nessuna scrittura manuale: si rettifica solo tramite eventi correttivi</li>
              <li>Se competenza = RATEIZZATA → N movimenti economici (uno per periodo)</li>
              <li>L'eventuale movimento finanziario resta sempre 1</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rules">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rules">Tabella Regole</TabsTrigger>
          <TabsTrigger value="templates">Template Righe</TabsTrigger>
          <TabsTrigger value="accounts">Conti Strutturali</TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regole Contabili</CardTitle>
              <CardDescription>
                Ogni regola definisce le condizioni per applicare un template di scritture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Tipo Evento</TableHead>
                    <TableHead>Incide CE</TableHead>
                    <TableHead>Stato Finanziario</TableHead>
                    <TableHead>IVA Mode</TableHead>
                    <TableHead>Template Output</TableHead>
                    <TableHead>Descrizione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono font-medium">{rule.rule_id}</TableCell>
                      <TableCell>{formatEventType(rule.tipo_evento)}</TableCell>
                      <TableCell>
                        <Badge variant={rule.incide_ce ? "default" : "secondary"}>
                          {rule.incide_ce ? "SI" : "NO"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatFinancialStatus(rule.stato_finanziario)}</TableCell>
                      <TableCell>{formatIvaMode(rule.iva_mode)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {rule.output_template}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rule.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Righe Contabili</CardTitle>
              <CardDescription>
                Ogni template genera 1..N righe contabili bilanciate (Dare = Avere)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {templates?.map((template) => (
                  <AccordionItem key={template.id} value={template.template_id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {template.template_id}
                        </Badge>
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({getTemplateLines(template.template_id).length} righe)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4">
                        {template.description && (
                          <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                        )}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">#</TableHead>
                              <TableHead>DARE</TableHead>
                              <TableHead>AVERE</TableHead>
                              <TableHead>Importo</TableHead>
                              <TableHead>Note</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getTemplateLines(template.template_id).map((line) => (
                              <TableRow key={line.id}>
                                <TableCell className="font-mono">{line.line_order}</TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      line.dare_conto_type === "DYNAMIC"
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {line.dare_conto_type === "DYNAMIC"
                                      ? formatDynamicAccount(line.dare_conto_dynamic)
                                      : "-"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      line.avere_conto_type === "DYNAMIC"
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {line.avere_conto_type === "DYNAMIC"
                                      ? formatDynamicAccount(line.avere_conto_dynamic)
                                      : "-"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{formatImportoType(line.importo_type)}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {line.note}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structural Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Conti Patrimoniali Strutturali
              </CardTitle>
              <CardDescription>
                Conti predefiniti utilizzati dal motore per le contropartite finanziarie
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo Conto</TableHead>
                    <TableHead>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structuralAccounts?.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.account_type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{account.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* IVA Modes Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Gestione IVA</CardTitle>
              <CardDescription>Modalità IVA supportate dal motore contabile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">IVA Mode (enum)</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Badge>DOMESTICA_IMPONIBILE</Badge>
                      <span className="text-muted-foreground">Totale = Imponibile + IVA</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline">CESSIONE_UE_NON_IMPONIBILE</Badge>
                      <span className="text-muted-foreground">IVA = 0, ma tracciata</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline">CESSIONE_EXTRA_UE_NON_IMPONIBILE</Badge>
                      <span className="text-muted-foreground">IVA = 0, ma tracciata</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline">VENDITA_RC_EDILE</Badge>
                      <span className="text-muted-foreground">RC lato cliente</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline">ACQUISTO_RC_EDILE</Badge>
                      <span className="text-muted-foreground">IVA virtuale D/A</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium">Output Contabile IVA</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>
                      <strong className="text-foreground">Vendite imponibili:</strong> → IVA_Debito
                    </li>
                    <li>
                      <strong className="text-foreground">Acquisti imponibili:</strong> → IVA_Credito
                    </li>
                    <li>
                      <strong className="text-foreground">Reverse Charge acquisto:</strong> → IVA_Debito e
                      IVA_Credito (stesso importo)
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
