import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Upload, Users, Mail, Loader, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface EmailListContact {
  id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  email: string;
  phone?: string;
  city?: string;
}

interface EmailList {
  id: string;
  name: string;
  description?: string;
  contact_count?: number;
  auto_sync_leads?: boolean;
  auto_sync_customers?: boolean;
}

interface EmailListManagerProps {
  onListSelect: (listId: string, contactCount: number) => void;
  selectedListId?: string;
}


export function EmailListManager({ onListSelect, selectedListId }: EmailListManagerProps) {
  const [emailLists, setEmailLists] = useState<EmailList[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<EmailListContact[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showContactsDialog, setShowContactsDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [currentListId, setCurrentListId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [newList, setNewList] = useState({ name: '', description: '' });
  const [newContact, setNewContact] = useState({ 
    first_name: '', 
    last_name: '', 
    company: '', 
    email: '' 
  });

  useEffect(() => {
    fetchEmailLists();
  }, []);

  const fetchEmailLists = async () => {
    try {
      const { data: lists, error } = await supabase
        .from('email_lists')
        .select(`
          id,
          name,
          description,
          auto_sync_leads,
          auto_sync_customers,
          email_list_contacts(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLists = lists?.map(list => ({
        ...list,
        contact_count: list.email_list_contacts?.[0]?.count || 0
      })) || [];

      setEmailLists(formattedLists);
    } catch (error) {
      console.error('Error fetching email lists:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le liste email",
        variant: "destructive",
      });
    }
  };

  const toggleAutoSync = async (listId: string, field: 'auto_sync_leads' | 'auto_sync_customers', value: boolean) => {
    try {
      const { error } = await supabase
        .from('email_lists')
        .update({ [field]: value } as any)
        .eq('id', listId);
      if (error) throw error;
      fetchEmailLists();
      toast({ title: "Aggiornato", description: `Auto-sync ${field === 'auto_sync_leads' ? 'lead' : 'clienti'} ${value ? 'attivato' : 'disattivato'}` });
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare", variant: "destructive" });
    }
  };

  const syncExistingLeads = async (listId: string) => {
    try {
      setLoading(true);
      // Fetch all leads with email
      let allLeads: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('leads')
          .select('email, contact_name, company_name')
          .not('email', 'is', null)
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLeads = [...allLeads, ...data];
        if (data.length < batchSize) break;
        from += batchSize;
      }

      const contacts = allLeads
        .filter(l => l.email?.trim())
        .map(l => ({
          email_list_id: listId,
          email: l.email.trim(),
          first_name: l.contact_name || null,
          company: l.company_name || null,
        }));

      // Deduplicate
      const unique = contacts.filter((c, i, self) => 
        i === self.findIndex(x => x.email.toLowerCase() === c.email.toLowerCase())
      );

      if (unique.length === 0) {
        toast({ title: "Info", description: "Nessun lead con email trovato" });
        return;
      }

      // Upsert in batches
      for (let i = 0; i < unique.length; i += 500) {
        const batch = unique.slice(i, i + 500);
        const { error } = await supabase
          .from('email_list_contacts')
          .upsert(batch, { onConflict: 'email_list_id,email' });
        if (error) throw error;
      }

      fetchEmailLists();
      toast({ title: "Sincronizzazione completata", description: `${unique.length} contatti lead importati nella lista` });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createEmailList = async () => {
    if (!newList.name.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('email_lists')
        .insert([newList]);

      if (error) throw error;

      setNewList({ name: '', description: '' });
      setShowCreateDialog(false);
      fetchEmailLists();
      toast({
        title: "Successo",
        description: "Lista email creata con successo",
      });
    } catch (error) {
      console.error('Error creating email list:', error);
      toast({
        title: "Errore",
        description: "Impossibile creare la lista email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteEmailList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from('email_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      fetchEmailLists();
      toast({
        title: "Successo",
        description: "Lista email eliminata con successo",
      });
    } catch (error) {
      console.error('Error deleting email list:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la lista email",
        variant: "destructive",
      });
    }
  };

  const fetchListContacts = async (listId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_list_contacts')
        .select('*')
        .eq('email_list_id', listId)
        .order('email');

      if (error) throw error;

      setSelectedContacts(data || []);
      setCurrentListId(listId);
      setShowContactsDialog(true);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive",
      });
    }
  };

  const addContact = async () => {
    if (!newContact.email.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('email_list_contacts')
        .insert([{ ...newContact, email_list_id: currentListId }]);

      if (error) throw error;

      setNewContact({ first_name: '', last_name: '', company: '', email: '' });
      setShowAddContactDialog(false);
      fetchListContacts(currentListId);
      fetchEmailLists();
      toast({
        title: "Successo",
        description: "Contatto aggiunto con successo",
      });
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il contatto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('email_list_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      fetchListContacts(currentListId);
      fetchEmailLists();
      toast({
        title: "Successo",
        description: "Contatto eliminato con successo",
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contatto",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentListId) return;

    console.log('File selected:', file.name, file.type, file.size);

    try {
      setLoading(true);
      
      // Check if file is Excel format
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('sheet');
      console.log('Is Excel file?', isExcel);
      
      if (!isExcel) {
        toast({
          title: "Errore",
          description: "Per favore carica un file Excel (.xlsx o .xls)",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const data = await file.arrayBuffer();
      console.log('File buffer size:', data.byteLength);
      
      const workbook = XLSX.read(data);
      console.log('Workbook sheets:', workbook.SheetNames);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log('Total rows in Excel:', jsonData.length);

      console.log('Raw Excel data:', jsonData);
      console.log('First row keys:', jsonData.length > 0 ? Object.keys(jsonData[0]) : []);

      // Find email column by checking various possible names (case insensitive)
      const findColumn = (row: any, possibleNames: string[]) => {
        const keys = Object.keys(row);
        for (const name of possibleNames) {
          const key = keys.find(k => k.toLowerCase() === name.toLowerCase());
          if (key && row[key]) return row[key];
        }
        return '';
      };

      const contacts = jsonData.map((row: any) => {
        // Handle "nome e cognome" in a single cell - split into first/last name
        const fullName = findColumn(row, ['Nome e Cognome', 'Nome Cognome', 'Full Name', 'full_name', 'Name', 'name', 'nome e cognome', 'nominativo', 'Nominativo']);
        let firstName = findColumn(row, ['Nome', 'First Name', 'first_name', 'FirstName', 'nome']);
        let lastName = findColumn(row, ['Cognome', 'Last Name', 'last_name', 'LastName', 'cognome']);
        
        // If we have a full name but no separate first/last, split it
        if (fullName && !firstName && !lastName) {
          const parts = String(fullName).trim().split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        return {
          email_list_id: currentListId,
          first_name: firstName ? String(firstName) : '',
          last_name: lastName ? String(lastName) : '',
          company: findColumn(row, ['Azienda', 'Company', 'company', 'azienda']),
          email: findColumn(row, ['Email', 'email', 'EMAIL', 'e-mail', 'E-mail', 'e_mail', 'Indirizzo email', 'indirizzo email', 'Email Address']),
          phone: findColumn(row, ['Telefono', 'Phone', 'phone', 'Tel', 'tel', 'Numero di telefono', 'numero di telefono', 'Phone Number', 'Cellulare', 'cellulare', 'Mobile']),
          city: findColumn(row, ['Città', 'City', 'city', 'città', 'Comune', 'comune', 'Address', 'address', 'Indirizzo', 'indirizzo']),
        };
      }).filter(contact => contact.email && String(contact.email).trim());

      console.log('Processed contacts:', contacts);

      if (contacts.length === 0) {
        const sampleRow = jsonData.length > 0 ? jsonData[0] : {};
        const availableColumns = Object.keys(sampleRow).join(', ');
        toast({
          title: "Errore",
          description: `Nessun contatto valido trovato nel file. Colonne disponibili: ${availableColumns}`,
          variant: "destructive",
        });
        return;
      }

      // Rimuovi duplicati basati su email
      const uniqueContacts = contacts.filter((contact, index, self) => 
        index === self.findIndex(c => c.email.toLowerCase() === contact.email.toLowerCase())
      );

      console.log('Unique contacts after duplicate removal:', uniqueContacts);
      console.log('Removed duplicates:', contacts.length - uniqueContacts.length);

      const { error } = await supabase
        .from('email_list_contacts')
        .upsert(uniqueContacts, { onConflict: 'email_list_id,email' });

      if (error) throw error;

      fetchListContacts(currentListId);
      fetchEmailLists();
      toast({
        title: "Successo",
        description: `${uniqueContacts.length} contatti importati con successo${contacts.length > uniqueContacts.length ? ` (${contacts.length - uniqueContacts.length} duplicati ignorati)` : ''}`,
      });
    } catch (error) {
      console.error('Error importing contacts:', error);
      console.error('Error details:', error);
      toast({
        title: "Errore",
        description: `Impossibile importare i contatti: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Liste Email Personalizzate</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuova Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea Nuova Lista Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="listName">Nome Lista</Label>
                <Input
                  id="listName"
                  value={newList.name}
                  onChange={(e) => setNewList(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome della lista..."
                />
              </div>
              <div>
                <Label htmlFor="listDescription">Descrizione</Label>
                <Textarea
                  id="listDescription"
                  value={newList.description}
                  onChange={(e) => setNewList(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione opzionale..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createEmailList} disabled={loading || !newList.name.trim()}>
                  Crea Lista
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Annulla
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {emailLists.map((list) => (
          <Card key={list.id} className={`cursor-pointer transition-colors ${
            selectedListId === list.id ? 'ring-2 ring-primary' : ''
          }`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div 
                  className="flex-1"
                  onClick={() => onListSelect(list.id, list.contact_count || 0)}
                >
                  <h4 className="font-medium">{list.name}</h4>
                  {list.description && (
                    <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {list.contact_count || 0} contatti
                    </span>
                    {list.auto_sync_leads && (
                      <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                        <Zap className="h-3 w-3 mr-1" />Auto-sync Lead
                      </Badge>
                    )}
                    {list.auto_sync_customers && (
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600">
                        <Zap className="h-3 w-3 mr-1" />Auto-sync Clienti
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex flex-col gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={list.auto_sync_leads || false}
                        onCheckedChange={(v) => toggleAutoSync(list.id, 'auto_sync_leads', v)}
                        className="scale-75"
                      />
                      <span className="text-[10px] text-muted-foreground">Lead</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={list.auto_sync_customers || false}
                        onCheckedChange={(v) => toggleAutoSync(list.id, 'auto_sync_customers', v)}
                        className="scale-75"
                      />
                      <span className="text-[10px] text-muted-foreground">Clienti</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); syncExistingLeads(list.id); }}
                    disabled={loading}
                    title="Importa tutti i lead esistenti"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchListContacts(list.id)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteEmailList(list.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contacts Dialog */}
      <Dialog open={showContactsDialog} onOpenChange={setShowContactsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Gestisci Contatti Lista</span>
              <Badge variant="secondary" className="ml-2">{selectedContacts.length} contatti</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex flex-col flex-1 min-h-0">
            <div className="flex gap-2 flex-shrink-0">
              <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi Contatto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Contatto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="firstName">Nome</Label>
                      <Input
                        id="firstName"
                        value={newContact.first_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Cognome</Label>
                      <Input
                        id="lastName"
                        value={newContact.last_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Azienda</Label>
                      <Input
                        id="company"
                        value={newContact.company}
                        onChange={(e) => setNewContact(prev => ({ ...prev, company: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addContact} disabled={loading || !newContact.email.trim()}>
                        Aggiungi
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddContactDialog(false)}>
                        Annulla
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="excel-upload"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById('excel-upload')?.click()}
                  disabled={loading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importa Excel
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Azienda</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[60px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '-'}
                      </TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell className="text-sm">{contact.email}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {selectedContacts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nessun contatto in questa lista. Aggiungi contatti manualmente o importa da Excel.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}