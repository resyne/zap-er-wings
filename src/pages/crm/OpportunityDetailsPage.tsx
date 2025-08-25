import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, FileText, Image, Calendar, Clock, User, Plus, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  probability?: number;
  expected_close_date?: string;
  contact_id?: string;
  company_id?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface Activity {
  id: string;
  opportunity_id: string;
  activity_type: 'completed' | 'todo';
  title: string;
  description?: string;
  completed_at?: string;
  scheduled_date?: string;
  created_by?: string;
  created_at: string;
}

interface OpportunityFile {
  id: string;
  opportunity_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
}

export default function OpportunityDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [files, setFiles] = useState<OpportunityFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  
  const [newActivity, setNewActivity] = useState({
    title: "",
    description: "",
    activity_type: "completed" as 'completed' | 'todo',
    scheduled_date: "",
  });

  useEffect(() => {
    if (id) {
      loadOpportunityDetails();
      loadActivities();
      loadFiles();
    }
  }, [id]);

  const loadOpportunityDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setOpportunity(data);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i dettagli dell'opportunità: " + error.message,
        variant: "destructive",
      });
      navigate("/crm/opportunities");
    }
  };

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_activities")
        .select("*")
        .eq("opportunity_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error("Errore nel caricamento attività:", error);
    }
  };

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_files")
        .select("*")
        .eq("opportunity_id", id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error("Errore nel caricamento file:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async () => {
    try {
      const activityData = {
        opportunity_id: id,
        ...newActivity,
        completed_at: newActivity.activity_type === 'completed' ? new Date().toISOString() : null,
        created_by: null, // Sarà settato quando avremo l'auth
      };

      const { error } = await supabase
        .from("opportunity_activities")
        .insert([activityData]);

      if (error) throw error;

      toast({
        title: "Attività creata",
        description: "L'attività è stata creata con successo",
      });

      setIsActivityDialogOpen(false);
      setNewActivity({
        title: "",
        description: "",
        activity_type: "completed",
        scheduled_date: "",
      });
      await loadActivities();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'attività: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `opportunities/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("opportunity_files")
        .insert([{
          opportunity_id: id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
        }]);

      if (dbError) throw dbError;

      toast({
        title: "File caricato",
        description: "Il file è stato caricato con successo",
      });

      setIsFileDialogOpen(false);
      await loadFiles();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare il file: " + error.message,
        variant: "destructive",
      });
    }
  };

  const markTodoAsCompleted = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("opportunity_activities")
        .update({
          activity_type: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq("id", activityId);

      if (error) throw error;

      toast({
        title: "Attività completata",
        description: "L'attività è stata segnata come completata",
      });

      await loadActivities();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'attività: " + error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento dettagli opportunità...</div>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Opportunità non trovata</div>
        </div>
      </div>
    );
  }

  const completedActivities = activities.filter(a => a.activity_type === 'completed');
  const todoActivities = activities.filter(a => a.activity_type === 'todo');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/crm/opportunities")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna alle Opportunità
        </Button>
        <h1 className="text-3xl font-bold">{opportunity.name}</h1>
        <Badge variant="outline">{opportunity.stage}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna Principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descrizione */}
          <Card>
            <CardHeader>
              <CardTitle>Descrizione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Valore Stimato</Label>
                  <p className="text-lg font-semibold">
                    {opportunity.amount ? `€${opportunity.amount.toLocaleString()}` : "Non specificato"}
                  </p>
                </div>
                <div>
                  <Label>Probabilità</Label>
                  <p>{opportunity.probability ? `${opportunity.probability}%` : "Non specificata"}</p>
                </div>
                <div>
                  <Label>Data Chiusura Prevista</Label>
                  <p>
                    {opportunity.expected_close_date 
                      ? format(new Date(opportunity.expected_close_date), "dd MMMM yyyy", { locale: it })
                      : "Non specificata"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File e Documenti */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>File e Documenti</CardTitle>
              <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Carica File
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Carica File</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="file-upload">Seleziona File</Label>
                      <Input
                        id="file-upload"
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file);
                          }
                        }}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {file.file_type.startsWith('image/') ? (
                      <Image className="w-5 h-5 text-blue-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{file.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Caricato il {format(new Date(file.uploaded_at), "dd MMM yyyy", { locale: it })}
                      </p>
                    </div>
                  </div>
                ))}
                {files.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Nessun file caricato
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonna Attività */}
        <div className="space-y-6">
          {/* Prossimi To-Do */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prossimi To-Do</CardTitle>
              <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuova Attività</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="activity-title">Titolo</Label>
                      <Input
                        id="activity-title"
                        value={newActivity.title}
                        onChange={(e) => setNewActivity({...newActivity, title: e.target.value})}
                        placeholder="Titolo attività"
                      />
                    </div>
                    <div>
                      <Label htmlFor="activity-description">Descrizione</Label>
                      <Textarea
                        id="activity-description"
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                        placeholder="Descrizione dettagliata"
                      />
                    </div>
                    <div>
                      <Label htmlFor="activity-type">Tipo</Label>
                      <select
                        id="activity-type"
                        value={newActivity.activity_type}
                        onChange={(e) => setNewActivity({...newActivity, activity_type: e.target.value as 'completed' | 'todo'})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="completed">Attività completata</option>
                        <option value="todo">Da fare</option>
                      </select>
                    </div>
                    {newActivity.activity_type === 'todo' && (
                      <div>
                        <Label htmlFor="scheduled-date">Data Programmata</Label>
                        <Input
                          id="scheduled-date"
                          type="datetime-local"
                          value={newActivity.scheduled_date}
                          onChange={(e) => setNewActivity({...newActivity, scheduled_date: e.target.value})}
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button onClick={handleCreateActivity}>
                        Crea Attività
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todoActivities.map((activity) => (
                  <div key={activity.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{activity.title}</h4>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                        )}
                        {activity.scheduled_date && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(activity.scheduled_date), "dd MMM yyyy HH:mm", { locale: it })}
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => markTodoAsCompleted(activity.id)}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {todoActivities.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Nessun to-do programmato
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attività Completate */}
          <Card>
            <CardHeader>
              <CardTitle>Attività Completate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedActivities.map((activity) => (
                  <div key={activity.id} className="p-3 border rounded-lg bg-muted/50">
                    <h4 className="font-medium">{activity.title}</h4>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activity.completed_at && format(new Date(activity.completed_at), "dd MMM yyyy HH:mm", { locale: it })}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Sistema
                      </div>
                    </div>
                  </div>
                ))}
                {completedActivities.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Nessuna attività completata
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}