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

interface Reseller {
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

export const ResellerKanban = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', 'rivenditore')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResellers(data || []);
    } catch (error) {
      console.error('Error fetching resellers:', error);
      toast({
        title: "Error",
        description: "Failed to load resellers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (resellerId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('partners')
        .update({ acquisition_status: newStatus })
        .eq('id', resellerId);

      if (error) throw error;

      setResellers(prev => 
        prev.map(res => 
          res.id === resellerId 
            ? { ...res, acquisition_status: newStatus }
            : res
        )
      );

      toast({
        title: "Status Updated",
        description: "Reseller status updated successfully",
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

  const handleResellerAdded = (newReseller: any) => {
    if (newReseller.partner_type === 'rivenditore') {
      setResellers(prev => [newReseller, ...prev]);
    }
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "Reseller added successfully",
    });
  };

  const handleResellerUpdated = (updatedReseller: any) => {
    setResellers(prev => prev.map(res => 
      res.id === updatedReseller.id ? updatedReseller : res
    ));
    setIsEditDialogOpen(false);
    setEditingReseller(null);
    toast({
      title: "Success",
      description: "Reseller updated successfully",
    });
  };

  const handleResellerDeleted = async (resellerId: string) => {
    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', resellerId);

      if (error) throw error;

      setResellers(prev => prev.filter(res => res.id !== resellerId));
      toast({
        title: "Success",
        description: "Reseller deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting reseller:', error);
      toast({
        title: "Error",
        description: "Failed to delete reseller",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setIsEditDialogOpen(true);
  };

  const renderColumn = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    const columnResellers = resellers.filter(res => res.acquisition_status === status);
    const Icon = config.icon;

    return (
      <div key={status} className="flex-1 min-w-80">
        <Card className={`h-full ${config.bgColor}`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${config.color}`}>
              <Icon className="h-4 w-4" />
              {config.title}
              <Badge variant="secondary" className="ml-auto">
                {columnResellers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {columnResellers.map((reseller) => (
              <Card 
                key={reseller.id}
                className="bg-white border shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">
                        {reseller.first_name} {reseller.last_name}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={priorityColors[(reseller.priority || 'medium') as keyof typeof priorityColors]}
                      >
                        {reseller.priority || 'medium'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground font-medium">
                      {reseller.company_name}
                    </p>
                    
                    {reseller.country && (
                      <p className="text-xs text-muted-foreground">
                        📍 {reseller.country}
                      </p>
                    )}
                    
                    {reseller.acquisition_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {reseller.acquisition_notes}
                      </p>
                    )}

                    {/* Action buttons - Edit and Delete */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEditDialog(reseller)}
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
                              <AlertDialogTitle>Delete Reseller</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {reseller.first_name} {reseller.last_name} from {reseller.company_name}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleResellerDeleted(reseller.id)}
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
                              updateStatus(reseller.id, newStatus);
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
                        Add Reseller
                      </Button>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Reseller</DialogTitle>
                  </DialogHeader>
                  <AddPartnerForm 
                    onPartnerAdded={handleResellerAdded}
                    defaultPartnerType="rivenditore"
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
          <p className="text-muted-foreground mt-2">Loading resellers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reseller Acquisition Pipeline</h2>
          <p className="text-muted-foreground">
            Track the acquisition process of resellers across different markets
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {resellers.length} Total Resellers
        </Badge>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {Object.keys(statusConfig).map(status => renderColumn(status))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reseller</DialogTitle>
          </DialogHeader>
          {editingReseller && (
            <EditPartnerForm 
              partner={editingReseller}
              onPartnerUpdated={handleResellerUpdated}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};