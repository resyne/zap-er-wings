import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import { CalendarIcon, X, Plus, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assigned_to?: string;
  created_by?: string;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface EditTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: () => void;
}

interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export function EditTaskDialog({ task, open, onOpenChange, onTaskUpdated }: EditTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<'amministrazione' | 'back_office' | 'ricerca_sviluppo' | 'tecnico'>('amministrazione');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled'>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedTo, setAssignedTo] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [estimatedHours, setEstimatedHours] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  // Add console log to debug
  console.log('EditTaskDialog rendered with task:', task, 'open:', open);

  useEffect(() => {
    if (open && task) {
      try {
        setTitle(task.title || "");
        setDescription(task.description || "");
        setCategory((task.category as any) || 'amministrazione');
        setStatus(task.status || 'todo');
        setPriority(task.priority || 'medium');
        setAssignedTo(task.assigned_to || "");
        setStartDate(task.start_date ? new Date(task.start_date) : undefined);
        setDueDate(task.due_date ? new Date(task.due_date) : undefined);
        setEstimatedHours(task.estimated_hours?.toString() || "");
        setActualHours(task.actual_hours?.toString() || "");
        setTags(task.tags || []);
        setTagInput("");
        setFiles([]);
        
        fetchProfiles().catch(console.error);
        fetchTaskFiles().catch(console.error);
      } catch (error) {
        console.error('Error initializing task data:', error);
        toast({
          title: "Errore",
          description: "Errore nel caricamento dei dati del task",
          variant: "destructive",
        });
      }
    }
  }, [open, task]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchTaskFiles = async () => {
    if (!task?.id) {
      console.warn('No task ID available for fetching files');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('task_files')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at');

      if (error) throw error;
      setExistingFiles(data || []);
    } catch (error) {
      console.error('Error fetching task files:', error);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const downloadFile = async (file: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Errore",
        description: "Impossibile scaricare il file",
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (file: any) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      // Update local state
      setExistingFiles(existingFiles.filter(f => f.id !== file.id));

      toast({
        title: "File eliminato",
        description: "Il file è stato eliminato con successo",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il file",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        status,
        priority,
        assigned_to: assignedTo || null,
        start_date: startDate?.toISOString() || null,
        due_date: dueDate?.toISOString() || null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        actual_hours: actualHours ? parseFloat(actualHours) : null,
        tags: tags.length > 0 ? tags : null,
        updated_at: new Date().toISOString()
      };

      // Set completed_at if status is completed and wasn't completed before
      if (status === 'completed' && task.status !== 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status !== 'completed') {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id);

      if (error) throw error;

      // Upload new files if any
      if (files.length > 0) {
        for (const file of files) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${task.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('task-files')
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Record file in database
            const { error: fileRecordError } = await supabase
              .from('task_files')
              .insert({
                task_id: task.id,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                content_type: file.type,
                uploaded_by: updateData.assigned_to || task.assigned_to
              });

            if (fileRecordError) throw fileRecordError;
          } catch (fileError) {
            console.error('Error uploading file:', fileError);
            toast({
              title: "Attenzione",
              description: `Errore caricamento file ${file.name}`,
              variant: "destructive",
            });
          }
        }
      }

      toast({
        title: "Task aggiornato",
        description: `Il task "${title}" è stato aggiornato con successo`,
      });

      onTaskUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render if task is not available
  if (!task) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inserisci il titolo del task..."
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrivi il task..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amministrazione">Amministrazione</SelectItem>
                    <SelectItem value="back_office">Back-office</SelectItem>
                    <SelectItem value="ricerca_sviluppo">Ricerca & Sviluppo</SelectItem>
                    <SelectItem value="tecnico">Tecnico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Stato</Label>
                <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Da fare</SelectItem>
                    <SelectItem value="in_progress">In corso</SelectItem>
                    <SelectItem value="review">In revisione</SelectItem>
                    <SelectItem value="completed">Completato</SelectItem>
                    <SelectItem value="cancelled">Annullato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priorità</Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Assegnato a</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona utente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessuno</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.first_name} {profile.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data inizio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={it}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Scadenza</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                      locale={it}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedHours">Ore stimate</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="Es. 2.5"
                />
              </div>

              <div>
                <Label htmlFor="actualHours">Ore effettive</Label>
                <Input
                  id="actualHours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  placeholder="Es. 3.0"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Tag</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Aggiungi tag..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Existing Files */}
            {existingFiles.length > 0 && (
              <div className="space-y-3">
                <Label>File esistenti</Label>
                <div className="space-y-2">
                  {existingFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.file_size ? Math.round(file.file_size / 1024) + ' KB' : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFile(file)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New File Upload */}
            <div className="space-y-3">
              <Label>Nuovi allegati</Label>
              <FileUpload
                value={files}
                onChange={setFiles}
                maxFiles={5}
                acceptedFileTypes={['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Aggiornamento..." : "Aggiorna Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}