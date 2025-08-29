
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, User, Wrench } from "lucide-react";
import { CreateContactDialog } from "@/components/support/CreateContactDialog";
import { SignatureCanvas } from "@/components/support/SignatureCanvas";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
}

export default function ServiceReportsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    intervention_type: '',
    description: '',
    work_performed: '',
    materials_used: '',
    notes: '',
    technician_name: '',
    intervention_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: ''
  });
  const [customerSignature, setCustomerSignature] = useState<string>('');
  const [technicianSignature, setTechnicianSignature] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, email, phone, company_name, address')
        .order('first_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei contatti",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    setSelectedContact(contact || null);
  };

  const handleContactCreated = (newContact: Contact) => {
    setContacts(prev => [...prev, newContact]);
    setSelectedContact(newContact);
    setShowCreateContact(false);
  };

  const generateReport = () => {
    if (!selectedContact || !formData.intervention_type || !formData.description) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Compila tutti i campi obbligatori prima di generare il rapporto",
        variant: "destructive",
      });
      return;
    }
    setShowSignatures(true);
  };

  const saveReport = async () => {
    if (!customerSignature || !technicianSignature) {
      toast({
        title: "Firme mancanti",
        description: "Entrambe le firme sono obbligatorie",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('service_reports')
        .insert({
          contact_id: selectedContact?.id,
          intervention_type: formData.intervention_type,
          description: formData.description,
          work_performed: formData.work_performed,
          materials_used: formData.materials_used,
          notes: formData.notes,
          technician_name: formData.technician_name,
          intervention_date: formData.intervention_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          customer_signature: customerSignature,
          technician_signature: technicianSignature,
          status: 'completed'
        });

      if (error) throw error;

      toast({
        title: "Rapporto salvato",
        description: "Il rapporto di intervento è stato salvato con successo",
      });

      // Reset form
      setFormData({
        intervention_type: '',
        description: '',
        work_performed: '',
        materials_used: '',
        notes: '',
        technician_name: '',
        intervention_date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: ''
      });
      setSelectedContact(null);
      setCustomerSignature('');
      setTechnicianSignature('');
      setShowSignatures(false);
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvare il rapporto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Rapporti di Intervento</h1>
        <p className="text-muted-foreground">
          Crea e gestisci rapporti di intervento tecnico con firma digitale
        </p>
      </div>

      {!showSignatures ? (
        <div className="space-y-6">
          {/* Selezione Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </CardTitle>
              <CardDescription>
                Seleziona un cliente esistente o creane uno nuovo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select onValueChange={handleContactSelect}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleziona un cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} 
                        {contact.company_name && ` - ${contact.company_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateContact(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Cliente
                </Button>
              </div>

              {selectedContact && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Cliente selezionato:</h4>
                  <p>{selectedContact.first_name} {selectedContact.last_name}</p>
                  {selectedContact.company_name && <p>{selectedContact.company_name}</p>}
                  {selectedContact.email && <p>Email: {selectedContact.email}</p>}
                  {selectedContact.phone && <p>Tel: {selectedContact.phone}</p>}
                  {selectedContact.address && <p>Indirizzo: {selectedContact.address}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dettagli Intervento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Dettagli Intervento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intervention_date">Data Intervento *</Label>
                  <Input
                    id="intervention_date"
                    type="date"
                    value={formData.intervention_date}
                    onChange={(e) => handleInputChange('intervention_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technician_name">Nome Tecnico *</Label>
                  <Input
                    id="technician_name"
                    value={formData.technician_name}
                    onChange={(e) => handleInputChange('technician_name', e.target.value)}
                    placeholder="Nome del tecnico"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Ora Inizio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Ora Fine</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intervention_type">Tipo Intervento *</Label>
                <Select onValueChange={(value) => handleInputChange('intervention_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo di intervento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manutenzione">Manutenzione</SelectItem>
                    <SelectItem value="riparazione">Riparazione</SelectItem>
                    <SelectItem value="installazione">Installazione</SelectItem>
                    <SelectItem value="collaudo">Collaudo</SelectItem>
                    <SelectItem value="consulenza">Consulenza</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione Problema *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrivi il problema riscontrato..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_performed">Lavori Eseguiti</Label>
                <Textarea
                  id="work_performed"
                  value={formData.work_performed}
                  onChange={(e) => handleInputChange('work_performed', e.target.value)}
                  placeholder="Descrivi i lavori eseguiti..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materials_used">Materiali Utilizzati</Label>
                <Textarea
                  id="materials_used"
                  value={formData.materials_used}
                  onChange={(e) => handleInputChange('materials_used', e.target.value)}
                  placeholder="Elenca i materiali utilizzati..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note Aggiuntive</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Note aggiuntive..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={generateReport} className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Genera Rapporto
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Firme Digitali</CardTitle>
            <CardDescription>
              Richiedi la firma del cliente e inserisci la tua firma per completare il rapporto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Firma Cliente</h3>
              <SignatureCanvas
                onSignatureChange={setCustomerSignature}
                placeholder="Il cliente deve firmare qui"
              />
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-medium mb-4">Firma Tecnico</h3>
              <SignatureCanvas
                onSignatureChange={setTechnicianSignature}
                placeholder="Il tecnico deve firmare qui"
              />
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setShowSignatures(false)}
              >
                Indietro
              </Button>
              <Button
                onClick={saveReport}
                disabled={loading || !customerSignature || !technicianSignature}
              >
                {loading ? "Salvando..." : "Salva Rapporto"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <CreateContactDialog
        open={showCreateContact}
        onOpenChange={setShowCreateContact}
        onContactCreated={handleContactCreated}
      />
    </div>
  );
}
