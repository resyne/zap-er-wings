import { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Upload, Brain, Trash2, Globe, Building2, Package, FileText, Loader2, Eye, Search, Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Competitor {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
  notes: string | null;
  logo_url: string | null;
  created_at: string;
}

interface CompetitorProduct {
  id: string;
  competitor_id: string;
  price_list_id: string | null;
  name: string;
  model: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  specifications: Record<string, unknown> | null;
  notes: string | null;
}

interface PriceList {
  id: string;
  competitor_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
}

interface SearchMessage {
  role: "user" | "assistant";
  content: string;
  priceListName?: string;
}

export default function CompetitorAnalysisPage() {
  const queryClient = useQueryClient();
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: "", website: "", country: "", notes: "" });
  const [newProduct, setNewProduct] = useState({ name: "", model: "", category: "", price: "", notes: "" });
  const [uploading, setUploading] = useState(false);

  // AI Search state
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMessages, setSearchMessages] = useState<SearchMessage[]>([]);
  const pdfTextCache = useRef<Record<string, string>>({});

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ["competitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Competitor[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["competitor-products", selectedCompetitor?.id],
    queryFn: async () => {
      if (!selectedCompetitor) return [];
      const { data, error } = await supabase
        .from("competitor_products")
        .select("*")
        .eq("competitor_id", selectedCompetitor.id)
        .order("name");
      if (error) throw error;
      return data as CompetitorProduct[];
    },
    enabled: !!selectedCompetitor,
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["competitor-price-lists", selectedCompetitor?.id],
    queryFn: async () => {
      if (!selectedCompetitor) return [];
      const { data, error } = await supabase
        .from("competitor_price_lists")
        .select("*")
        .eq("competitor_id", selectedCompetitor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PriceList[];
    },
    enabled: !!selectedCompetitor,
  });

  const addCompetitor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("competitors").insert({
        name: newCompetitor.name,
        website: newCompetitor.website || null,
        country: newCompetitor.country || null,
        notes: newCompetitor.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setShowAddDialog(false);
      setNewCompetitor({ name: "", website: "", country: "", notes: "" });
      toast.success("Competitor aggiunto");
    },
    onError: () => toast.error("Errore nell'aggiunta del competitor"),
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      if (!selectedCompetitor) return;
      const { error } = await supabase.from("competitor_products").insert({
        competitor_id: selectedCompetitor.id,
        name: newProduct.name,
        model: newProduct.model || null,
        category: newProduct.category || null,
        price: newProduct.price ? parseFloat(newProduct.price) : null,
        notes: newProduct.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-products"] });
      setShowAddProductDialog(false);
      setNewProduct({ name: "", model: "", category: "", price: "", notes: "" });
      toast.success("Prodotto aggiunto");
    },
    onError: () => toast.error("Errore nell'aggiunta del prodotto"),
  });

  const deleteCompetitor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("competitors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setSelectedCompetitor(null);
      toast.success("Competitor eliminato");
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("competitor_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitor-products"] });
      toast.success("Prodotto eliminato");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !selectedCompetitor) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const filePath = `competitor-pricelists/${selectedCompetitor.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("company-documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-documents")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("competitor_price_lists").insert({
        competitor_id: selectedCompetitor.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["competitor-price-lists"] });
      toast.success("Listino caricato");
    } catch (err) {
      console.error(err);
      toast.error("Errore nel caricamento");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAiSearch = async () => {
    if (!selectedPriceList || !searchQuery.trim()) return;
    const query = searchQuery.trim();
    setSearchQuery("");
    setSearching(true);

    setSearchMessages((prev) => [
      ...prev,
      { role: "user", content: query, priceListName: selectedPriceList.file_name },
    ]);

    try {
      const isPdf = selectedPriceList.file_name.toLowerCase().endsWith(".pdf");
      let pdfText: string | undefined;

      if (isPdf) {
        // Extract text client-side to avoid edge function memory limits
        if (pdfTextCache.current[selectedPriceList.id]) {
          pdfText = pdfTextCache.current[selectedPriceList.id];
        } else {
          toast.info("Estrazione testo dal PDF...");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          const pdf = await pdfjsLib.getDocument(selectedPriceList.file_url).promise;
          const pages: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map((item: any) => item.str).join(" ");
            pages.push(text);
          }
          pdfText = pages.join("\n\n");
          pdfTextCache.current[selectedPriceList.id] = pdfText;
        }
      }

      const { data, error } = await supabase.functions.invoke("analyze-competitor-pricelist", {
        body: {
          fileUrl: isPdf ? undefined : selectedPriceList.file_url,
          fileName: selectedPriceList.file_name,
          query,
          pdfText,
        },
      });
      if (error) throw error;

      setSearchMessages((prev) => [
        ...prev,
        { role: "assistant", content: data?.answer || "Nessuna risposta." },
      ]);
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.message || "Errore nella ricerca AI";
      toast.error(errorMsg);
      setSearchMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Errore: ${errorMsg}` },
      ]);
    } finally {
      setSearching(false);
    }
  };

  const deletePriceList = async (pl: PriceList) => {
    try {
      const urlParts = pl.file_url.split("/company-documents/");
      if (urlParts[1]) {
        await supabase.storage.from("company-documents").remove([urlParts[1]]);
      }
      const { error } = await supabase.from("competitor_price_lists").delete().eq("id", pl.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["competitor-price-lists"] });
      if (selectedPriceList?.id === pl.id) setSelectedPriceList(null);
      toast.success("Listino eliminato");
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competitor Analysis</h1>
          <p className="text-muted-foreground">Carica listini competitor e cerca informazioni con l'AI</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Aggiungi Competitor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo Competitor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome *" value={newCompetitor.name} onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })} />
              <Input placeholder="Sito web" value={newCompetitor.website} onChange={(e) => setNewCompetitor({ ...newCompetitor, website: e.target.value })} />
              <Input placeholder="Paese" value={newCompetitor.country} onChange={(e) => setNewCompetitor({ ...newCompetitor, country: e.target.value })} />
              <Textarea placeholder="Note" value={newCompetitor.notes} onChange={(e) => setNewCompetitor({ ...newCompetitor, notes: e.target.value })} />
              <Button onClick={() => addCompetitor.mutate()} disabled={!newCompetitor.name || addCompetitor.isPending} className="w-full">
                {addCompetitor.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Competitor List */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> Competitor</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Caricamento...</p>
            ) : competitors.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nessun competitor ancora</p>
            ) : (
              competitors.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg cursor-pointer border transition-colors ${selectedCompetitor?.id === c.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  onClick={() => { setSelectedCompetitor(c); setSelectedPriceList(null); setSearchMessages([]); }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.country && <p className="text-xs text-muted-foreground">{c.country}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteCompetitor.mutate(c.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {c.website && (
                    <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                      <Globe className="h-3 w-3" /> {c.website}
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Detail Area */}
        <div className="lg:col-span-3">
          {selectedCompetitor ? (
            <Tabs defaultValue="pricelists">
              <TabsList>
                <TabsTrigger value="pricelists"><Search className="mr-2 h-4 w-4" /> Listini & Ricerca AI ({priceLists.length})</TabsTrigger>
                <TabsTrigger value="products"><Package className="mr-2 h-4 w-4" /> Prodotti ({products.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="pricelists" className="space-y-4">
                <div className="flex justify-end">
                  <label>
                    <Button size="sm" asChild disabled={uploading}>
                      <span className="cursor-pointer">
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {uploading ? "Caricamento..." : "Carica Listino"}
                      </span>
                    </Button>
                    <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Price lists column */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Listini caricati</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {priceLists.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">Nessun listino caricato.</p>
                      ) : (
                        <div className="space-y-2">
                          {priceLists.map((pl) => (
                            <div
                              key={pl.id}
                              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedPriceList?.id === pl.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                              onClick={() => { setSelectedPriceList(pl); setSearchMessages([]); }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{pl.file_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(pl.created_at), "dd MMM yyyy", { locale: it })}
                                    {pl.file_size && ` · ${(pl.file_size / 1024).toFixed(0)} KB`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); window.open(pl.file_url, "_blank"); }}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deletePriceList(pl); }}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* AI Search column */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        Ricerca AI nel listino
                        {selectedPriceList && (
                          <Badge variant="secondary" className="text-xs font-normal ml-1 truncate max-w-[180px]">
                            {selectedPriceList.file_name}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0">
                      {!selectedPriceList ? (
                        <div className="flex-1 flex items-center justify-center text-center py-8">
                          <div>
                            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">Seleziona un listino dalla lista per iniziare a cercare informazioni con l'AI</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ScrollArea className="flex-1 min-h-[300px] max-h-[400px] mb-3">
                            <div className="space-y-3 pr-2">
                              {searchMessages.length === 0 && (
                                <div className="text-center py-8">
                                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                  <p className="text-sm text-muted-foreground">Chiedi qualsiasi cosa sul listino</p>
                                  <div className="mt-3 space-y-1.5">
                                    {["Quali modelli di forni sono disponibili?", "Qual è il prezzo del modello più costoso?", "Elenca tutti i prodotti con le specifiche tecniche"].map((suggestion) => (
                                      <button
                                        key={suggestion}
                                        className="block w-full text-left text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/5 transition-colors"
                                        onClick={() => { setSearchQuery(suggestion); }}
                                      >
                                        💡 {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {searchMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                  </div>
                                </div>
                              ))}
                              {searching && (
                                <div className="flex justify-start">
                                  <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Analizzo il listino...
                                  </div>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Es: Quanto costa il modello X?"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !searching) handleAiSearch(); }}
                              disabled={searching}
                            />
                            <Button size="icon" onClick={handleAiSearch} disabled={!searchQuery.trim() || searching}>
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div className="flex justify-end">
                  <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Aggiungi Prodotto</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nuovo Prodotto Competitor</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <Input placeholder="Nome prodotto *" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                        <Input placeholder="Modello" value={newProduct.model} onChange={(e) => setNewProduct({ ...newProduct, model: e.target.value })} />
                        <Input placeholder="Categoria" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
                        <Input placeholder="Prezzo" type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
                        <Textarea placeholder="Note" value={newProduct.notes} onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })} />
                        <Button onClick={() => addProduct.mutate()} disabled={!newProduct.name || addProduct.isPending} className="w-full">
                          {addProduct.isPending ? "Salvataggio..." : "Salva"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card>
                  <CardContent className="pt-4">
                    {products.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nessun prodotto. Aggiungi manualmente i prodotti competitor.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Modello</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Prezzo</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell>{p.model || "-"}</TableCell>
                              <TableCell>{p.category ? <Badge variant="outline">{p.category}</Badge> : "-"}</TableCell>
                              <TableCell className="text-right">{p.price != null ? `€ ${Number(p.price).toLocaleString("it-IT")}` : "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.notes || "-"}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteProduct.mutate(p.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Seleziona un Competitor</h3>
                <p className="text-muted-foreground text-sm">Seleziona un competitor dalla lista a sinistra o aggiungine uno nuovo per iniziare l'analisi.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
