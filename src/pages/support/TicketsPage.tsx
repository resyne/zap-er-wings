import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, AlertCircle, CheckCircle, Clock, X, Trash2, Eye, Paperclip, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Ticket = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  customer_name: string;
  customer_id?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  attachments: string[] | null;
  watchers?: string[];
  assigned_user?: User | null;
};

const statusConfig = {
  open: { label: "Aperto", color: "bg-red-100 text-red-800", icon: AlertCircle },
  in_progress: { label: "In Lavorazione", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  resolved: { label: "Risolto", color: "bg-green-100 text-green-800", icon: CheckCircle },
  closed: { label: "Chiuso", color: "bg-gray-100 text-gray-800", icon: X }
};

const priorityConfig = {
  low: { label: "Bassa", color: "bg-blue-100 text-blue-800" },
  medium: { label: "Media", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "Alta", color: "bg-red-100 text-red-800" }
};

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedWatchers, setSelectedWatchers] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    customer: "",
    priority: "medium",
    description: ""
  });

  // Load users and tickets on component mount
  useEffect(() => {
    loadUsers();
    loadTickets();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Errore nel caricamento degli utenti');
    }
  };

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assigned_user:profiles!tickets_assigned_to_fkey(id, first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get watchers separately
      const ticketIds = data?.map(t => t.id) || [];
      const { data: watchersData } = await supabase
        .from('ticket_watchers')
        .select('ticket_id, user_id')
        .in('ticket_id', ticketIds);
      
      const watchersMap = (watchersData || []).reduce((acc, watcher) => {
        if (!acc[watcher.ticket_id]) acc[watcher.ticket_id] = [];
        acc[watcher.ticket_id].push(watcher.user_id);
        return acc;
      }, {} as Record<string, string[]>);
      
      const formattedTickets: Ticket[] = data?.map(ticket => ({
        ...ticket,
        watchers: watchersMap[ticket.id] || [],
        assigned_user: ticket.assigned_user as User | null
      })) || [];
      
      setTickets(formattedTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Errore nel caricamento dei ticket');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);
      
      if (error) throw error;
      
      setTickets(tickets.filter(ticket => ticket.id !== ticketId));
      toast.success("Ticket eliminato con successo");
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Errore nell\'eliminazione del ticket');
    }
  };

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailsDialogOpen(true);
  };

  const handleCreateTicket = async () => {
    if (!formData.title || !formData.customer) {
      toast.error('Inserisci almeno titolo e cliente');
      return;
    }

    try {
      // Create ticket (number will be auto-generated by trigger)
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          title: formData.title,
          description: formData.description || null,
          customer_name: formData.customer,
          priority: formData.priority,
          assigned_to: selectedAssignee === 'none' ? null : selectedAssignee || null,
          attachments: uploadedFiles.map(file => file.name)
        } as any)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Add watchers
      if (selectedWatchers.length > 0) {
        const watcherInserts = selectedWatchers.map(userId => ({
          ticket_id: ticketData.id,
          user_id: userId
        }));

        const { error: watchersError } = await supabase
          .from('ticket_watchers')
          .insert(watcherInserts);

        if (watchersError) throw watchersError;
      }

      // Reset form
      setFormData({ title: "", customer: "", priority: "medium", description: "" });
      setSelectedAssignee("none");
      setSelectedWatchers([]);
      setUploadedFiles([]);
      setIsCreateDialogOpen(false);
      
      // Reload tickets
      loadTickets();
      toast.success("Ticket creato con successo");
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Errore nella creazione del ticket');
    }
  };

  const toggleWatcher = (userId: string) => {
    setSelectedWatchers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestione Ticket</h1>
          <p className="text-muted-foreground">
            Gestisci segnalazioni e problematiche dei clienti
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Ticket</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli per creare un nuovo ticket di assistenza
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Titolo</Label>
                  <Input 
                    id="title" 
                    placeholder="Titolo del problema"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="customer">Cliente</Label>
                  <Input 
                    id="customer" 
                    placeholder="Nome cliente"
                    value={formData.customer}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priorità</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona priorità" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Bassa</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigned">Assegnato a</Label>
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Watcher (utenti che monitoreranno il ticket)
                </Label>
                <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`watcher-${user.id}`}
                        checked={selectedWatchers.includes(user.id)}
                        onChange={() => toggleWatcher(user.id)}
                        className="rounded"
                      />
                      <Label htmlFor={`watcher-${user.id}`} className="text-sm font-normal cursor-pointer">
                        {user.first_name} {user.last_name} ({user.email})
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedWatchers.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedWatchers.length} utente{selectedWatchers.length > 1 ? 'i' : ''} selezionat{selectedWatchers.length > 1 ? 'i' : 'o'}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Descrizione</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descrizione dettagliata del problema"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div>
                <Label>Allega File</Label>
                <FileUpload
                  value={uploadedFiles}
                  onChange={setUploadedFiles}
                  maxFiles={5}
                  acceptedFileTypes={["image/*", ".pdf", ".doc", ".docx"]}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleCreateTicket}>
                Crea Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtri */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca ticket..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="open">Aperto</SelectItem>
            <SelectItem value="in_progress">In Lavorazione</SelectItem>
            <SelectItem value="resolved">Risolto</SelectItem>
            <SelectItem value="closed">Chiuso</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtra per priorità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le priorità</SelectItem>
            <SelectItem value="low">Bassa</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground flex items-center">
          Totale: {filteredTickets.length} ticket
        </div>
      </div>

      {/* Lista Ticket */}
      <div className="grid gap-4">
        {filteredTickets.map((ticket) => {
          const StatusIcon = statusConfig[ticket.status as keyof typeof statusConfig].icon;
          
          return (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1" onClick={() => handleViewTicket(ticket)}>
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">{ticket.title}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {ticket.number}
                      </Badge>
                      {ticket.attachments && ticket.attachments.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Paperclip className="w-3 h-3 mr-1" />
                          {ticket.attachments.length}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {ticket.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTicket(ticket);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare il ticket "{ticket.title}"? 
                              Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)}>
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <Badge className={statusConfig[ticket.status as keyof typeof statusConfig].color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig[ticket.status as keyof typeof statusConfig].label}
                    </Badge>
                    <Badge variant="outline" className={priorityConfig[ticket.priority as keyof typeof priorityConfig].color}>
                      {priorityConfig[ticket.priority as keyof typeof priorityConfig].label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <div className="flex gap-4">
                    <span><strong>Cliente:</strong> {ticket.customer_name}</span>
                    <span><strong>Assegnato a:</strong> {
                      ticket.assigned_user 
                        ? `${ticket.assigned_user.first_name} ${ticket.assigned_user.last_name}`
                        : 'Da assegnare'
                    }</span>
                    {ticket.watchers && ticket.watchers.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {ticket.watchers.length} watcher{ticket.watchers.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTickets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nessun ticket trovato con i filtri selezionati.</p>
        </div>
      )}

      {/* Dialog Dettagli Ticket */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">{selectedTicket?.number}</Badge>
              {selectedTicket?.title}
            </DialogTitle>
            <DialogDescription>
              Dettagli completi del ticket di assistenza
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTicket.customer_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Assegnato a</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTicket.assigned_user 
                      ? `${selectedTicket.assigned_user.first_name} ${selectedTicket.assigned_user.last_name}`
                      : 'Da assegnare'
                    }
                  </p>
                </div>
              </div>

              {selectedTicket.watchers && selectedTicket.watchers.length > 0 && (
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Watchers ({selectedTicket.watchers.length})
                  </Label>
                  <div className="mt-2 space-y-1">
                    {selectedTicket.watchers.map((watcherId: string) => {
                      const watcher = users.find(u => u.id === watcherId);
                      return watcher ? (
                        <div key={watcherId} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserPlus className="w-3 h-3" />
                          {watcher.first_name} {watcher.last_name} ({watcher.email})
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Stato</Label>
                  <div className="mt-1">
                    <Badge className={statusConfig[selectedTicket.status as keyof typeof statusConfig].color}>
                      {statusConfig[selectedTicket.status as keyof typeof statusConfig].label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Priorità</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={priorityConfig[selectedTicket.priority as keyof typeof priorityConfig].color}>
                      {priorityConfig[selectedTicket.priority as keyof typeof priorityConfig].label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Data Creazione</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(selectedTicket.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Descrizione</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  <p className="text-sm">{selectedTicket.description}</p>
                </div>
              </div>

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">File Allegati</Label>
                  <div className="mt-2 space-y-2">
                    {selectedTicket.attachments.map((attachment: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{attachment}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}