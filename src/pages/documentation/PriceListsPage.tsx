import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Upload, Trash2, DollarSign } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const languages = [
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" }
];

interface Document {
  id: string;
  name: string;
  language: string;
  size: string;
  uploadDate: string;
  storage_path: string;
  url: string;
}

export default function PriceListsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("it");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('company-documents')
        .list('price-lists/', {
          limit: 100,
          offset: 0
        });

      if (error) throw error;

      if (files) {
        const docs: Document[] = await Promise.all(
          files
            .filter(file => file.name !== '.emptyFolderPlaceholder')
            .map(async (file) => {
              const { data } = supabase.storage
                .from('company-documents')
                .getPublicUrl(`price-lists/${file.name}`);

              // Extract language from filename if available
              const nameParts = file.name.split('_');
              const language = nameParts.length > 1 ? nameParts[0] : 'it';

              return {
                id: file.id || Date.now().toString(),
                name: file.name,
                language: language,
                size: `${((file.metadata?.size || 0) / 1024 / 1024).toFixed(2)} MB`,
                uploadDate: new Date(file.created_at || '').toLocaleDateString("it-IT"),
                storage_path: `price-lists/${file.name}`,
                url: data.publicUrl
              };
            })
        );
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Errore caricamento documenti:', error);
      toast.error("Errore nel caricamento dei documenti");
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    setLoading(true);
    
    for (const file of acceptedFiles) {
      try {
        console.log(`Starting upload for file: ${file.name}, size: ${file.size} bytes`);
        
        // Check file size (20MB limit)
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
          throw new Error(`File troppo grande. Massimo 20MB consentiti. File corrente: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        }

        // Create filename with language prefix
        const filename = `${selectedLanguage}_${Date.now()}_${file.name}`;
        const filePath = `price-lists/${filename}`;

        console.log(`Uploading to path: ${filePath}`);

        const { error: uploadError } = await supabase.storage
          .from('company-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Errore upload: ${uploadError.message}`);
        }

        toast.success(`Listino caricato - ${languages.find(l => l.code === selectedLanguage)?.name}`);
        console.log(`Successfully uploaded: ${filename}`);
      } catch (error: any) {
        console.error('Errore upload:', error);
        toast.error(`Errore nel caricamento di ${file.name}: ${error.message || 'Errore sconosciuto'}`);
      }
    }
    
    setLoading(false);
    loadDocuments(); // Ricarica la lista
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  const deleteDocument = async (doc: Document) => {
    try {
      const { error } = await supabase.storage
        .from('company-documents')
        .remove([doc.storage_path]);

      if (error) throw error;

      toast.success("Documento eliminato");
      loadDocuments(); // Ricarica la lista
    } catch (error) {
      console.error('Errore eliminazione:', error);
      toast.error("Errore nell'eliminazione del documento");
    }
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('company-documents')
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore download:', error);
      toast.error("Errore nel download del documento");
    }
  };

  const filteredDocuments = documents.filter(doc => doc.language === selectedLanguage);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-orange-600" />
          Listini
        </h1>
        <p className="text-muted-foreground">
          Gestione listini prezzi e cataloghi
        </p>
      </div>

      {/* Language Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">Lingua</h3>
        <div className="flex gap-2 flex-wrap">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguage === lang.code ? "default" : "outline"}
              onClick={() => setSelectedLanguage(lang.code)}
              className="gap-2"
            >
              <span>{lang.flag}</span>
              {lang.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Carica Listini
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            } ${loading ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {loading ? (
              <p className="text-primary">Caricamento in corso...</p>
            ) : isDragActive ? (
              <p className="text-primary">Rilascia i file qui...</p>
            ) : (
              <div>
                <p className="text-foreground mb-2">Trascina i file qui o clicca per selezionare</p>
                <p className="text-sm text-muted-foreground">
                  Formati supportati: PDF, DOC, DOCX, XLS, XLSX
                  <br />Lingua: <Badge variant="secondary">
                    {languages.find(l => l.code === selectedLanguage)?.flag} {languages.find(l => l.code === selectedLanguage)?.name}
                  </Badge>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Listini
            <Badge variant="outline">
              {languages.find(l => l.code === selectedLanguage)?.flag} {languages.find(l => l.code === selectedLanguage)?.name}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun listino trovato per la lingua selezionata
            </p>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-orange-600" />
                    <div>
                      <h4 className="font-medium text-foreground">{doc.name}</h4>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {languages.find(l => l.code === doc.language)?.flag} {languages.find(l => l.code === doc.language)?.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{doc.size}</span>
                        <span className="text-xs text-muted-foreground">{doc.uploadDate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteDocument(doc)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}