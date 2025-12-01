import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const SyncAllVesuvianoLeads = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-all-vesuviano-leads');

      if (error) throw error;

      setSyncResult(data);

      if (data.success) {
        toast({
          title: 'Sincronizzazione completata',
          description: `${data.synced} lead sincronizzati su ${data.total}`,
        });
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Errore durante la sincronizzazione',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Sincronizza Lead Vesuviano
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sincronizzazione Lead Vesuviano</DialogTitle>
          <DialogDescription>
            Questa operazione sincronizzerà tutti i lead della pipeline Vesuviano che non hanno ancora un link configuratore con il sito esterno.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attenzione:</strong> Questa operazione potrebbe richiedere alcuni minuti se ci sono molti lead da sincronizzare.
            I lead verranno processati uno alla volta.
          </AlertDescription>
        </Alert>

        {syncResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Lead sincronizzati: <strong>{syncResult.synced}</strong> / {syncResult.total}</span>
            </div>
            
            {syncResult.failed > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="w-4 h-4" />
                <span>Lead falliti: <strong>{syncResult.failed}</strong></span>
              </div>
            )}

            {syncResult.errors && syncResult.errors.length > 0 && (
              <div className="mt-3 p-3 bg-muted rounded-md max-h-48 overflow-y-auto">
                <p className="text-sm font-medium mb-2">Errori:</p>
                <div className="space-y-1">
                  {syncResult.errors.map((err: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <span className="font-medium">{err.lead_name}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSyncing}
          >
            Chiudi
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizzazione in corso...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Avvia Sincronizzazione
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
