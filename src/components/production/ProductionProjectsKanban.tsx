import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Loader2, GripVertical, Calendar, Target,
  ArrowUpDown, Zap, Weight, Edit, Trash2, Archive,
  BarChart3, Eye, Paperclip
} from "lucide-react";
import { ProjectAttachments, AttachmentCountBadge } from "./ProjectAttachments";

interface ProductionProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  impact: number | null;
  effort: number | null;
  urgency: number | null;
  priority_score: number | null;
  assigned_to: string | null;
  design_request_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const columns = [
  { key: "da_fare", label: "Da Fare", color: "bg-muted", textColor: "text-muted-foreground", icon: "📋" },
  { key: "in_corso", label: "In Corso", color: "bg-blue-500", textColor: "text-blue-700", icon: "⚙️" },
  { key: "chiuso", label: "Chiusi", color: "bg-green-500", textColor: "text-green-700", icon: "✅" },
  { key: "archiviato", label: "Archiviati", color: "bg-gray-400", textColor: "text-gray-500", icon: "📦" },
];

function getPriorityColor(score: number | null) {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 4) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (score >= 3) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  if (score >= 2) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
}

function MatrixDot({ impact, effort }: { impact: number; effort: number }) {
  // 5x5 grid, bottom-left = low effort/low impact, top-right = high effort/high impact
  const left = ((effort - 1) / 4) * 100;
  const bottom = ((impact - 1) / 4) * 100;
  return (
    <div className="relative w-full h-24 border rounded bg-gradient-to-tr from-green-50 via-yellow-50 to-red-50 dark:from-green-950 dark:via-yellow-950 dark:to-red-950">
      {/* Quadrant labels */}
      <span className="absolute top-0.5 left-1 text-[8px] text-muted-foreground">Alto Impatto / Basso Sforzo</span>
      <span className="absolute top-0.5 right-1 text-[8px] text-muted-foreground">Alto / Alto</span>
      <span className="absolute bottom-0.5 left-1 text-[8px] text-muted-foreground">Basso / Basso</span>
      <span className="absolute bottom-0.5 right-1 text-[8px] text-muted-foreground">Basso Impatto / Alto Sforzo</span>
      {/* Dot */}
      <div
        className="absolute w-3 h-3 rounded-full bg-primary border-2 border-primary-foreground shadow-md transform -translate-x-1/2 translate-y-1/2"
        style={{ left: `${left}%`, bottom: `${bottom}%` }}
      />
    </div>
  );
}

function LevelIndicator({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={cn("w-2 h-2 rounded-full", i < value ? color : "bg-muted")} />
      ))}
    </div>
  );
}

// --- Project Card ---
function ProjectCard({ project, onEdit, onStatusChange }: {
  project: ProductionProject;
  onEdit: () => void;
  onStatusChange: (newStatus: string) => void;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all group" onClick={onEdit}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm leading-tight">{project.title}</span>
          {project.priority_score != null && (
            <Badge className={cn("text-[10px] px-1.5 flex-shrink-0", getPriorityColor(project.priority_score))}>
              P:{project.priority_score}
            </Badge>
          )}
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
        )}

        {(project.impact != null || project.effort != null) && (
          <div className="flex items-center gap-3 text-[11px]">
            {project.impact != null && (
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-red-500" />
                <LevelIndicator value={project.impact} color="bg-red-500" />
              </div>
            )}
            {project.effort != null && (
              <div className="flex items-center gap-1">
                <Weight className="h-3 w-3 text-blue-500" />
                <LevelIndicator value={project.effort} color="bg-blue-500" />
              </div>
            )}
            {project.urgency != null && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <LevelIndicator value={project.urgency} color="bg-yellow-500" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{new Date(project.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
          <AttachmentCountBadge projectId={project.id} />
          {project.assigned_to && <span className="truncate max-w-[80px]">{project.assigned_to}</span>}
          {project.due_date && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(project.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Create/Edit Dialog ---
function ProjectFormDialog({ project, open, onClose, onSaved }: {
  project?: ProductionProject | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [impact, setImpact] = useState(project?.impact || 3);
  const [effort, setEffort] = useState(project?.effort || 3);
  const [urgency, setUrgency] = useState(project?.urgency || 3);
  const [assignedTo, setAssignedTo] = useState(project?.assigned_to || "");
  const [startDate, setStartDate] = useState(project?.start_date || "");
  const [dueDate, setDueDate] = useState(project?.due_date || "");
  const [notes, setNotes] = useState(project?.notes || "");
  const [status, setStatus] = useState(project?.status || "da_fare");
  const [saving, setSaving] = useState(false);

  const isEdit = !!project;

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Inserisci un titolo"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        impact,
        effort,
        urgency,
        assigned_to: assignedTo.trim() || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        status,
      };

      if (status === 'chiuso' && project?.status !== 'chiuso') {
        payload.completed_at = new Date().toISOString();
      }

      if (isEdit) {
        const { error } = await supabase.from("production_projects").update(payload).eq("id", project.id);
        if (error) throw error;
        toast.success("Progetto aggiornato");
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("production_projects").insert(payload);
        if (error) throw error;
        toast.success("Progetto creato");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm("Eliminare questo progetto?")) return;
    const { error } = await supabase.from("production_projects").delete().eq("id", project.id);
    if (error) { toast.error("Errore"); return; }
    toast.success("Progetto eliminato");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica Progetto" : "Nuovo Progetto"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div>
              <Label>Titolo *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome del progetto" className="mt-1" />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1" />
            </div>

            {isEdit && (
              <div>
                <Label>Stato</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.icon} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Impact/Effort/Urgency Matrix */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Matrice Priorità
              </h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Target className="h-3 w-3 text-red-500" /> Impatto
                  </Label>
                  <span className="text-xs font-bold text-red-600">{impact}/5</span>
                </div>
                <Slider value={[impact]} onValueChange={v => setImpact(v[0])} min={1} max={5} step={1} className="w-full" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Weight className="h-3 w-3 text-blue-500" /> Sforzo
                  </Label>
                  <span className="text-xs font-bold text-blue-600">{effort}/5</span>
                </div>
                <Slider value={[effort]} onValueChange={v => setEffort(v[0])} min={1} max={5} step={1} className="w-full" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" /> Urgenza
                  </Label>
                  <span className="text-xs font-bold text-yellow-600">{urgency}/5</span>
                </div>
                <Slider value={[urgency]} onValueChange={v => setUrgency(v[0])} min={1} max={5} step={1} className="w-full" />
              </div>

              <MatrixDot impact={impact} effort={effort} />

              <div className="text-center text-xs text-muted-foreground">
                Punteggio priorità: <span className="font-bold">{((impact * 2 + urgency - effort) / 2).toFixed(1)}</span>
                <br />
                <span className="text-[10px]">(Impatto×2 + Urgenza - Sforzo) / 2</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assegnato a</Label>
                <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Nome" className="mt-1" />
              </div>
              <div>
                <Label>Data Inizio</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Scadenza</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Note</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1" />
            </div>

            {isEdit && project && (
              <ProjectAttachments projectId={project.id} />
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="flex justify-between">
          <div>
            {isEdit && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Elimina
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {isEdit ? "Salva" : "Crea"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Kanban ---
export function ProductionProjectsKanban() {
  const [projects, setProjects] = useState<ProductionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<ProductionProject | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("production_projects")
      .select("*")
      .order("priority_score", { ascending: false, nullsFirst: false });

    if (error) {
      console.error(error);
      toast.error("Errore nel caricamento");
      return;
    }
    setProjects((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === 'chiuso') updateData.completed_at = new Date().toISOString();
    
    const { error } = await supabase.from("production_projects").update(updateData).eq("id", projectId);
    if (error) { toast.error("Errore"); return; }
    loadProjects();
  };

  const visibleColumns = showArchived ? columns : columns.filter(c => c.key !== 'archiviato');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setEditProject(null); setShowForm(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuovo Progetto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="gap-1.5"
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Nascondi Archiviati" : "Mostra Archiviati"}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {projects.filter(p => p.status !== 'archiviato').length} progetti attivi
        </div>
      </div>

      {/* Kanban Board */}
      <div className={cn("grid gap-4", showArchived ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3")}>
        {visibleColumns.map(col => {
          const colProjects = projects
            .filter(p => p.status === col.key)
            .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className={cn("w-3 h-3 rounded-full", col.color)} />
                <span className="font-semibold text-sm">{col.icon} {col.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto">{colProjects.length}</Badge>
              </div>

              <div className="space-y-2 min-h-[100px] p-2 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20">
                {colProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nessun progetto</p>
                ) : (
                  colProjects.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onEdit={() => { setEditProject(p); setShowForm(true); }}
                      onStatusChange={(s) => handleStatusChange(p.id, s)}
                    />
                  ))
                )}
              </div>

              {/* Quick actions per colonna */}
              {col.key !== 'archiviato' && colProjects.length > 0 && (
                <div className="flex gap-1 px-1">
                  {col.key === 'da_fare' && (
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 w-full"
                      onClick={() => colProjects.forEach(p => handleStatusChange(p.id, 'in_corso'))}>
                      Sposta tutti → In Corso
                    </Button>
                  )}
                  {col.key === 'chiuso' && (
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 w-full"
                      onClick={() => colProjects.forEach(p => handleStatusChange(p.id, 'archiviato'))}>
                      Archivia tutti
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <ProjectFormDialog
          project={editProject}
          open={showForm}
          onClose={() => { setShowForm(false); setEditProject(null); }}
          onSaved={() => { setShowForm(false); setEditProject(null); loadProjects(); }}
        />
      )}
    </div>
  );
}
