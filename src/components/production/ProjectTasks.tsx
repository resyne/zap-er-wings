import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

export function ProjectTasks({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("production_project_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: true });
    setTasks((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("production_project_tasks").insert({
      project_id: projectId,
      title: newTask.trim(),
      created_by: user?.id,
    });
    if (error) { toast.error("Errore"); } else {
      setNewTask("");
      // Log activity
      await supabase.from("production_project_activity_log").insert({
        project_id: projectId,
        action: "task_added",
        details: `Task aggiunta: ${newTask.trim()}`,
        created_by: user?.id,
      });
      load();
    }
    setAdding(false);
  };

  const toggleTask = async (task: Task) => {
    await supabase.from("production_project_tasks")
      .update({ completed: !task.completed, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    await supabase.from("production_project_activity_log").insert({
      project_id: projectId,
      action: task.completed ? "task_reopened" : "task_completed",
      details: `Task ${task.completed ? "riaperta" : "completata"}: ${task.title}`,
      created_by: user?.id,
    });
    load();
  };

  const deleteTask = async (task: Task) => {
    await supabase.from("production_project_tasks").delete().eq("id", task.id);
    await supabase.from("production_project_activity_log").insert({
      project_id: projectId,
      action: "task_deleted",
      details: `Task eliminata: ${task.title}`,
      created_by: user?.id,
    });
    toast.success("Eliminata");
    load();
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Nuova task..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTask()}
          className="text-sm h-8"
        />
        <Button size="sm" onClick={addTask} disabled={adding} className="h-8 gap-1">
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Aggiungi
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nessuna task</p>
      ) : (
        <div className="space-y-1 max-h-[250px] overflow-y-auto">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 p-1.5 rounded border bg-background hover:bg-muted/50 group">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleTask(task)}
              />
              <span className={`text-sm flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </span>
              <Button
                variant="ghost" size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => deleteTask(task)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {tasks.filter(t => t.completed).length}/{tasks.length} completate
      </div>
    </div>
  );
}
