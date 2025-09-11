import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Upload, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDocuments } from "@/hooks/useDocuments";

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
  const { user } = useAuth();
  const { documents: allDocuments, loading } = useDocuments();

  // Filter documents for blast chillers category
  const documents = allDocuments.filter(doc => doc.category === 'Abbattitori');

  // Load documents from useDocuments hook
  useEffect(() => {
    console.log('BlastChillersPage loaded, documents available:', documents.length);
  }, [documents]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!user) {
      toast.error("Devi essere autenticato per caricare file");
      return;
    }

    for (const file of acceptedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Errore nel caricamento di ${file.name}`);
        } else {
          toast.success(`${file.name} caricato con successo`);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Errore nel caricamento di ${file.name}`);
      }
    }
    
    // Reload documents after upload
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const deleteDocument = async (documentId: string) => {
    if (!user) {
      toast.error("Devi essere autenticato per eliminare file");
      return;
    }

    const doc = documents.find(d => d.id === documentId);
    if (!doc?.storage_path) {
      toast.error("Impossibile eliminare questo documento");
      return;
    }

    try {
      const { error } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (error) {
        console.error('Delete error:', error);
        toast.error("Errore nell'eliminazione del documento");
      } else {
        toast.success("Documento eliminato con successo");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error("Errore nell'eliminazione del documento");
    }
  };

  const handleDocumentClick = async (document: any) => {
    if (document.storage_path) {
      downloadDocument(document);
    } else {
      toast.info("Questo è un documento di esempio, anteprima non disponibile");
    }
  };

  const downloadDocument = async (document: any) => {
    if (!document.storage_path) {
      toast.info("Download non disponibile per i documenti di esempio");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) {
        console.error('Download error:', error);
        toast.error("Errore nel download del documento");
        return;
      }

      // Create blob and download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Download avviato");
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error("Errore nel download del documento");
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
                <div className="text-sm text-muted-foreground">
                  <p>Formati supportati: PDF, DOC, DOCX</p>
                  {selectedCategory && (
                    <p>Categoria selezionata: <Badge variant="secondary">{selectedCategory}</Badge></p>
                  )}
                  <p>Lingua: <Badge variant="secondary">
                    {languages.find(l => l.code === selectedLanguage)?.flag} {languages.find(l => l.code === selectedLanguage)?.name}
                  </Badge></p>
                </div>
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
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => handleDocumentClick(doc)}
                    title="Clicca per maggiori informazioni"
                  >
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground hover:text-primary transition-colors">
                        {doc.name}
                      </h4>
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
                  <div className="flex gap-2 ml-4">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDocument(doc);
                      }}
                      disabled={loading}
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => deleteDocument(doc.id)}
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