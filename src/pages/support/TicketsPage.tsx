import { useState } from "react";
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
import { Plus, Search, AlertCircle, CheckCircle, Clock, X, Trash2, Eye, Paperclip } from "lucide-react";
import { toast } from "sonner";

// Mock data for tickets
const mockTickets = [
  {
    id: "1",
    number: "TCK-2024-001",
    title: "Problema con forno a convezione",
    description: "Il forno non raggiunge la temperatura impostata",
    status: "open",
    priority: "high",
    customer: "Ristorante Da Mario",
    created_at: "2024-01-15",
    assigned_to: "Marco Rossi",
    attachments: ["forno_foto1.jpg", "diagnostica.pdf"]
  },
  {
    id: "2", 
    number: "TCK-2024-002",
    title: "Abbattitore che perde acqua",
    description: "Si forma una pozza d'acqua sotto l'abbattitore",
    status: "in_progress",
    priority: "medium",
    customer: "Pizzeria Bella Napoli",
    created_at: "2024-01-14",
    assigned_to: "Luca Bianchi",
    attachments: ["perdita_acqua.jpg"]
  },
  {
    id: "3",
    number: "TCK-2024-003", 
    title: "Manutenzione programmata",
    description: "Controllo semestrale di tutti gli impianti",
    status: "resolved",
    priority: "low",
    customer: "Hotel Grand Palace",
    created_at: "2024-01-10",
    assigned_to: "Anna Verdi",
    attachments: []
  }
];

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
  const [tickets, setTickets] = useState(mockTickets);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleDeleteTicket = (ticketId: string) => {
    setTickets(tickets.filter(ticket => ticket.id !== ticketId));
    toast.success("Ticket eliminato con successo");
  };

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsDetailsDialogOpen(true);
  };

  const handleCreateTicket = () => {
    // In a real app, this would make an API call
    const newTicket = {
      id: Date.now().toString(),
      number: `TCK-2024-${String(tickets.length + 1).padStart(3, '0')}`,
      title: "Nuovo ticket",
      description: "Descrizione del nuovo ticket",
      status: "open",
      priority: "medium",
      customer: "Cliente Test",
      created_at: new Date().toISOString().split('T')[0],
      assigned_to: "Da assegnare",
      attachments: uploadedFiles.map(file => file.name)
    };
    
    setTickets([...tickets, newTicket]);
    setUploadedFiles([]);
    setIsCreateDialogOpen(false);
    toast.success("Ticket creato con successo");
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
                  <Input id="title" placeholder="Titolo del problema" />
                </div>
                <div>
                  <Label htmlFor="customer">Cliente</Label>
                  <Input id="customer" placeholder="Nome cliente" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priorità</Label>
                  <Select>
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
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tecnico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marco">Marco Rossi</SelectItem>
                      <SelectItem value="luca">Luca Bianchi</SelectItem>
                      <SelectItem value="anna">Anna Verdi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Descrizione</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descrizione dettagliata del problema"
                  rows={4}
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
                    <span><strong>Cliente:</strong> {ticket.customer}</span>
                    <span><strong>Assegnato a:</strong> {ticket.assigned_to}</span>
                  </div>
                  <span>{ticket.created_at}</span>
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
                  <p className="text-sm text-muted-foreground mt-1">{selectedTicket.customer}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Assegnato a</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTicket.assigned_to}</p>
                </div>
              </div>
              
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
                  <p className="text-sm text-muted-foreground mt-1">{selectedTicket.created_at}</p>
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