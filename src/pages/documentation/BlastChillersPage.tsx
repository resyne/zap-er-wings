import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Upload, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const categories = [
  "Braceria", "Pizzeria", "Panificio", "Tostatura Caffe", 
  "Girarrosto", "Industriale", "Taglio Laser", "Varie", "Cappa", "Domestico"
];

const languages = [
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" }
];

interface TechnicalDocument {
  id: string;
  name: string;
  category: string;
  language: string;
  size: string;
  uploadDate: string;
  storage_path?: string;
}

export default function BlastChillersPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("it");
  const [documents, setDocuments] = useState<TechnicalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Load documents from Supabase Storage on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('company-documents')
        .list('blast-chillers/', {
          limit: 100,
          offset: 0,
        });

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      const documentsData: TechnicalDocument[] = files?.map(file => {
        // Extract metadata from filename: category_language_originalname
        const parts = file.name.split('_');
        const category = parts[0] || 'Varie';
        const language = parts[1] || 'it';
        const originalName = parts.slice(2).join('_') || file.name;

        return {
          id: file.id || file.name,
          name: originalName,
          category: category,
          language: language,
          size: file.metadata?.size ? (file.metadata.size / 1024 / 1024).toFixed(2) + " MB" : "N/A",
          uploadDate: new Date(file.updated_at || file.created_at || '').toLocaleDateString("it-IT"),
          storage_path: `blast-chillers/${file.name}`
        };
      }) || [];

      setDocuments(documentsData);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!selectedCategory) {
      toast.error("Seleziona prima una categoria");
      return;
    }

    if (!user) {
      toast.error("Devi essere loggato per caricare documenti");
      return;
    }

    setLoading(true);

    for (const file of acceptedFiles) {
      try {
        // Create filename with metadata: category_language_originalname
        const fileName = `${selectedCategory}_${selectedLanguage}_${file.name}`;
        const filePath = `blast-chillers/${fileName}`;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('company-documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Errore caricamento ${file.name}: ${uploadError.message}`);
          continue;
        }

        toast.success(`Documento ${file.name} caricato in ${selectedCategory} - ${languages.find(l => l.code === selectedLanguage)?.name}`);
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Errore durante il caricamento di ${file.name}`);
      }
    }

    setLoading(false);
    // Reload documents to show the newly uploaded ones
    await loadDocuments();
  };

  const deleteDocument = async (document: TechnicalDocument) => {
    if (!document.storage_path) {
      toast.error("Percorso file non trovato");
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.storage
        .from('company-documents')
        .remove([document.storage_path]);

      if (error) {
        console.error('Delete error:', error);
        toast.error(`Errore eliminazione: ${error.message}`);
        return;
      }

      toast.success("Documento eliminato");
      // Reload documents to reflect the deletion
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error("Errore durante l'eliminazione");
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (document: TechnicalDocument) => {
    if (!document.storage_path) {
      toast.error("Percorso file non trovato");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('company-documents')
        .download(document.storage_path);

      if (error) {
        console.error('Download error:', error);
        toast.error(`Errore download: ${error.message}`);
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Download avviato");
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error("Errore durante il download");
    }
  };

  const filteredDocuments = documents.filter(doc => 
    (!selectedCategory || doc.category === selectedCategory) &&
    doc.language === selectedLanguage
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    disabled: loading
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Abbattitori - Schede Tecniche</h1>
        <p className="text-muted-foreground">
          Gestione documenti tecnici per abbattitori organizzati per categoria e lingua
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

      {/* Category Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">Categorie</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              className="text-sm"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Carica Documenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary">Rilascia i file qui...</p>
            ) : (
              <div>
                <p className="text-foreground mb-2">Trascina i file qui o clicca per selezionare</p>
                <p className="text-sm text-muted-foreground">
                  Formati supportati: PDF, DOC, DOCX
                  {selectedCategory && (
                    <><br />Categoria selezionata: <Badge variant="secondary">{selectedCategory}</Badge></>
                  )}
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
            Documenti
            {selectedCategory && (
              <Badge variant="outline">
                {selectedCategory}
              </Badge>
            )}
            <Badge variant="outline">
              {languages.find(l => l.code === selectedLanguage)?.flag} {languages.find(l => l.code === selectedLanguage)?.name}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun documento trovato per i filtri selezionati
            </p>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground">{doc.name}</h4>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {languages.find(l => l.code === doc.language)?.flag} {languages.find(l => l.code === doc.language)?.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{doc.size}</span>
                        <span className="text-xs text-muted-foreground">{doc.uploadDate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => downloadDocument(doc)}
                      disabled={loading}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => deleteDocument(doc)}
                      disabled={loading}
                    >
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