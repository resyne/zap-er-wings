import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Kanban } from "lucide-react";
import { TaskKanban } from "@/components/tasks/TaskKanban";
import { TaskCalendar } from "@/components/tasks/TaskCalendar";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { WeeklyRecurringTasks } from "@/components/tasks/WeeklyRecurringTasks";

type TaskCategory = 'amministrazione' | 'back_office' | 'ricerca_sviluppo' | 'tecnico';
type ViewMode = 'kanban' | 'calendar';

export function TasksPage() {
  const [activeCategory, setActiveCategory] = useState<TaskCategory>('amministrazione');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const categories = [
    {
      key: 'amministrazione' as TaskCategory,
      title: 'Amministrazione',
      description: 'Gestione amministrativa e contabilità',
      color: 'bg-blue-500'
    },
    {
      key: 'back_office' as TaskCategory,
      title: 'Back-office',
      description: 'Operazioni interne e supporto',
      color: 'bg-green-500'
    },
    {
      key: 'ricerca_sviluppo' as TaskCategory,
      title: 'Ricerca & Sviluppo',
      description: 'Innovazione e sviluppo prodotti',
      color: 'bg-purple-500'
    },
    {
      key: 'tecnico' as TaskCategory,
      title: 'Tecnico',
      description: 'Attività tecniche e manutenzione',
      color: 'bg-orange-500'
    }
  ];

  const currentCategory = categories.find(cat => cat.key === activeCategory);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Management</h1>
          <p className="text-muted-foreground">
            Gestisci le attività del team per categoria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="rounded-r-none"
            >
              <Kanban className="w-4 h-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="rounded-l-none"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendario
            </Button>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Task
          </Button>
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as TaskCategory)}>
        <TabsList className="grid w-full grid-cols-4">
          {categories.map((category) => (
            <TabsTrigger key={category.key} value={category.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${category.color}`} />
                {category.title}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.key} value={category.key} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${category.color}`} />
                  {category.title}
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
            </Card>

            <WeeklyRecurringTasks category={category.key} />
            
            {viewMode === 'kanban' ? (
              <TaskKanban category={category.key} />
            ) : (
              <TaskCalendar category={category.key} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateTaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultCategory={activeCategory}
      />
    </div>
  );
}