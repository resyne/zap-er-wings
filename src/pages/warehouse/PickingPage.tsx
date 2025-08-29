import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Package, MapPin, Clock, CheckCircle, AlertTriangle, User, Truck } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface PickingList {
  id: string;
  pick_list_number: string;
  order_reference: string;
  customer_name: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  assigned_to?: string;
  created_date: string;
  due_date: string;
  completed_date?: string;
  total_items: number;
  picked_items: number;
  progress: number;
  notes?: string;
}

interface PickingItem {
  id: string;
  pick_list_id: string;
  item_code: string;
  item_name: string;
  location: string;
  quantity_requested: number;
  quantity_picked: number;
  unit: string;
  status: "pending" | "partial" | "picked" | "unavailable";
  notes?: string;
  picked_by?: string;
  picked_at?: string;
}

export default function PickingPage() {
  const [pickingLists, setPickingLists] = useState<PickingList[]>([]);
  const [pickingItems, setPickingItems] = useState<PickingItem[]>([]);
  const [selectedPickList, setSelectedPickList] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  useEffect(() => {
    const mockPickingLists: PickingList[] = [
      {
        id: "1",
        pick_list_number: "PL-2024-001",
        order_reference: "SO-2024-005",
        customer_name: "Cliente ABC S.r.l.",
        priority: "high",
        status: "in_progress",
        assigned_to: "Giuseppe Verde",
        created_date: "2024-01-25T08:00:00Z",
        due_date: "2024-01-25T16:00:00Z",
        total_items: 5,
        picked_items: 3,
        progress: 60,
        notes: "Urgente per spedizione giornaliera"
      },
      {
        id: "2",
        pick_list_number: "PL-2024-002",
        order_reference: "SO-2024-006",
        customer_name: "Azienda XYZ",
        priority: "medium",
        status: "pending",
        created_date: "2024-01-25T09:30:00Z",
        due_date: "2024-01-26T12:00:00Z",
        total_items: 8,
        picked_items: 0,
        progress: 0,
        notes: ""
      },
      {
        id: "3",
        pick_list_number: "PL-2024-003",
        order_reference: "SO-2024-004",
        customer_name: "Tecno Service",
        priority: "urgent",
        status: "completed",
        assigned_to: "Laura Bianchi",
        created_date: "2024-01-24T10:00:00Z",
        due_date: "2024-01-24T15:00:00Z",
        completed_date: "2024-01-24T14:30:00Z",
        total_items: 3,
        picked_items: 3,
        progress: 100,
        notes: "Completato in anticipo"
      }
    ];

    const mockPickingItems: PickingItem[] = [
      {
        id: "1",
        pick_list_id: "1",
        item_code: "ITM-001",
        item_name: "Filtro acqua standard",
        location: "A-01-A",
        quantity_requested: 10,
        quantity_picked: 10,
        unit: "pcs",
        status: "picked",
        picked_by: "Giuseppe Verde",
        picked_at: "2024-01-25T09:15:00Z"
      },
      {
        id: "2",
        pick_list_id: "1",
        item_code: "ITM-002",
        item_name: "Cartuccia carboni attivi",
        location: "A-01-B",
        quantity_requested: 5,
        quantity_picked: 3,
        unit: "pcs",
        status: "partial",
        notes: "Solo 3 disponibili, rimanenti in ordine",
        picked_by: "Giuseppe Verde",
        picked_at: "2024-01-25T09:30:00Z"
      },
      {
        id: "3",
        pick_list_id: "1",
        item_code: "ITM-003",
        item_name: "Valvola di sicurezza",
        location: "B-02-A",
        quantity_requested: 2,
        quantity_picked: 2,
        unit: "pcs",
        status: "picked",
        picked_by: "Giuseppe Verde",
        picked_at: "2024-01-25T10:00:00Z"
      },
      {
        id: "4",
        pick_list_id: "1",
        item_code: "ITM-004",
        item_name: "Guarnizione O-ring",
        location: "C-03-B",
        quantity_requested: 20,
        quantity_picked: 0,
        unit: "pcs",
        status: "pending"
      },
      {
        id: "5",
        pick_list_id: "1",
        item_code: "ITM-005",
        item_name: "Connettore rapido",
        location: "C-03-A",
        quantity_requested: 8,
        quantity_picked: 0,
        unit: "pcs",
        status: "unavailable",
        notes: "Articolo non disponibile in magazzino"
      }
    ];

    setPickingLists(mockPickingLists);
    setPickingItems(mockPickingItems);
    setLoading(false);
  }, []);

  const filteredPickingLists = pickingLists.filter(pickList => {
    const matchesSearch = pickList.pick_list_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pickList.order_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pickList.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || pickList.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedPickListDetails = selectedPickList ? 
    pickingLists.find(pl => pl.id === selectedPickList) : null;

  const selectedPickingItems = selectedPickList ? 
    pickingItems.filter(item => item.pick_list_id === selectedPickList) : [];

  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case "low":
        return { label: "Bassa", color: "outline" as const, bgColor: "bg-gray-50" };
      case "medium":
        return { label: "Media", color: "default" as const, bgColor: "bg-blue-50" };
      case "high":
        return { label: "Alta", color: "secondary" as const, bgColor: "bg-orange-50" };
      case "urgent":
        return { label: "Urgente", color: "destructive" as const, bgColor: "bg-red-50" };
      default:
        return { label: "Sconosciuta", color: "outline" as const, bgColor: "bg-gray-50" };
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "In Attesa", color: "outline" as const, icon: Clock };
      case "in_progress":
        return { label: "In Corso", color: "default" as const, icon: Package };
      case "completed":
        return { label: "Completato", color: "default" as const, icon: CheckCircle };
      case "cancelled":
        return { label: "Annullato", color: "destructive" as const, icon: AlertTriangle };
      default:
        return { label: "Sconosciuto", color: "outline" as const, icon: Package };
    }
  };

  const getItemStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "Da prelevare", color: "outline" as const, icon: Clock };
      case "partial":
        return { label: "Parziale", color: "secondary" as const, icon: AlertTriangle };
      case "picked":
        return { label: "Prelevato", color: "default" as const, icon: CheckCircle };
      case "unavailable":
        return { label: "Non disponibile", color: "destructive" as const, icon: AlertTriangle };
      default:
        return { label: "Sconosciuto", color: "outline" as const, icon: Package };
    }
  };

  const pickingSummary = {
    totalPickLists: pickingLists.length,
    pendingPickLists: pickingLists.filter(pl => pl.status === "pending").length,
    inProgressPickLists: pickingLists.filter(pl => pl.status === "in_progress").length,
    urgentPickLists: pickingLists.filter(pl => pl.priority === "urgent" && pl.status !== "completed").length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Picking Lists</h1>
          <p className="text-muted-foreground">
            Gestisci le liste di prelievo per gli ordini clienti
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuova Lista Prelievo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuova Lista Prelievo</DialogTitle>
              <DialogDescription>
                Crea una nuova lista di prelievo da un ordine
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="order-reference">Ordine di Riferimento</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ordine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SO-2024-007">SO-2024-007 - Cliente DEF</SelectItem>
                    <SelectItem value="SO-2024-008">SO-2024-008 - Azienda GHI</SelectItem>
                    <SelectItem value="SO-2024-009">SO-2024-009 - Società JKL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="due-date">Data Scadenza</Label>
                <Input id="due-date" type="datetime-local" />
              </div>
              <div>
                <Label htmlFor="assigned-to">Assegnato a</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona operatore" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="giuseppe">Giuseppe Verde</SelectItem>
                    <SelectItem value="laura">Laura Bianchi</SelectItem>
                    <SelectItem value="mario">Mario Rossi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Crea Lista
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liste Totali</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pickingSummary.totalPickLists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Attesa</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pickingSummary.pendingPickLists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Corso</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pickingSummary.inProgressPickLists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgenti</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{pickingSummary.urgentPickLists}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per numero lista, ordine o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="pending">In Attesa</SelectItem>
                <SelectItem value="in_progress">In Corso</SelectItem>
                <SelectItem value="completed">Completato</SelectItem>
                <SelectItem value="cancelled">Annullato</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Picking Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste di Prelievo</CardTitle>
          <CardDescription>
            {filteredPickingLists.length} di {pickingLists.length} liste
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero Lista</TableHead>
                  <TableHead>Ordine</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Assegnato a</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredPickingLists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nessuna lista di prelievo trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPickingLists.map((pickList) => {
                    const priorityInfo = getPriorityInfo(pickList.priority);
                    const statusInfo = getStatusInfo(pickList.status);
                    const StatusIcon = statusInfo.icon;
                    const isOverdue = new Date(pickList.due_date) < new Date() && pickList.status !== "completed";
                    
                    return (
                      <TableRow key={pickList.id} className={isOverdue ? "bg-red-50" : ""}>
                        <TableCell className="font-medium">{pickList.pick_list_number}</TableCell>
                        <TableCell>{pickList.order_reference}</TableCell>
                        <TableCell>{pickList.customer_name}</TableCell>
                        <TableCell>
                          <Badge variant={priorityInfo.color}>
                            {priorityInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={pickList.progress} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {pickList.picked_items}/{pickList.total_items} ({pickList.progress}%)
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={isOverdue ? "text-red-600 font-medium" : ""}>
                            {format(new Date(pickList.due_date), "dd/MM/yyyy HH:mm", { locale: it })}
                            {isOverdue && (
                              <div className="text-xs text-red-500">In ritardo</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {pickList.assigned_to || "Non assegnato"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.color} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedPickList(
                              selectedPickList === pickList.id ? null : pickList.id
                            )}
                          >
                            {selectedPickList === pickList.id ? "Chiudi" : "Dettagli"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Picking List Details */}
      {selectedPickListDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Dettagli Lista: {selectedPickListDetails.pick_list_number}</CardTitle>
            <CardDescription>
              Articoli da prelevare per {selectedPickListDetails.customer_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Nome Articolo</TableHead>
                    <TableHead>Ubicazione</TableHead>
                    <TableHead className="text-right">Richiesto</TableHead>
                    <TableHead className="text-right">Prelevato</TableHead>
                    <TableHead className="text-right">Rimanente</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Prelevato da</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPickingItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nessun articolo in questa lista
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedPickingItems.map((item) => {
                      const itemStatusInfo = getItemStatusInfo(item.status);
                      const ItemStatusIcon = itemStatusInfo.icon;
                      const remaining = item.quantity_requested - item.quantity_picked;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_code}</TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {item.location}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity_requested} {item.unit}</TableCell>
                          <TableCell className="text-right">{item.quantity_picked} {item.unit}</TableCell>
                          <TableCell className="text-right">
                            {remaining > 0 ? (
                              <span className="text-orange-600">{remaining} {item.unit}</span>
                            ) : (
                              <span className="text-green-600">0 {item.unit}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={itemStatusInfo.color} className="gap-1">
                              <ItemStatusIcon className="h-3 w-3" />
                              {itemStatusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.picked_by ? (
                              <div>
                                <div className="font-medium">{item.picked_by}</div>
                                {item.picked_at && (
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(item.picked_at), "dd/MM HH:mm", { locale: it })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}