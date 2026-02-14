import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, Building2, Phone, Mail, MapPin, Edit, Trash2, Copy, RefreshCw, Key, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  payment_terms: number;
  active: boolean;
  access_code?: string;
  contact_name?: string;
  contact_email?: string;
  created_at?: string;
  updated_at?: string;
}

const supplierSchema = z.object({
  name: z.string().min(1, "Nome richiesto"),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  tax_id: z.string().optional(),
  payment_terms: z.number().min(0, "Giorni di pagamento devono essere positivi"),
  contact_name: z.string().optional(),
  contact_email: z.string().email("Email non valida").optional().or(z.literal("")),
});

const SuppliersPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<z.infer<typeof supplierSchema>>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      tax_id: "",
      payment_terms: 30,
      contact_name: "",
      contact_email: "",
    },
  });

  const editForm = useForm<z.infer<typeof supplierSchema>>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      tax_id: "",
      payment_terms: 30,
      contact_name: "",
      contact_email: "",
    },
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        toast({
          title: "Errore",
          description: "Errore nel caricamento dei fornitori",
          variant: "destructive",
        });
        return;
      }

      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei fornitori",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const onSubmit = async (values: z.infer<typeof supplierSchema>) => {
    try {
      // Generate a simple code since there's no auto-generation trigger
      const supplierCode = `SUP${Date.now().toString().slice(-6)}`;
      
      const supplierData = {
        code: supplierCode,
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        country: values.country || null,
        tax_id: values.tax_id || null,
        payment_terms: values.payment_terms,
        active: true,
        access_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        contact_name: values.contact_name || null,
        contact_email: values.contact_email || null,
      };

      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplierData)
        .select();

      if (error) {
        console.error('Error creating supplier:', error);
        toast({
          title: "Errore",
          description: "Errore nella creazione del fornitore",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Fornitore creato con successo",
      });

      setIsDialogOpen(false);
      form.reset();
      fetchSuppliers();
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione del fornitore",
        variant: "destructive",
      });
    }
  };

  const onEditSubmit = async (values: z.infer<typeof supplierSchema>) => {
    if (!selectedSupplier) return;

    try {
      const updateData = {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        country: values.country || null,
        tax_id: values.tax_id || null,
        payment_terms: values.payment_terms,
        contact_name: values.contact_name || null,
        contact_email: values.contact_email || null,
      };

      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', selectedSupplier.id);

      if (error) {
        console.error('Error updating supplier:', error);
        toast({
          title: "Errore",
          description: "Errore nell'aggiornamento del fornitore",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Fornitore aggiornato con successo",
      });

      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      editForm.reset();
      fetchSuppliers();
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento del fornitore",
        variant: "destructive",
      });
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    editForm.reset({
      name: supplier.name,
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      tax_id: supplier.tax_id || "",
      payment_terms: supplier.payment_terms,
      contact_name: supplier.contact_name || "",
      contact_email: supplier.contact_email || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Sei sicuro di voler eliminare il fornitore ${supplier.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) {
        console.error('Error deleting supplier:', error);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione del fornitore",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Fornitore eliminato con successo",
      });

      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del fornitore",
        variant: "destructive",
      });
    }
  };

  const handleCopyAccessCode = (accessCode: string) => {
    navigator.clipboard.writeText(accessCode);
    toast({
      title: "Copiato!",
      description: "Codice di accesso copiato negli appunti",
    });
  };

  const handleRegenerateAccessCode = async (supplier: Supplier) => {
    if (!confirm(`Sei sicuro di voler rigenerare il codice di accesso per ${supplier.name}? Il vecchio codice non funzionerà più.`)) {
      return;
    }

    try {
      const newAccessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { error } = await supabase
        .from('suppliers')
        .update({ access_code: newAccessCode })
        .eq('id', supplier.id);

      if (error) {
        console.error('Error regenerating access code:', error);
        toast({
          title: "Errore",
          description: "Errore nella rigenerazione del codice",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: `Nuovo codice: ${newAccessCode}`,
      });

      fetchSuppliers();
    } catch (error) {
      console.error('Error regenerating access code:', error);
      toast({
        title: "Errore",
        description: "Errore nella rigenerazione del codice",
        variant: "destructive",
      });
    }
  };

  const handleCopyPortalLink = (supplier: Supplier) => {
    const portalUrl = `https://erp.abbattitorizapper.it/supplier/${supplier.id}`;
    navigator.clipboard.writeText(portalUrl);
    toast({
      title: "Link copiato!",
      description: "Link del portale fornitore copiato negli appunti",
    });
  };

  if (loading) {
    return <div className="p-8 text-center">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornitori</h1>
          <p className="text-muted-foreground">
            Gestisci l'anagrafica dei tuoi fornitori
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Fornitore
            </Button>
          </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Fornitore</DialogTitle>
              <DialogDescription>
                Inserisci i dati del nuovo fornitore qui sotto.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Fornitore *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona di Contatto</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Persona di Contatto</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indirizzo</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Città</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partita IVA</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Giorni Pagamento</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button type="submit">Salva Fornitore</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifica Fornitore</DialogTitle>
              <DialogDescription>
                Modifica i dati del fornitore selezionato.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Fornitore *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona di Contatto</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Persona di Contatto</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indirizzo</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Città</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partita IVA</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="payment_terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Giorni Pagamento</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button type="submit">Aggiorna Fornitore</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornitori Attivi</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.filter(s => s.active).length}</div>
            <p className="text-xs text-muted-foreground">
              +2 dal mese scorso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Fornitori</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">
              Nel database
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamento Medio</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {suppliers.length > 0 ? Math.round(suppliers.reduce((acc, s) => acc + s.payment_terms, 0) / suppliers.length) : 0} gg
            </div>
            <p className="text-xs text-muted-foreground">
              Giorni di pagamento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornitori Inattivi</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.filter(s => !s.active).length}</div>
            <p className="text-xs text-muted-foreground">
              Da riattivare
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Fornitori</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutti i tuoi fornitori
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca fornitori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contatti</TableHead>
                <TableHead>Indirizzo</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Codice Accesso</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.code}</TableCell>
                   <TableCell>
                     <div>
                       <div className="font-medium">{supplier.name}</div>
                       <div className="text-sm text-muted-foreground">{supplier.tax_id}</div>
                     </div>
                   </TableCell>
                   <TableCell>
                     <div className="space-y-1">
                       {supplier.email && (
                         <div className="flex items-center text-sm">
                           <Mail className="mr-1 h-3 w-3" />
                           {supplier.email}
                         </div>
                       )}
                       {supplier.phone && (
                         <div className="flex items-center text-sm">
                           <Phone className="mr-1 h-3 w-3" />
                           {supplier.phone}
                         </div>
                       )}
                       {(supplier.contact_name || supplier.contact_email) && (
                         <div className="pt-1 mt-1 border-t space-y-1">
                           {supplier.contact_name && (
                             <div className="text-xs text-muted-foreground">
                               {supplier.contact_name}
                             </div>
                           )}
                           {supplier.contact_email && (
                             <div className="flex items-center text-xs text-muted-foreground">
                               <Mail className="mr-1 h-3 w-3" />
                               {supplier.contact_email}
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   </TableCell>
                   <TableCell>
                     {(supplier.address || supplier.city || supplier.country) && (
                       <div className="flex items-center text-sm">
                         <MapPin className="mr-1 h-3 w-3" />
                         <div>
                           {supplier.address && <div>{supplier.address}</div>}
                           {(supplier.city || supplier.country) && (
                             <div className="text-muted-foreground">
                               {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                   </TableCell>
                   <TableCell>{supplier.payment_terms} giorni</TableCell>
                   <TableCell>
                     {supplier.access_code ? (
                       <div className="space-y-2">
                         <div className="flex items-center gap-2">
                           <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md font-mono text-sm">
                             <Key className="h-3 w-3 text-muted-foreground" />
                             {supplier.access_code}
                           </div>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleCopyAccessCode(supplier.access_code!)}
                             title="Copia codice"
                           >
                             <Copy className="h-3 w-3" />
                           </Button>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleRegenerateAccessCode(supplier)}
                             title="Rigenera codice"
                           >
                             <RefreshCw className="h-3 w-3" />
                           </Button>
                         </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground break-all select-all">
                              {`https://erp.abbattitorizapper.it/supplier/${supplier.id}`}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyPortalLink(supplier)}
                              className="w-full text-xs gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Copia Link Portale
                            </Button>
                          </div>
                       </div>
                     ) : (
                       <span className="text-muted-foreground text-sm">Nessun codice</span>
                     )}
                   </TableCell>
                  <TableCell>
                    <Badge variant={supplier.active ? "default" : "secondary"}>
                      {supplier.active ? "Attivo" : "Inattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSupplier(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSupplier(supplier)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuppliersPage;