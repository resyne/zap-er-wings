import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, Clock, Handshake, FileCheck, CheckCircle2, XCircle, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddPartnerForm } from "./AddPartnerForm";
import { EditPartnerForm } from "./EditPartnerForm";

interface Importer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  acquisition_status?: string;
  acquisition_notes?: string;
  priority?: string;
  email?: string;
  phone?: string;
  partner_type?: string;
  created_at: string;
}

const statusConfig = {
  prospect: {
    title: "Prospect",
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
  },
  contatto: {
    title: "Primo Contatto",
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
  },
  negoziazione: {
    title: "Negoziazione",
    icon: Handshake,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
  },
  contratto: {
    title: "Contratto",
    icon: FileCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
  },
  attivo: {
    title: "Attivo",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
  },
  inattivo: {
    title: "Inattivo",
    icon: XCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200",
  },
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-red-100 text-red-800",
};

export const ImporterKanban = () => {
  const [importers, setImporters] = useState<Importer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingImporter, setEditingImporter] = useState<Importer | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchImporters();
  }, []);

  const fetchImporters = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', 'importatore')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImporters(data || []);
    } catch (error) {
      console.error('Error fetching importers:', error);
      toast({
        title: "Error",
        description: "Failed to load importers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (importerId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('partners')
        .update({ acquisition_status: newStatus })
        .eq('id', importerId);

      if (error) throw error;

      setImporters(prev => 
        prev.map(imp => 
          imp.id === importerId 
            ? { ...imp, acquisition_status: newStatus }
            : imp
        )
      );

      toast({
        title: "Status Updated",
        description: "Importer status updated successfully",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleImporterAdded = (newImporter: any) => {
    if (newImporter.partner_type === 'importatore') {
      setImporters(prev => [newImporter, ...prev]);
    }
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "Importer added successfully",
    });
  };

  const handleImporterUpdated = (updatedImporter: any) => {
    setImporters(prev => prev.map(imp => 
      imp.id === updatedImporter.id ? updatedImporter : imp
    ));
    setIsEditDialogOpen(false);
    setEditingImporter(null);
    toast({
      title: "Success",
      description: "Importer updated successfully",
    });
  };

  const handleImporterDeleted = async (importerId: string) => {
    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', importerId);

      if (error) throw error;

      setImporters(prev => prev.filter(imp => imp.id !== importerId));
      toast({
        title: "Success",
        description: "Importer deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting importer:', error);
      toast({
        title: "Error",
        description: "Failed to delete importer",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (importer: Importer) => {
    setEditingImporter(importer);
    setIsEditDialogOpen(true);
  };

  const renderColumn = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    const columnImporters = importers.filter(imp => imp.acquisition_status === status);
    const Icon = config.icon;

    return (
      <div key={status} className="flex-1 min-w-80">
        <Card className={`h-full ${config.bgColor}`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${config.color}`}>
              <Icon className="h-4 w-4" />
              {config.title}
              <Badge variant="secondary" className="ml-auto">
                {columnImporters.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {columnImporters.map((importer) => (
              <Card 
                key={importer.id}
                className="bg-white border shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">
                        {importer.first_name} {importer.last_name}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={priorityColors[(importer.priority || 'medium') as keyof typeof priorityColors]}
                      >
                        {importer.priority || 'medium'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground font-medium">
                      {importer.company_name}
                    </p>
                    
                    {importer.country && (
                      <p className="text-xs text-muted-foreground">
                        📍 {importer.country}
                      </p>
                    )}
                    
                    {importer.acquisition_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {importer.acquisition_notes}
                      </p>
                    )}

                    {/* Action buttons - Edit and Delete */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEditDialog(importer)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Importer</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {importer.first_name} {importer.last_name} from {importer.company_name}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleImporterDeleted(importer.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Status change buttons */}
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(statusConfig).map((newStatus) => {
                        if (newStatus === status) return null;
                        const targetConfig = statusConfig[newStatus as keyof typeof statusConfig];
                        return (
                          <Button
                            key={newStatus}
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(importer.id, newStatus);
                            }}
                          >
                            → {targetConfig.title}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {status === 'prospect' && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Card className="border-dashed border-2 hover:border-primary/50 cursor-pointer transition-colors">
                    <CardContent className="flex items-center justify-center p-4">
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Importer
                      </Button>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Importer</DialogTitle>
                  </DialogHeader>
                  <AddPartnerForm 
                    onPartnerAdded={handleImporterAdded}
                    defaultPartnerType="importatore"
                  />
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading importers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Importer Acquisition Pipeline</h2>
          <p className="text-muted-foreground">
            Track the acquisition process of importers across different countries
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {importers.length} Total Importers
        </Badge>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {Object.keys(statusConfig).map(status => renderColumn(status))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Importer</DialogTitle>
          </DialogHeader>
          {editingImporter && (
            <EditPartnerForm 
              partner={editingImporter}
              onPartnerUpdated={handleImporterUpdated}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};