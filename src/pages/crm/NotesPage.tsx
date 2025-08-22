import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, RefreshCw, FileText } from "lucide-react";

interface Note {
  id: string;
  bigin_id?: string;
  title?: string;
  content?: string;
  contact?: { first_name?: string; last_name?: string; };
  company?: { name: string; };
  deal?: { name: string; };
  created_at: string;
  synced_at?: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_notes")
        .select(`
          *,
          contact:crm_contacts(first_name, last_name),
          company:crm_companies(name),
          deal:crm_deals(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le note: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bigin-sync', {
        body: { action: 'sync_notes' }
      });

      if (error) throw error;
      toast({
        title: "Sincronizzazione completata",
        description: "Le note sono state sincronizzate con Bigin",
      });
      await loadNotes();
    } catch (error: any) {
      toast({
        title: "Errore di sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNote = async () => {
    try {
      const { error } = await supabase
        .from("crm_notes")
        .insert([newNote]);

      if (error) throw error;
      toast({
        title: "Nota creata",
        description: "La nota è stata creata con successo",
      });
      setIsDialogOpen(false);
      setNewNote({ title: "", content: "" });
      await loadNotes();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare la nota: " + error.message,
        variant: "destructive",
      });
    }
  };

  const filteredNotes = notes.filter(note =>
    `${note.title || ""} ${note.content || ""} ${note.contact?.first_name || ""} ${note.company?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Note</h1>
          <p className="text-muted-foreground">Gestisci le tue note e sincronizza con Bigin</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={isSyncing} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizzazione...' : 'Sincronizza'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuova Nota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crea Nuova Nota</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Titolo</Label>
                  <Input
                    id="title"
                    value={newNote.title}
                    onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                    placeholder="Titolo della nota"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Contenuto</Label>
                  <Textarea
                    id="content"
                    value={newNote.content}
                    onChange={(e) => setNewNote({...newNote, content: e.target.value})}
                    placeholder="Scrivi il contenuto della nota..."
                    rows={6}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateNote}>
                  Crea Nota
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Note ({filteredNotes.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca note..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Contenuto</TableHead>
                <TableHead>Collegato a</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Stato Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium">{note.title || "Senza titolo"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate text-sm text-muted-foreground">
                      {note.content}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {note.contact && (
                        <Badge variant="outline">
                          {note.contact.first_name} {note.contact.last_name}
                        </Badge>
                      )}
                      {note.company && (
                        <Badge variant="outline">{note.company.name}</Badge>
                      )}
                      {note.deal && (
                        <Badge variant="outline">{note.deal.name}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {new Date(note.created_at).toLocaleDateString('it-IT')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {note.bigin_id ? (
                      <Badge variant="default">Sincronizzato</Badge>
                    ) : (
                      <Badge variant="secondary">Locale</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}