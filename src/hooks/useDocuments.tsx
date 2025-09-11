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

  // Helper: recursively list all files in a folder (includes subfolders)
  const listAllFilesInFolder = async (folder: string) => {
    const results: any[] = [];

    const walk = async (prefix: string) => {
      const { data, error } = await supabase.storage
        .from('documents')
        .list(prefix, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      for (const item of data || []) {
        const isFile = !!(item as any)?.metadata && (item as any).metadata.size !== undefined;
        if (isFile) {
          // Ensure we keep the full path in the name so downstream logic works
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          results.push({ ...item, name: fullPath });
        } else {
          // Treat as folder and walk into it
          const nextPrefix = prefix ? `${prefix}/${item.name}` : item.name;
          await walk(nextPrefix);
        }
      }
    };

    await walk(folder);
    return results;
  };

  const loadDocuments = async () => {
    console.log('🔍 useDocuments: Starting to load documents...');
    
    // Check authentication status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🔍 useDocuments: Auth status:', { user: user?.id, authError });
    
    setLoading(true);
    try {
      const allDocuments: DocumentItem[] = [];

      console.log('🔍 useDocuments: Attempting to load from Supabase storage...');
      
      // Load documents from Supabase storage - root and recursively in blast-chillers
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('documents')
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      // Recursively fetch all files inside blast-chillers (including subfolders)
      let blastChillersFiles: any[] | null = null;
      let blastChillersError: any = null;
      try {
        blastChillersFiles = await listAllFilesInFolder('blast-chillers');
      } catch (e) {
        blastChillersError = e;
      }

      console.log('🔍 useDocuments: Storage response (root):', { storageFiles, storageError });
      console.log('🔍 useDocuments: Blast chillers recursive response:', { count: blastChillersFiles?.length ?? 0, blastChillersError });

      if (storageError && blastChillersError) {
        console.error('Error loading storage files:', storageError, blastChillersError);
        toast.error('Errore durante il caricamento dei documenti dallo storage');
      } else {
        // Combine files from root and all blast-chillers subpaths
        const allStorageFiles: any[] = [...(storageFiles || [])];

        if (blastChillersFiles && !blastChillersError) {
          // blastChillersFiles already contain full path in name
          allStorageFiles.push(...blastChillersFiles);
        }

        console.log('🔍 useDocuments: Found', allStorageFiles.length, 'files in storage total');
        
        if (allStorageFiles.length > 0) {
        // Convert storage files to DocumentItem format
        const storageDocuments: DocumentItem[] = allStorageFiles.map(file => {
          // Determine document type based on file name patterns and folder
          let type: DocumentItem['type'] = 'technical';
          let category = 'Varie';
          let language = 'it';

          const fileName = file.name.toLowerCase();
          const isInBlastChillersFolder = fileName.includes('blast-chillers/');
          
          // If file is in blast-chillers folder, automatically categorize as Abbattitori
          if (isInBlastChillersFolder) {
            category = 'Abbattitori';
            type = 'technical';
          } else {
            // Determine type and category for other files
            if (fileName.includes('listino') || fileName.includes('price')) {
              type = 'price-list';
              category = 'Listini';
            } else if (fileName.includes('manuale') || fileName.includes('manual')) {
              type = 'manual';
              category = 'Manuali';
            } else if (fileName.includes('certificazion') || fileName.includes('compliance') || fileName.includes('conformita')) {
              type = 'compliance';
              category = 'Conformità';
            } else if (fileName.includes('abbattitor') || fileName.includes('blast') || fileName.includes('chiller')) {
              category = 'Abbattitori';
            } else if (fileName.includes('forno') || fileName.includes('oven') || fileName.includes('pizza')) {
              category = 'Forni';
            } else if (fileName.includes('zapper') || fileName.includes('pro')) {
              // I file ZapperPRO sono documenti tecnici per abbattitori
              category = 'Abbattitori';
              type = 'technical';
            }
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

        console.log('🔍 useDocuments: Converted storage documents:', storageDocuments);
        allDocuments.push(...storageDocuments);
        }
      }

      console.log('🔍 useDocuments: Total documents before fallback:', allDocuments.length);

      // Add some static example documents if no real documents are found
      if (allDocuments.length === 0) {
        console.log('🔍 useDocuments: No real documents found, adding static examples...');
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

      console.log('🔍 useDocuments: Final documents array:', allDocuments);
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