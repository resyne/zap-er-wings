import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, FileText, Image, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FilePreviewProps {
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  onDownload: () => void;
  onDelete: () => void;
  description?: string;
  tags?: string[];
  createdAt: string;
  equipmentType: string;
  category: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  fileName,
  filePath,
  fileType,
  fileSize,
  onDownload,
  onDelete,
  description,
  tags,
  createdAt,
  equipmentType,
  category
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fileType.startsWith('image/')) {
      loadPreview();
    }
  }, [filePath, fileType]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('marketing-materials')
        .createSignedUrl(filePath, 300); // 5 minutes

      if (error) throw error;
      
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error('Error loading preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const openFullPreview = async () => {
    if (!previewUrl && (fileType.startsWith('image/') || fileType === 'application/pdf')) {
      await loadPreview();
    }
    setIsPreviewOpen(true);
  };

  const getFileIcon = () => {
    if (fileType.startsWith('image/')) return <Image className="h-6 w-6" />;
    if (fileType.startsWith('video/')) return <Video className="h-6 w-6" />;
    return <FileText className="h-6 w-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreviewContent = () => {
    if (fileType.startsWith('image/') && previewUrl) {
      return (
        <div className="relative group">
          <img
            src={previewUrl}
            alt={fileName}
            className="w-full h-32 object-cover rounded-md"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-md flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={openFullPreview}
            >
              <Eye className="h-4 w-4 mr-1" />
              Anteprima
            </Button>
          </div>
        </div>
      );
    } else if (fileType.startsWith('video/')) {
      return (
        <div className="w-full h-32 bg-gray-100 rounded-md flex items-center justify-center">
          <div className="text-center">
            <Video className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-xs text-gray-500">Video Preview</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={openFullPreview}
            >
              <Eye className="h-3 w-3 mr-1" />
              Anteprima
            </Button>
          </div>
        </div>
      );
    } else if (fileType === 'application/pdf') {
      return (
        <div className="w-full h-32 bg-red-50 rounded-md flex items-center justify-center border border-red-200">
          <div className="text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-xs text-red-600 font-medium">PDF Document</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={openFullPreview}
            >
              <Eye className="h-3 w-3 mr-1" />
              Anteprima
            </Button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="w-full h-32 bg-gray-100 rounded-md flex items-center justify-center">
          <div className="text-center">
            {getFileIcon()}
            <p className="text-xs text-gray-500 mt-2">Nessuna anteprima disponibile</p>
          </div>
        </div>
      );
    }
  };

  const renderFullPreview = () => {
    if (fileType.startsWith('image/') && previewUrl) {
      return (
        <div className="max-w-4xl max-h-[80vh] overflow-auto">
          <img
            src={previewUrl}
            alt={fileName}
            className="w-full h-auto"
          />
        </div>
      );
    } else if (fileType === 'application/pdf' && previewUrl) {
      return (
        <div className="w-full h-[80vh]">
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title={fileName}
          />
        </div>
      );
    } else if (fileType.startsWith('video/') && previewUrl) {
      return (
        <div className="max-w-4xl">
          <video
            controls
            className="w-full h-auto max-h-[80vh]"
            src={previewUrl}
          >
            Il tuo browser non supporta il tag video.
          </video>
        </div>
      );
    } else {
      return (
        <div className="p-8 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Anteprima non disponibile per questo tipo di file</p>
          <p className="text-sm text-gray-500 mt-2">Usa il pulsante di download per visualizzare il file</p>
        </div>
      );
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Preview Area */}
            {renderPreviewContent()}
            
            {/* File Info */}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {getFileIcon()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={fileName}>
                      {fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1 ml-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownload}
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDelete}
                    title="Elimina"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">
                  {equipmentType === 'abbattitori' ? 'Abbattitori' : 'Forni'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {category === 'media_professionale' ? 'Media Prof.' : 'Creative Adv.'}
                </Badge>
              </div>
              
              {/* Description */}
              {description && (
                <p className="text-xs text-gray-600 line-clamp-2" title={description}>
                  {description}
                </p>
              )}
              
              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > 3 && (
                    <span className="text-xs text-gray-400">+{tags.length - 3}</span>
                  )}
                </div>
              )}
              
              {/* Date */}
              <p className="text-xs text-gray-400">
                {new Date(createdAt).toLocaleDateString('it-IT')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {getFileIcon()}
              <span className="truncate">{fileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {renderFullPreview()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};