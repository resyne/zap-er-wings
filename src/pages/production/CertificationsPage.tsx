import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Search, FileCheck, Pencil, Trash2, FileText, Eye } from "lucide-react";

interface ConformityDeclaration {
  id: string;
  serial_number: string;
  declaration_date: string;
  model: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string;
  barrel_diameter: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
}

export default function CertificationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeclaration, setEditingDeclaration] = useState<ConformityDeclaration | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    serial_number: "",
    declaration_date: format(new Date(), "yyyy-MM-dd"),
    model: "",
    order_number: "",
    customer_name: "",
    barrel_diameter: "",
    notes: "",
  });

  // Generate new serial number
  const generateSerialNumber = () => {
    const year = new Date().getFullYear();
    const randomPart = Math.floor(Math.random() * 9000 + 1000);
    return `ZPZ-${year}-${randomPart}`;
  };

  // Auto-generate serial number when creating new declaration
  useEffect(() => {
    if (isDialogOpen && !editingDeclaration) {
      setFormData(prev => ({
        ...prev,
        serial_number: generateSerialNumber(),
        declaration_date: format(new Date(), "yyyy-MM-dd"),
      }));
    }
  }, [isDialogOpen, editingDeclaration]);

  // Fetch declarations
  const { data: declarations = [], isLoading } = useQuery({
    queryKey: ["conformity-declarations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conformity_declarations")
        .select("*")
        .order("declaration_date", { ascending: false });
      if (error) throw error;
      return data as ConformityDeclaration[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("conformity_declarations").insert({
        serial_number: data.serial_number,
        declaration_date: data.declaration_date,
        model: data.model,
        order_number: data.order_number || null,
        customer_name: data.customer_name || "N/D",
        barrel_diameter: data.barrel_diameter || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conformity-declarations"] });
      toast.success("Dichiarazione di conformità creata");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Errore nella creazione: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("conformity_declarations")
        .update({
          serial_number: data.serial_number,
          declaration_date: data.declaration_date,
          model: data.model,
          order_number: data.order_number || null,
          customer_name: data.customer_name,
          barrel_diameter: data.barrel_diameter || null,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conformity-declarations"] });
      toast.success("Dichiarazione aggiornata");
      resetForm();
      setIsDialogOpen(false);
      setEditingDeclaration(null);
    },
    onError: (error) => {
      toast.error("Errore nell'aggiornamento: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("conformity_declarations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conformity-declarations"] });
      toast.success("Dichiarazione eliminata");
    },
    onError: (error) => {
      toast.error("Errore nell'eliminazione: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      serial_number: generateSerialNumber(),
      declaration_date: format(new Date(), "yyyy-MM-dd"),
      model: "",
      order_number: "",
      customer_name: "",
      barrel_diameter: "",
      notes: "",
    });
  };

  const handleEdit = (declaration: ConformityDeclaration) => {
    setEditingDeclaration(declaration);
    setFormData({
      serial_number: declaration.serial_number,
      declaration_date: declaration.declaration_date,
      model: declaration.model,
      order_number: declaration.order_number || "",
      customer_name: declaration.customer_name,
      barrel_diameter: declaration.barrel_diameter || "",
      notes: declaration.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serial_number || !formData.model || !formData.barrel_diameter) {
      toast.error("Compila tutti i campi obbligatori (Matricola, Modello, Diametro Canne)");
      return;
    }
    if (editingDeclaration) {
      updateMutation.mutate({ id: editingDeclaration.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const generateDocument = async (declaration: ConformityDeclaration) => {
    try {
      // Fetch the template
      const response = await fetch('/templates/conformity-declaration-template.html');
      let template = await response.text();
      
      // Format the date
      const formattedDate = format(new Date(declaration.declaration_date), "dd/MM/yyyy", { locale: it });
      
      // Replace placeholders
      template = template.replace(/\{\{SERIAL_NUMBER\}\}/g, declaration.serial_number);
      template = template.replace(/\{\{DECLARATION_DATE\}\}/g, formattedDate);
      template = template.replace(/\{\{MODEL\}\}/g, declaration.model);
      template = template.replace(/\{\{BARREL_DIAMETER\}\}/g, declaration.barrel_diameter || "N/D");
      template = template.replace(/\{\{ORDER_NUMBER\}\}/g, declaration.order_number || "N/D");
      template = template.replace(/\{\{CUSTOMER_NAME\}\}/g, declaration.customer_name);
      
      setPreviewHtml(template);
      setIsPreviewOpen(true);
    } catch (error) {
      toast.error("Errore nella generazione del documento");
      console.error(error);
    }
  };

  const printDocument = () => {
    if (!previewHtml) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const filteredDeclarations = declarations.filter(
    (d) =>
      d.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.barrel_diameter && d.barrel_diameter.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.order_number && d.order_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Certificazioni</h1>
            <p className="text-muted-foreground">
              Gestione Dichiarazioni di Conformità
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingDeclaration(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuova Dichiarazione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingDeclaration ? "Modifica Dichiarazione" : "Nuova Dichiarazione di Conformità"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Matricola (auto)</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) =>
                      setFormData({ ...formData, serial_number: e.target.value })
                    }
                    placeholder="ZPZ-2026-0001"
                    readOnly={!editingDeclaration}
                    className={!editingDeclaration ? "bg-muted" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="declaration_date">Data (auto)</Label>
                  <Input
                    id="declaration_date"
                    type="date"
                    value={formData.declaration_date}
                    onChange={(e) =>
                      setFormData({ ...formData, declaration_date: e.target.value })
                    }
                    readOnly={!editingDeclaration}
                    className={!editingDeclaration ? "bg-muted" : ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="barrel_diameter">Diametro Canne *</Label>
                <Input
                  id="barrel_diameter"
                  value={formData.barrel_diameter}
                  onChange={(e) =>
                    setFormData({ ...formData, barrel_diameter: e.target.value })
                  }
                  placeholder="Es. 50mm, 60mm, 80mm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modello *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                  placeholder="Es. ZAPPER PRO 500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order_number">N. Ordine</Label>
                  <Input
                    id="order_number"
                    value={formData.order_number}
                    onChange={(e) =>
                      setFormData({ ...formData, order_number: e.target.value })
                    }
                    placeholder="Es. ORD-2026-123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Cliente</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_name: e.target.value })
                    }
                    placeholder="Nome cliente"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Note aggiuntive..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingDeclaration(null);
                    resetForm();
                  }}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingDeclaration ? "Aggiorna" : "Crea"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dichiarazioni di Conformità</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Caricamento...
            </div>
          ) : filteredDeclarations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessuna dichiarazione trovata
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricola</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Diametro Canne</TableHead>
                  <TableHead>Modello</TableHead>
                  <TableHead>N. Ordine</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeclarations.map((declaration) => (
                  <TableRow key={declaration.id}>
                    <TableCell className="font-medium font-mono">
                      {declaration.serial_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(declaration.declaration_date), "dd/MM/yyyy", {
                        locale: it,
                      })}
                    </TableCell>
                    <TableCell>{declaration.barrel_diameter || "-"}</TableCell>
                    <TableCell>{declaration.model}</TableCell>
                    <TableCell>{declaration.order_number || "-"}</TableCell>
                    <TableCell>{declaration.customer_name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => generateDocument(declaration)}
                          title="Genera Documento"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(declaration)}
                          title="Modifica"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Eliminare questa dichiarazione?")) {
                              deleteMutation.mutate(declaration.id);
                            }
                          }}
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Anteprima Dichiarazione di Conformità</span>
              <Button onClick={printDocument} className="mr-8">
                <FileText className="h-4 w-4 mr-2" />
                Stampa / PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            {previewHtml && (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[70vh]"
                title="Document Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
