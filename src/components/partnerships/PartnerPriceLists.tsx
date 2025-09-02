import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2 } from "lucide-react";

interface PriceList {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadDate: string;
}

interface PartnerPriceListsProps {
  partnerId: string;
  partnerName: string;
  priceLists?: PriceList[];
  pricingNotes?: string;
  onUpdate?: () => void;
}

export function PartnerPriceLists({
  partnerId,
  partnerName,
  priceLists = [],
  pricingNotes = "",
  onUpdate
}: PartnerPriceListsProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState(pricingNotes);
  const [savingNotes, setSavingNotes] = useState(false);
  const { toast } = useToast();

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedFiles: PriceList[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${partnerId}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('company-documents')
          .getPublicUrl(fileName);

        uploadedFiles.push({
          id: Date.now().toString(),
          name: file.name,
          url: publicUrl,
          size: file.size,
          uploadDate: new Date().toISOString()
        });
      }

      // Update partner record with new price lists
      const updatedPriceLists = [...priceLists, ...uploadedFiles];
      
      const { error: updateError } = await supabase
        .from('partners')
        .update({ price_lists: updatedPriceLists as any })
        .eq('id', partnerId);

      if (updateError) throw updateError;

      setFiles([]);
      onUpdate?.();
      
      toast({
        title: "Successo",
        description: `${uploadedFiles.length} file caricati con successo`
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento dei file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileToDelete: PriceList) => {
    try {
      // Extract file path from URL
      const url = new URL(fileToDelete.url);
      const filePath = url.pathname.split('/').slice(-2).join('/');
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('company-documents')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Update partner record
      const updatedPriceLists = priceLists.filter(file => file.id !== fileToDelete.id);
      
      const { error: updateError } = await supabase
        .from('partners')
        .update({ price_lists: updatedPriceLists as any })
        .eq('id', partnerId);

      if (updateError) throw updateError;

      onUpdate?.();
      
      toast({
        title: "Successo",
        description: "File eliminato con successo"
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione del file",
        variant: "destructive"
      });
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('partners')
        .update({ pricing_notes: notes })
        .eq('id', partnerId);

      if (error) throw error;

      onUpdate?.();
      
      toast({
        title: "Successo",
        description: "Note sui prezzi salvate"
      });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: "Errore",
        description: "Errore durante il salvataggio delle note",
        variant: "destructive"
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Listini Prezzi - {partnerName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            value={files}
            onChange={setFiles}
            maxFiles={10}
            acceptedFileTypes={["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "image/jpeg", "image/png"]}
          />
          
          {files.length > 0 && (
            <Button 
              onClick={uploadFiles} 
              disabled={uploading}
              className="w-full"
            >
              {uploading ? "Caricamento..." : `Carica ${files.length} file`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Existing Files */}
      {priceLists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File Caricati ({priceLists.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {priceLists.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {new Date(file.uploadDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
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
          </CardContent>
        </Card>
      )}

      {/* Pricing Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Note sui Prezzi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pricing-notes">Condizioni particolari, sconti, note sui prezzi</Label>
            <Textarea
              id="pricing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Inserisci note sui prezzi, condizioni particolari, sconti..."
              rows={4}
            />
          </div>
          <Button 
            onClick={saveNotes} 
            disabled={savingNotes || notes === pricingNotes}
            variant="outline"
          >
            {savingNotes ? "Salvataggio..." : "Salva Note"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
