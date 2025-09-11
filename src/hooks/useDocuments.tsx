import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  type: 'technical' | 'manual' | 'price-list' | 'compliance';
  language?: string;
  size?: string;
  uploadDate?: string;
  storage_path?: string;
  url?: string;
}

const languages = [
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" }
];

export const useDocuments = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const allDocuments: DocumentItem[] = [];

      // Load documents from Supabase storage
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('documents')
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (storageError) {
        console.error('Error loading storage files:', storageError);
      } else if (storageFiles) {
        // Convert storage files to DocumentItem format
        const storageDocuments: DocumentItem[] = storageFiles.map(file => {
          // Determine document type based on file name patterns
          let type: DocumentItem['type'] = 'technical';
          let category = 'Varie';
          let language = 'it';

          const fileName = file.name.toLowerCase();
          
          // Determine type
          if (fileName.includes('listino') || fileName.includes('price')) {
            type = 'price-list';
            category = 'Listini';
          } else if (fileName.includes('manuale') || fileName.includes('manual')) {
            type = 'manual';
            category = 'Manuali';
          } else if (fileName.includes('certificazion') || fileName.includes('compliance')) {
            type = 'compliance';
            category = 'Conformità';
          } else if (fileName.includes('abbattitor') || fileName.includes('blast')) {
            category = 'Abbattitori';
          } else if (fileName.includes('forno') || fileName.includes('oven')) {
            category = 'Forni';
          }

          // Determine language
          if (fileName.includes('_en') || fileName.includes('english')) {
            language = 'en';
          } else if (fileName.includes('_es') || fileName.includes('spanish')) {
            language = 'es';
          } else if (fileName.includes('_fr') || fileName.includes('french')) {
            language = 'fr';
          }

          const sizeInMB = file.metadata?.size ? (file.metadata.size / 1024 / 1024).toFixed(1) + ' MB' : 'N/A';

          return {
            id: file.id || file.name,
            name: file.name,
            category,
            type,
            language,
            size: sizeInMB,
            uploadDate: new Date(file.created_at).toLocaleDateString("it-IT"),
            storage_path: file.name,
            url: file.name
          };
        });

        allDocuments.push(...storageDocuments);
      }

      // Add some static example documents if no real documents are found
      if (allDocuments.length === 0) {
        const staticDocs: DocumentItem[] = [
          {
            id: 'tech_1',
            name: 'Scheda Tecnica Forni Professional Serie FP.pdf',
            category: 'Forni',
            type: 'technical',
            language: 'it',
            size: '2.1 MB',
            uploadDate: new Date().toLocaleDateString("it-IT"),
            url: '/docs/forni-professional.pdf'
          },
          {
            id: 'tech_2',
            name: 'Scheda Tecnica Abbattitori Blast Serie AB.pdf',
            category: 'Abbattitori',
            type: 'technical',
            language: 'it',
            size: '1.8 MB',
            uploadDate: new Date().toLocaleDateString("it-IT"),
            url: '/docs/abbattitori-blast.pdf'
          }
        ];
        allDocuments.push(...staticDocs);
      }

      setDocuments(allDocuments);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Errore durante il caricamento dei documenti');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentsByType = (type: DocumentItem['type']) => {
    return documents.filter(doc => doc.type === type);
  };

  const getDocumentsByCategory = (category: string) => {
    return documents.filter(doc => doc.category === category);
  };

  const getDocumentsByLanguage = (language: string) => {
    return documents.filter(doc => doc.language === language);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  return {
    documents,
    loading,
    loadDocuments,
    getDocumentsByType,
    getDocumentsByCategory,
    getDocumentsByLanguage
  };
};