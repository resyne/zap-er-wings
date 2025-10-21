import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UndoableActionOptions {
  duration?: number; // Durata in millisecondi, default 10000 (10 secondi)
  onUndo?: () => void | Promise<void>;
}

/**
 * Hook per gestire azioni con possibilità di annullamento tramite toast
 * Mostra un toast con bottone "Annulla" per 10 secondi
 */
export function useUndoableAction() {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const toastIdRef = useRef<string | number>();

  const executeWithUndo = useCallback(
    async <T extends any>(
      action: () => Promise<T>,
      undoAction: () => Promise<void>,
      options: {
        successMessage: string;
        errorMessage?: string;
        duration?: number;
      }
    ) => {
      const { successMessage, errorMessage = 'Errore durante l\'operazione', duration = 10000 } = options;
      
      try {
        // Esegui l'azione
        const result = await action();
        
        let actionCancelled = false;
        
        // Mostra toast con opzione di annullamento
        const id = toast.success(successMessage, {
          duration: duration,
          action: {
            label: 'Annulla',
            onClick: async () => {
              actionCancelled = true;
              // Cancella il timeout se esiste
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
              
              try {
                await undoAction();
                toast.success('Azione annullata');
              } catch (error) {
                toast.error('Errore durante l\'annullamento');
              }
            },
          },
        });
        
        toastIdRef.current = id;
        
        // Imposta timeout per rimuovere l'opzione di annullamento
        timeoutRef.current = setTimeout(() => {
          if (!actionCancelled) {
            // L'azione è stata confermata (non annullata)
            toastIdRef.current = undefined;
          }
        }, duration);
        
        return result;
      } catch (error: any) {
        toast.error(errorMessage + ': ' + error.message);
        throw error;
      }
    },
    []
  );

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return { executeWithUndo, cleanup };
}
