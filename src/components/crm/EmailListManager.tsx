import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Upload, Users, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface EmailListContact {
  id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  email: string;
}

interface EmailList {
  id: string;
  name: string;
  description?: string;
  contact_count?: number;
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

      const contacts = jsonData.map((row: any) => ({
        email_list_id: currentListId,
        first_name: findColumn(row, ['Nome', 'First Name', 'first_name', 'FirstName', 'nome']),
        last_name: findColumn(row, ['Cognome', 'Last Name', 'last_name', 'LastName', 'cognome']),
        company: findColumn(row, ['Azienda', 'Company', 'company', 'azienda']),
        email: findColumn(row, ['Email', 'email', 'EMAIL', 'e-mail', 'E-mail', 'e_mail']),
      })).filter(contact => contact.email.trim());

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

      const { error } = await supabase
        .from('email_list_contacts')
        .upsert(contacts, { onConflict: 'email_list_id,email' });

      if (error) throw error;

      fetchListContacts(currentListId);
      fetchEmailLists();
      toast({
        title: "Successo",
        description: `${contacts.length} contatti importati con successo`,
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
                  </div>
                </div>
                <div className="flex gap-2">
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gestisci Contatti Lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Azienda</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>{contact.first_name}</TableCell>
                    <TableCell>{contact.last_name}</TableCell>
                    <TableCell>{contact.company}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteContact(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}