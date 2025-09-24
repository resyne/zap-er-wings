import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Eye, Calendar, Tag, User, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  content_type: string;
  status: string;
  platform?: string;
  priority: string;
  assigned_to?: string;
  due_date?: string;
  published_date?: string;
  content_url?: string;
  thumbnail_url?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
  created_by?: string;
}

const contentTypes = [
  { value: 'post', label: 'Post Social' },
  { value: 'video', label: 'Video' },
  { value: 'graphic', label: 'Grafica' },
  { value: 'blog', label: 'Articolo Blog' },
  { value: 'email', label: 'Email Marketing' },
  { value: 'other', label: 'Altro' }
];

const platforms = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'website', label: 'Sito Web' },
  { value: 'email', label: 'Email' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'twitter', label: 'Twitter' }
];

const priorities = [
  { value: 'low', label: 'Bassa', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Media', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-800' }
];

const columns = [
  { id: 'da_fare', title: 'Da Fare', color: 'bg-gray-50 border-gray-200' },
  { id: 'fatto', title: 'Fatti', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'da_montare', title: 'Da Montare', color: 'bg-blue-50 border-blue-200' },
  { id: 'pubblicato', title: 'Pubblicati', color: 'bg-green-50 border-green-200' }
];

export default function ContentCreationPage() {
  const { toast } = useToast();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'post',
    platform: '',
    priority: 'medium',
    due_date: '',
    notes: '',
    tags: [] as string[]
  });

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContent(data || []);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contenuti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare data with proper null handling for dates
      const submitData = {
        ...formData,
        due_date: formData.due_date || null
      };

      if (editingContent) {
        const { error } = await supabase
          .from('marketing_content')
          .update(submitData)
          .eq('id', editingContent.id);

        if (error) throw error;
        
        toast({
          title: "Successo",
          description: "Contenuto aggiornato con successo",
        });
      } else {
        const { error } = await supabase
          .from('marketing_content')
          .insert([submitData]);

        if (error) throw error;
        
        toast({
          title: "Successo",
          description: "Contenuto creato con successo",
        });
      }

      setDialogOpen(false);
      setEditingContent(null);
      resetForm();
      fetchContent();
    } catch (error) {
      console.error('Error saving content:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il contenuto",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo contenuto?')) return;

    try {
      const { error } = await supabase
        .from('marketing_content')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Successo",
        description: "Contenuto eliminato con successo",
      });
      
      fetchContent();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contenuto",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    try {
      const { error } = await supabase
        .from('marketing_content')
        .update({ status: destination.droppableId })
        .eq('id', draggableId);

      if (error) throw error;
      
      fetchContent();
      
      toast({
        title: "Successo",
        description: "Stato contenuto aggiornato",
      });
    } catch (error) {
      console.error('Error updating content status:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content_type: 'post',
      platform: '',
      priority: 'medium',
      due_date: '',
      notes: '',
      tags: []
    });
  };

  const openEditDialog = (item: ContentItem) => {
    setEditingContent(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      content_type: item.content_type,
      platform: item.platform || '',
      priority: item.priority,
      due_date: item.due_date || '',
      notes: item.notes || '',
      tags: item.tags || []
    });
    setDialogOpen(true);
  };

  const getPriorityBadge = (priority: string) => {
    const p = priorities.find(p => p.value === priority);
    return p ? { label: p.label, color: p.color } : { label: priority, color: 'bg-gray-100 text-gray-800' };
  };

  const ContentCard = ({ item }: { item: ContentItem }) => {
    const priorityInfo = getPriorityBadge(item.priority);
    const contentTypeLabel = contentTypes.find(t => t.value === item.content_type)?.label || item.content_type;
    const platformLabel = platforms.find(p => p.value === item.platform)?.label || item.platform;

    return (
      <Card className="mb-3 hover:shadow-md transition-shadow cursor-move">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-medium text-sm text-gray-900 line-clamp-2">{item.title}</h4>
            <div className="flex gap-1 ml-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => openEditDialog(item)}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleDelete(item.id)}
                className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {item.description && (
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">{item.description}</p>
          )}
          
          <div className="flex flex-wrap gap-1 mb-3">
            <Badge variant="outline" className="text-xs">
              {contentTypeLabel}
            </Badge>
            {platformLabel && (
              <Badge variant="outline" className="text-xs">
                {platformLabel}
              </Badge>
            )}
            <Badge className={`text-xs ${priorityInfo.color}`}>
              {priorityInfo.label}
            </Badge>
          </div>
          
          {item.due_date && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <Calendar className="h-3 w-3" />
              {new Date(item.due_date).toLocaleDateString('it-IT')}
            </div>
          )}
          
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Caricamento contenuti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Content Creation</h1>
            <p className="text-muted-foreground">Gestisci la creazione dei contenuti marketing</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingContent(null);
                resetForm();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Contenuto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingContent ? 'Modifica Contenuto' : 'Nuovo Contenuto'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="title">Titolo*</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="description">Descrizione</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="content_type">Tipo Contenuto*</Label>
                    <Select value={formData.content_type} onValueChange={(value) => setFormData({ ...formData, content_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="platform">Piattaforma</Label>
                    <Select value={formData.platform} onValueChange={(value) => setFormData({ ...formData, platform: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona piattaforma" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map((platform) => (
                          <SelectItem key={platform.value} value={platform.value}>
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="priority">Priorità</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="due_date">Scadenza</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="notes">Note</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit">
                    {editingContent ? 'Aggiorna' : 'Crea'} Contenuto
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map((column) => {
            const columnContent = content.filter(item => item.status === column.id);
            
            return (
              <div key={column.id} className={`rounded-lg border-2 ${column.color} p-4`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnContent.length}
                  </Badge>
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`min-h-[300px] ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''}`}
                    >
                      {columnContent.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${snapshot.isDragging ? 'rotate-2 scale-105' : ''}`}
                            >
                              <ContentCard item={item} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {columnContent.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">Nessun contenuto</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}