import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, Copy, Trash2, Wrench, Factory, Package, Component } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BOM {
  id: string;
  name: string;
  version: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  component_count: number;
  level: number;
  parent_id?: string;
  machinery_model?: string;
  children?: BOM[];
}

interface ParentBOM {
  id: string;
  name: string;
  level: number;
}

const levelLabels = {
  0: "Machinery Model",
  1: "Parent Group", 
  2: "Child Element"
};

const levelIcons = {
  0: Factory,
  1: Package,
  2: Component
};

export default function BomPage() {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [parentBoms, setParentBoms] = useState<ParentBOM[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    version: "",
    notes: "",
    level: 0,
    parent_id: "",
    machinery_model: ""
  });

  const resetForm = () => {
    setFormData({
      name: "",
      version: "",
      notes: "",
      level: 0,
      parent_id: "",
      machinery_model: ""
    });
    setSelectedLevel(0);
  };

  useEffect(() => {
    fetchBoms();
  }, []);

  useEffect(() => {
    if (selectedLevel > 0) {
      fetchParentBoms();
    }
  }, [selectedLevel]);

  const fetchBoms = async () => {
    try {
      const { data, error } = await supabase
        .from('boms')
        .select(`
          *,
          bom_items(count)
        `)
        .order('level', { ascending: true })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const bomsWithCount = data?.map(bom => ({
        ...bom,
        component_count: Array.isArray(bom.bom_items) ? bom.bom_items.length : 0
      })) || [];

      setBoms(bomsWithCount);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchParentBoms = async () => {
    try {
      const targetLevel = selectedLevel - 1;
      const { data, error } = await supabase
        .from('boms')
        .select('id, name, level')
        .eq('level', targetLevel)
        .order('name');

      if (error) throw error;
      setParentBoms(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        level: selectedLevel,
        parent_id: formData.parent_id || null,
        machinery_model: selectedLevel === 0 ? formData.machinery_model : null
      };

      if (selectedBom) {
        // Update
        const { error } = await supabase
          .from('boms')
          .update(submitData)
          .eq('id', selectedBom.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "BOM updated successfully",
        });
      } else {
        // Create
        const { error } = await supabase
          .from('boms')
          .insert([submitData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "BOM created successfully",
        });
      }

      setIsDialogOpen(false);
      setSelectedBom(null);
      resetForm();
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (bom: BOM) => {
    setSelectedBom(bom);
    setSelectedLevel(bom.level);
    setFormData({
      name: bom.name,
      version: bom.version,
      notes: bom.notes || "",
      level: bom.level,
      parent_id: bom.parent_id || "",
      machinery_model: bom.machinery_model || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this BOM? This will also delete all child BOMs.")) return;

    try {
      const { error } = await supabase
        .from('boms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "BOM deleted successfully",
      });
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredBoms = boms.filter(bom =>
    bom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bom.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bom.machinery_model && bom.machinery_model.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedBoms = filteredBoms.reduce((acc, bom) => {
    if (!acc[bom.level]) acc[bom.level] = [];
    acc[bom.level].push(bom);
    return acc;
  }, {} as Record<number, BOM[]>);

  const getLevelBadgeVariant = (level: number) => {
    switch (level) {
      case 0: return "default";
      case 1: return "secondary";
      case 2: return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/mfg">Production</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>BOMs</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hierarchical Bill of Materials</h1>
          <p className="text-muted-foreground">
            Manage machinery models, parent groups, and child elements in a hierarchical structure
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setSelectedBom(null); resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" />
              New BOM
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{selectedBom ? "Edit BOM" : "Create New BOM"}</DialogTitle>
              <DialogDescription>
                {selectedBom ? "Update the BOM details below." : "Add a new hierarchical bill of materials to your system."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="level">Level *</Label>
                <Select 
                  value={selectedLevel.toString()} 
                  onValueChange={(value) => setSelectedLevel(parseInt(value))}
                  disabled={!!selectedBom}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select BOM level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Level 0 - Machinery Model</SelectItem>
                    <SelectItem value="1">Level 1 - Parent Group</SelectItem>
                    <SelectItem value="2">Level 2 - Child Element</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedLevel > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="parent_id">Parent BOM *</Label>
                  <Select 
                    value={formData.parent_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, parent_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent BOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentBoms.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedLevel === 0 && (
                <div className="space-y-2">
                  <Label htmlFor="machinery_model">Machinery Model *</Label>
                  <Input
                    id="machinery_model"
                    value={formData.machinery_model}
                    onChange={(e) => setFormData(prev => ({ ...prev, machinery_model: e.target.value }))}
                    placeholder="Enter machinery model name"
                    required={selectedLevel === 0}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter BOM name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="e.g., v1.0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this BOM"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedBom ? "Update" : "Create"} BOM
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((level) => {
          const Icon = levelIcons[level as keyof typeof levelIcons];
          const count = groupedBoms[level]?.length || 0;
          return (
            <Card key={level}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {levelLabels[level as keyof typeof levelLabels]}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                  Level {level} BOMs
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search BOMs by name, version, or machinery model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hierarchical BOMs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>BOMs ({filteredBoms.length})</CardTitle>
            <Badge variant="secondary">
              Total Components: {filteredBoms.reduce((sum, bom) => sum + bom.component_count, 0)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Machinery Model</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading BOMs...
                    </TableCell>
                  </TableRow>
                ) : filteredBoms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No BOMs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBoms.map((bom) => {
                    const Icon = levelIcons[bom.level as keyof typeof levelIcons];
                    return (
                      <TableRow key={bom.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Icon className="h-4 w-4" />
                            <Badge variant={getLevelBadgeVariant(bom.level)}>
                              L{bom.level}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div style={{ paddingLeft: `${bom.level * 20}px` }}>
                            {bom.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bom.version}</Badge>
                        </TableCell>
                        <TableCell>
                          {bom.machinery_model ? (
                            <Badge variant="default">{bom.machinery_model}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {bom.component_count} items
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(bom.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(bom)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Wrench className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(bom.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
    </div>
  );
}