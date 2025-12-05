import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number) => void;
}

export function useNetworkRetry() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const executeWithRetry = useCallback(async <T,>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T | null> => {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      onRetry
    } = options;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt);
        if (attempt > 0) {
          setIsRetrying(true);
          onRetry?.(attempt);
        }
        
        const result = await fn();
        setIsRetrying(false);
        setRetryCount(0);
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a network error
        const isNetworkError = 
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('NetworkError') ||
          error.message?.includes('network') ||
          error.code === 'NETWORK_ERROR';
        
        if (!isNetworkError || attempt === maxRetries) {
          setIsRetrying(false);
          setRetryCount(0);
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        
        if (attempt < maxRetries) {
          toast({
            title: "Problema di connessione",
            description: `Tentativo ${attempt + 1}/${maxRetries + 1}. Riprovo tra ${delay / 1000}s...`,
            variant: "default",
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setIsRetrying(false);
    setRetryCount(0);
    
    // Show final error
    toast({
      title: "Errore di connessione",
      description: "Impossibile connettersi al server. Verifica la tua connessione internet e riprova.",
      variant: "destructive",
    });
    
    return null;
  }, [toast]);

  const isNetworkError = useCallback((error: any): boolean => {
    return (
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      error?.message?.includes('network') ||
      error?.code === 'NETWORK_ERROR'
    );
  }, []);

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    isNetworkError
  };
}
