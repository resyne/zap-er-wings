import { useState } from "react";
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
import { Plus, Upload, Brain, Trash2, Globe, Building2, Package, FileText, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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

export default function CompetitorAnalysisPage() {
  const queryClient = useQueryClient();
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: "", website: "", country: "", notes: "" });
  const [newProduct, setNewProduct] = useState({ name: "", model: "", category: "", price: "", notes: "" });
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<CompetitorProduct[]>([]);

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

  const analyzePriceList = async (priceList: PriceList) => {
    setAnalyzing(true);
    setAiResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-competitor-pricelist", {
        body: { fileUrl: priceList.file_url, competitorId: selectedCompetitor?.id, fileName: priceList.file_name },
      });
      if (error) throw error;
      
      if (data?.products?.length) {
        setAiResults(data.products);
        toast.success(`${data.products.length} prodotti estratti dall'AI`);
      } else {
        toast.info("Nessun prodotto estratto dal listino");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Errore nell'analisi AI");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveAiResults = async () => {
    if (!selectedCompetitor || !aiResults.length) return;
    try {
      const toInsert = aiResults.map((p) => ({
        competitor_id: selectedCompetitor.id,
        name: p.name,
        model: p.model || null,
        category: p.category || null,
        price: p.price || null,
        currency: p.currency || "EUR",
        notes: p.notes || null,
        specifications: (p.specifications as any) || null,
      }));
      const { error } = await supabase.from("competitor_products").insert(toInsert as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["competitor-products"] });
      setAiResults([]);
      toast.success("Prodotti salvati nel database");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const deletePriceList = async (pl: PriceList) => {
    try {
      // Extract path from URL
      const urlParts = pl.file_url.split("/company-documents/");
      if (urlParts[1]) {
        await supabase.storage.from("company-documents").remove([urlParts[1]]);
      }
      const { error } = await supabase.from("competitor_price_lists").delete().eq("id", pl.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["competitor-price-lists"] });
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
          <p className="text-muted-foreground">Analizza listini e prodotti dei competitor con l'AI</p>
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
                  onClick={() => setSelectedCompetitor(c)}
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
            <Tabs defaultValue="products">
              <TabsList>
                <TabsTrigger value="products"><Package className="mr-2 h-4 w-4" /> Prodotti ({products.length})</TabsTrigger>
                <TabsTrigger value="pricelists"><FileText className="mr-2 h-4 w-4" /> Listini ({priceLists.length})</TabsTrigger>
              </TabsList>

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

                {/* AI Results */}
                {aiResults.length > 0 && (
                  <Card className="border-primary">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Prodotti estratti dall'AI ({aiResults.length})</CardTitle>
                        <Button onClick={saveAiResults} size="sm">Salva tutti nel database</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Modello</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Prezzo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aiResults.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell>{p.model || "-"}</TableCell>
                              <TableCell>{p.category ? <Badge variant="outline">{p.category}</Badge> : "-"}</TableCell>
                              <TableCell className="text-right">{p.price != null ? `€ ${p.price.toLocaleString("it-IT")}` : "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="pt-4">
                    {products.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nessun prodotto. Carica un listino e usa l'AI per estrarre i dati, oppure aggiungi manualmente.</p>
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

                <Card>
                  <CardContent className="pt-4">
                    {priceLists.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nessun listino caricato. Carica PDF, Excel o immagini dei listini competitor.</p>
                    ) : (
                      <div className="space-y-3">
                        {priceLists.map((pl) => (
                          <div key={pl.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{pl.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(pl.created_at), "dd MMM yyyy", { locale: it })}
                                  {pl.file_size && ` · ${(pl.file_size / 1024).toFixed(0)} KB`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => window.open(pl.file_url, "_blank")}>
                                <Eye className="mr-1 h-3.5 w-3.5" /> Vedi
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => analyzePriceList(pl)} disabled={analyzing}>
                                {analyzing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Brain className="mr-1 h-3.5 w-3.5" />}
                                Analizza con AI
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePriceList(pl)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
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
