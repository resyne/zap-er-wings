import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Upload, Users, Mail, Tag, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface CrmContact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company_name?: string;
  job_title?: string;
  tags?: string[];
}

export function ContactManager() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<CrmContact[]>([]);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const { toast } = useToast();

  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    company_name: '',
    job_title: '',
    tags: [] as string[]
  });

  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm, selectedTag]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContacts(data || []);
      
      // Estrai tutti i tag unici
      const allTags = (data || []).flatMap(contact => contact.tags || []);
      const uniqueTags = [...new Set(allTags)].sort();
      setAvailableTags(uniqueTags);

    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncContacts = async () => {
    try {
      setLoading(true);
      toast({
        title: "Sincronizzazione in corso...",
        description: "Sto sincronizzando i contatti dalle liste email, lead e partner",
      });

      const { data, error } = await supabase.functions.invoke('sync-contacts');

      if (error) throw error;

      await fetchContacts(); // Ricarica i contatti

      toast({
        title: "Sincronizzazione completata",
        description: `${data.stats.total} contatti sincronizzati (${data.stats.emailLists} da liste, ${data.stats.leads} lead, ${data.stats.partners} partner)`,
      });
    } catch (error) {
      console.error('Error syncing contacts:', error);
      toast({
        title: "Errore",
        description: "Errore durante la sincronizzazione dei contatti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    // Filtro per termine di ricerca
    if (searchTerm) {
      filtered = filtered.filter(contact => 
        (contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.job_title?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtro per tag
    if (selectedTag && selectedTag !== 'all') {
      filtered = filtered.filter(contact => 
        contact.tags && contact.tags.includes(selectedTag)
      );
    }

    setFilteredContacts(filtered);
  };

  const addContact = async () => {
    if (!newContact.email?.trim()) {
      toast({
        title: "Errore",
        description: "L'email è obbligatoria",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('crm_contacts')
        .insert([newContact]);

      if (error) throw error;

      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        mobile: '',
        company_name: '',
        job_title: '',
        tags: []
      });
      setShowAddContactDialog(false);
      fetchContacts();
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
        .from('crm_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      fetchContacts();
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

  const addTagToContact = (tag: string) => {
    if (tag && !newContact.tags.includes(tag)) {
      setNewContact(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
    setNewTag('');
  };

  const removeTagFromContact = (tagToRemove: string) => {
    setNewContact(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('sheet');
      
      if (!isExcel) {
        toast({
          title: "Errore",
          description: "Per favore carica un file Excel (.xlsx o .xls)",
          variant: "destructive",
        });
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const findColumn = (row: any, possibleNames: string[]) => {
        const keys = Object.keys(row);
        for (const name of possibleNames) {
          const key = keys.find(k => k.toLowerCase() === name.toLowerCase());
          if (key && row[key]) return row[key];
        }
        return '';
      };

      const processedContacts = jsonData.map((row: any) => {
        const tags = findColumn(row, ['Tag', 'Tags', 'tag', 'tags']);
        return {
          first_name: findColumn(row, ['Nome', 'First Name', 'first_name', 'FirstName', 'nome']),
          last_name: findColumn(row, ['Cognome', 'Last Name', 'last_name', 'LastName', 'cognome']),
          email: findColumn(row, ['Email', 'email', 'EMAIL', 'e-mail', 'E-mail', 'e_mail']),
          phone: findColumn(row, ['Telefono', 'Phone', 'phone', 'telefono']),
          mobile: findColumn(row, ['Cellulare', 'Mobile', 'mobile', 'cellulare']),
          company_name: findColumn(row, ['Azienda', 'Company', 'company', 'company_name', 'azienda']),
          job_title: findColumn(row, ['Ruolo', 'Job Title', 'job_title', 'position', 'ruolo']),
          tags: tags ? tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : []
        };
      }).filter(contact => contact.email?.trim());

      if (processedContacts.length === 0) {
        toast({
          title: "Errore",
          description: "Nessun contatto valido trovato nel file",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('crm_contacts')
        .upsert(processedContacts, { onConflict: 'email' });

      if (error) throw error;

      fetchContacts();
      toast({
        title: "Successo",
        description: `${processedContacts.length} contatti importati con successo`,
      });
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast({
        title: "Errore",
        description: "Impossibile importare i contatti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contatti CRM
          </CardTitle>
          <CardDescription>
            Gestisci tutti i contatti CRM con segmentazione per tag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtri e Azioni */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cerca contatti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtra per tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tag</SelectItem>
                  {availableTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSyncContacts}
                disabled={loading}
              >
                <Users className="mr-2 h-4 w-4" />
                Sincronizza Contatti
              </Button>
              
              <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Aggiungi Contatto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="phone">Telefono</Label>
                        <Input
                          id="phone"
                          value={newContact.phone}
                          onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile">Cellulare</Label>
                        <Input
                          id="mobile"
                          value={newContact.mobile}
                          onChange={(e) => setNewContact(prev => ({ ...prev, mobile: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="company">Azienda</Label>
                      <Input
                        id="company"
                        value={newContact.company_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, company_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="jobTitle">Ruolo</Label>
                      <Input
                        id="jobTitle"
                        value={newContact.job_title}
                        onChange={(e) => setNewContact(prev => ({ ...prev, job_title: e.target.value }))}
                      />
                    </div>
                    
                    {/* Gestione Tag */}
                    <div>
                      <Label>Tag</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Aggiungi tag..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addTagToContact(newTag)}
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={() => addTagToContact(newTag)}
                          disabled={!newTag.trim()}
                        >
                          <Tag className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {newContact.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTagFromContact(tag)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
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
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="contacts-excel-upload"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById('contacts-excel-upload')?.click()}
                  disabled={loading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importa Excel
                </Button>
              </div>
            </div>
          </div>

          {/* Statistiche */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Totale: {filteredContacts.length} contatti</span>
            {selectedTag && selectedTag !== 'all' && <span>Tag "{selectedTag}": {filteredContacts.length} contatti</span>}
          </div>

          {/* Tabella Contatti */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Azienda</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead className="w-20">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'N/A'}
                        </div>
                        {contact.job_title && (
                          <div className="text-sm text-muted-foreground">{contact.job_title}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {contact.email || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>{contact.company_name || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {contact.phone && <div>T: {contact.phone}</div>}
                        {contact.mobile && <div>M: {contact.mobile}</div>}
                        {!contact.phone && !contact.mobile && 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.tags && contact.tags.length > 0 ? (
                          contact.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">Nessun tag</span>
                        )}
                      </div>
                    </TableCell>
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
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm || selectedTag 
                        ? 'Nessun contatto trovato con i filtri attuali' 
                        : 'Nessun contatto disponibile'
                      }
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}