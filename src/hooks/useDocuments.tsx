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

      // Load documents from different storage buckets
      const buckets = [
        { name: 'blast-chillers', type: 'technical' as const, category: 'Abbattitori' },
        { name: 'ovens', type: 'technical' as const, category: 'Forni' },
        { name: 'manuals', type: 'manual' as const, category: 'Manuali' },
        { name: 'price-lists', type: 'price-list' as const, category: 'Listini' },
        { name: 'compliance', type: 'compliance' as const, category: 'Conformità' }
      ];

      for (const bucket of buckets) {
        try {
          const { data: files, error } = await supabase.storage
            .from('company-documents')
            .list(`${bucket.name}/`, {
              limit: 100,
              offset: 0,
            });

          if (error) {
            console.error(`Error loading documents from ${bucket.name}:`, error);
            continue;
          }

          const bucketDocuments: DocumentItem[] = files?.map(file => {
            // Extract metadata from filename: category_language_originalname or just originalname
            const parts = file.name.split('_');
            let category = bucket.category;
            let language = 'it';
            let originalName = file.name;

            if (parts.length >= 3) {
              category = parts[0] || bucket.category;
              language = parts[1] || 'it';
              originalName = parts.slice(2).join('_') || file.name;
            }

            return {
              id: `${bucket.name}_${file.id || file.name}`,
              name: originalName,
              category: category,
              type: bucket.type,
              language: language,
              size: file.metadata?.size ? (file.metadata.size / 1024 / 1024).toFixed(2) + " MB" : "N/A",
              uploadDate: new Date(file.updated_at || file.created_at || '').toLocaleDateString("it-IT"),
              storage_path: `${bucket.name}/${file.name}`
            };
          }) || [];

          allDocuments.push(...bucketDocuments);
        } catch (error) {
          console.error(`Error processing bucket ${bucket.name}:`, error);
        }
      }

      // Add some fallback documents if storage is empty
      if (allDocuments.length === 0) {
        const fallbackDocs: DocumentItem[] = [
          {
            id: 'fallback_1',
            name: 'Scheda Tecnica Forni Professional.pdf',
            category: 'Forni',
            type: 'technical',
            language: 'it',
            size: '2.1 MB',
            uploadDate: new Date().toLocaleDateString("it-IT"),
            url: '/docs/forni-professional.pdf'
          },
          {
            id: 'fallback_2',
            name: 'Scheda Tecnica Abbattitori Blast.pdf',
            category: 'Abbattitori',
            type: 'technical',
            language: 'it',
            size: '1.8 MB',
            uploadDate: new Date().toLocaleDateString("it-IT"),
            url: '/docs/abbattitori-blast.pdf'
          },
          {
            id: 'fallback_3',
            name: 'Listino Prezzi 2024.pdf',
            category: 'Listini',
            type: 'price-list',
            language: 'it',
            size: '3.2 MB',
            uploadDate: new Date().toLocaleDateString("it-IT"),
            url: '/docs/listino-2024.pdf'
          },
          {
            id: 'fallback_4',
            name: 'Manuale Installazione.pdf',
            category: 'Manuali',
            type: 'manual',
            language: 'it',
            size: '4.5 MB',
            uploadDate: new Date().toLocaleDateString("it-IT"),
            url: '/docs/manuale-installazione.pdf'
          }
        ];
        allDocuments.push(...fallbackDocs);
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