import { useState, useEffect } from "react";
// import { supabase } from "@/integrations/supabase/client"; // Temporarily disabled due to RLS issues
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

      // Using static documents due to RLS policy issues
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
          name: 'Scheda Tecnica Forni Compact Serie FC.pdf',
          category: 'Forni',
          type: 'technical',
          language: 'it',
          size: '1.9 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/forni-compact.pdf'
        },
        {
          id: 'tech_3',
          name: 'Scheda Tecnica Abbattitori Blast Serie AB.pdf',
          category: 'Abbattitori',
          type: 'technical',
          language: 'it',
          size: '1.8 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/abbattitori-blast.pdf'
        },
        {
          id: 'tech_4',
          name: 'Scheda Tecnica Abbattitori Rapid Serie AR.pdf',
          category: 'Abbattitori',
          type: 'technical',
          language: 'it',
          size: '2.2 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/abbattitori-rapid.pdf'
        },
        {
          id: 'price_1',
          name: 'Listino Prezzi 2024 Italia.pdf',
          category: 'Listini',
          type: 'price-list',
          language: 'it',
          size: '3.2 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/listino-2024-it.pdf'
        },
        {
          id: 'price_2',
          name: 'Price List 2024 Europe.pdf',
          category: 'Listini',
          type: 'price-list',
          language: 'en',
          size: '3.1 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/pricelist-2024-en.pdf'
        },
        {
          id: 'manual_1',
          name: 'Manuale Installazione Forni.pdf',
          category: 'Manuali',
          type: 'manual',
          language: 'it',
          size: '4.5 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/manuale-installazione-forni.pdf'
        },
        {
          id: 'manual_2',
          name: 'Manuale Manutenzione Abbattitori.pdf',
          category: 'Manuali',
          type: 'manual',
          language: 'it',
          size: '3.8 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/manuale-manutenzione-abbattitori.pdf'
        },
        {
          id: 'comp_1',
          name: 'Certificazioni CE Conformità.pdf',
          category: 'Conformità',
          type: 'compliance',
          language: 'it',
          size: '1.2 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/certificazioni-ce.pdf'
        },
        {
          id: 'comp_2',
          name: 'Certificazioni NSF Igiene Alimentare.pdf',
          category: 'Conformità',
          type: 'compliance',
          language: 'it',
          size: '0.9 MB',
          uploadDate: new Date().toLocaleDateString("it-IT"),
          url: '/docs/certificazioni-nsf.pdf'
        }
      ];

      allDocuments.push(...staticDocs);

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