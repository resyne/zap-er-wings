import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ParsedInvoice {
  supplier: {
    name: string;
    vatNumber: string;
    address?: string;
  };
  invoice: {
    number: string;
    date: string;
    totalAmount: number;
    vatAmount: number;
    netAmount: number;
    currency: string;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    totalAmount: number;
  }>;
}

interface InvoiceXMLImporterProps {
  onSuccess: () => void;
}

export function InvoiceXMLImporter({ onSuccess }: InvoiceXMLImporterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedInvoices, setParsedInvoices] = useState<ParsedInvoice[]>([]);
  const [xmlPreview, setXmlPreview] = useState<{ fileName: string; content: string } | null>(null);
  const { toast } = useToast();

  const parseXMLFile = async (file: File): Promise<ParsedInvoice | null> => {
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      // Check for parsing errors
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Errore nel parsing XML");
      }

      // Extract supplier information
      const supplierElement = xmlDoc.querySelector("CedentePrestatore DatiAnagrafici");
      const supplierName = supplierElement?.querySelector("Anagrafica Denominazione")?.textContent ||
                          `${supplierElement?.querySelector("Anagrafica Nome")?.textContent || ""} ${supplierElement?.querySelector("Anagrafica Cognome")?.textContent || ""}`.trim();
      
      const vatNumber = supplierElement?.querySelector("IdFiscaleIVA IdCodice")?.textContent || "";

      // Extract supplier address
      const addressElement = xmlDoc.querySelector("CedentePrestatore Sede");
      const address = addressElement ? 
        `${addressElement.querySelector("Indirizzo")?.textContent || ""}, ${addressElement.querySelector("CAP")?.textContent || ""} ${addressElement.querySelector("Comune")?.textContent || ""} (${addressElement.querySelector("Provincia")?.textContent || ""})`.trim() : 
        undefined;

      // Extract invoice data
      const invoiceElement = xmlDoc.querySelector("DatiGeneraliDocumento");
      const invoiceNumber = invoiceElement?.querySelector("Numero")?.textContent || "";
      const invoiceDate = invoiceElement?.querySelector("Data")?.textContent || "";
      const totalAmount = parseFloat(invoiceElement?.querySelector("ImportoTotaleDocumento")?.textContent || "0");

      // Extract VAT summary
      const vatSummary = xmlDoc.querySelectorAll("DatiRiepilogo");
      let totalVatAmount = 0;
      vatSummary.forEach(vat => {
        const vatAmount = parseFloat(vat.querySelector("Imposta")?.textContent || "0");
        totalVatAmount += vatAmount;
      });

      const netAmount = totalAmount - totalVatAmount;

      // Extract line items
      const lineElements = xmlDoc.querySelectorAll("DettaglioLinee");
      const lines: ParsedInvoice['lines'] = [];

      lineElements.forEach(lineElement => {
        const description = lineElement.querySelector("Descrizione")?.textContent || "";
        const quantity = parseFloat(lineElement.querySelector("Quantita")?.textContent || "1");
        const unitPrice = parseFloat(lineElement.querySelector("PrezzoUnitario")?.textContent || "0");
        const vatRate = parseFloat(lineElement.querySelector("AliquotaIVA")?.textContent || "0");
        const lineTotal = parseFloat(lineElement.querySelector("PrezzoTotale")?.textContent || "0");

        lines.push({
          description,
          quantity,
          unitPrice,
          vatRate,
          totalAmount: lineTotal
        });
      });

      return {
        supplier: {
          name: supplierName,
          vatNumber,
          address
        },
        invoice: {
          number: invoiceNumber,
          date: invoiceDate,
          totalAmount,
          vatAmount: totalVatAmount,
          netAmount,
          currency: "EUR"
        },
        lines
      };
    } catch (error) {
      console.error("Error parsing XML:", error);
      return null;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const parsed: ParsedInvoice[] = [];

    for (const file of files) {
      if (file.type === "text/xml" || file.name.endsWith(".xml")) {
        // Store XML content for preview
        const xmlContent = await file.text();
        setXmlPreview({ fileName: file.name, content: xmlContent });
        
        const result = await parseXMLFile(file);
        if (result) {
          parsed.push(result);
        } else {
          toast({
            title: "Errore",
            description: `Impossibile leggere il file ${file.name}`,
            variant: "destructive",
          });
        }
      }
    }

    setParsedInvoices(parsed);
    setLoading(false);

    if (parsed.length > 0) {
      toast({
        title: "Successo",
        description: `${parsed.length} fatture importate correttamente`,
      });
    }
  };

  const createGLEntryFromInvoice = async (invoice: ParsedInvoice) => {
    try {
      // Find or create supplier
      let supplier = null;
      if (invoice.supplier.vatNumber) {
        const { data: existingSupplier } = await supabase
          .from('suppliers')
          .select('*')
          .eq('tax_id', invoice.supplier.vatNumber)
          .maybeSingle();

        if (existingSupplier) {
          supplier = existingSupplier;
        } else {
          // Create new supplier
          const { data: newSupplier, error: supplierError} = await supabase
            .from('suppliers')
            .insert([{
              name: invoice.supplier.name,
              tax_id: invoice.supplier.vatNumber,
              address: invoice.supplier.address,
              code: `SUP-${Date.now()}`, // Temporary code
              access_code: Math.random().toString(36).substring(2, 10).toUpperCase()
            }])
            .select()
            .single();

          if (supplierError) throw supplierError;
          supplier = newSupplier;
        }
      }

      // Get default accounts (these should be configured in the chart of accounts)
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .in('code', ['2010', '1410', '4010']) // Typical accounts: Suppliers, VAT receivable, Purchases
        .eq('is_active', true);

      const supplierAccount = accounts?.find(a => a.code === '2010'); // Supplier payable
      const vatAccount = accounts?.find(a => a.code === '1410'); // VAT receivable  
      const purchaseAccount = accounts?.find(a => a.code === '4010'); // Purchases

      if (!supplierAccount || !vatAccount || !purchaseAccount) {
        throw new Error("Conti contabili di default non configurati. Configurare i conti 2010 (Fornitori), 1410 (IVA a credito), 4010 (Acquisti)");
      }

      // Create GL entry
      const { data: glEntry, error: entryError } = await supabase
        .from('gl_entry')
        .insert({
          date: invoice.invoice.date,
          doc_type: 'PurchaseInvoice' as const,
          doc_ref: invoice.invoice.number,
          description: `Fattura ${invoice.invoice.number} - ${invoice.supplier.name}`,
          origin_module: 'Purchases' as const,
          status: 'incomplete' as const, // Needs manual classification
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Create GL entry lines
      const lines = [
        // Purchase line (debit)
        {
          gl_entry_id: glEntry.id,
          gl_account_id: purchaseAccount.id,
          debit: invoice.invoice.netAmount,
          credit: 0,
          notes: 'Acquisti da fattura XML'
        },
        // VAT line (debit)
        {
          gl_entry_id: glEntry.id,
          gl_account_id: vatAccount.id,
          debit: invoice.invoice.vatAmount,
          credit: 0,
          notes: 'IVA a credito'
        },
        // Supplier line (credit)
        {
          gl_entry_id: glEntry.id,
          gl_account_id: supplierAccount.id,
          debit: 0,
          credit: invoice.invoice.totalAmount,
          notes: `Debito vs ${invoice.supplier.name}`
        }
      ];

      const { error: linesError } = await supabase
        .from('gl_entry_line')
        .insert(lines);

      if (linesError) throw linesError;

      return glEntry;
    } catch (error) {
      console.error('Error creating GL entry:', error);
      throw error;
    }
  };

  const importInvoices = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const invoice of parsedInvoices) {
      try {
        await createGLEntryFromInvoice(invoice);
        successCount++;
      } catch (error) {
        console.error(`Error importing invoice ${invoice.invoice.number}:`, error);
        errorCount++;
      }
    }

    setLoading(false);

    if (successCount > 0) {
      toast({
        title: "Importazione completata",
        description: `${successCount} fatture importate con successo${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
      });
      onSuccess();
      setOpen(false);
      setParsedInvoices([]);
    } else {
      toast({
        title: "Errore",
        description: "Nessuna fattura importata correttamente",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importa XML
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa Fatture XML</DialogTitle>
          <DialogDescription>
            Carica file XML di fatture elettroniche per creare automaticamente i movimenti contabili preliminari
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Carica File XML
              </CardTitle>
              <CardDescription>
                Seleziona uno o più file XML di fatture elettroniche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="xml-files">File XML</Label>
                <Input
                  id="xml-files"
                  type="file"
                  accept=".xml,text/xml"
                  multiple
                  onChange={handleFileUpload}
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  Sono supportati i file XML delle fatture elettroniche italiane
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Results Tabs */}
          {(parsedInvoices.length > 0 || xmlPreview) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Risultati Analisi
                </CardTitle>
                <CardDescription>
                  Verifica i dati delle fatture e visualizza l'XML originale
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="parsed" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="parsed" disabled={parsedInvoices.length === 0}>
                      Fatture Analizzate ({parsedInvoices.length})
                    </TabsTrigger>
                    <TabsTrigger value="xml" disabled={!xmlPreview}>
                      <Eye className="mr-2 h-4 w-4" />
                      Anteprima XML
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="parsed" className="space-y-4 mt-4">
                    {parsedInvoices.map((invoice, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">
                                Fattura {invoice.invoice.number}
                              </CardTitle>
                              <CardDescription>
                                {invoice.supplier.name} - {invoice.supplier.vatNumber}
                              </CardDescription>
                            </div>
                            <Badge variant="outline">
                              €{invoice.invoice.totalAmount.toLocaleString()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Conto</TableHead>
                                <TableHead>Descrizione</TableHead>
                                <TableHead className="text-right">Dare</TableHead>
                                <TableHead className="text-right">Avere</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">4010</TableCell>
                                <TableCell>Acquisti</TableCell>
                                <TableCell className="text-right">€{invoice.invoice.netAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-right">-</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">1410</TableCell>
                                <TableCell>IVA a credito</TableCell>
                                <TableCell className="text-right">€{invoice.invoice.vatAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-right">-</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">2010</TableCell>
                                <TableCell>Debiti vs fornitori - {invoice.supplier.name}</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right">€{invoice.invoice.totalAmount.toLocaleString()}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {parsedInvoices.length > 0 && (
                      <div className="flex justify-between items-center mt-6 p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                          <span className="text-sm font-medium">
                            I movimenti verranno creati con stato "Incompleto" per permettere la classificazione manuale
                          </span>
                        </div>
                        <Button onClick={importInvoices} disabled={loading}>
                          {loading ? "Importazione..." : `Importa ${parsedInvoices.length} Fatture`}
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="xml" className="mt-4">
                    {xmlPreview && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {xmlPreview.fileName}
                          </CardTitle>
                          <CardDescription>
                            Contenuto originale del file XML
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-96 w-full rounded-md border">
                            <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                              {xmlPreview.content}
                            </pre>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}