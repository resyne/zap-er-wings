import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Download, Search, PhoneIncoming, PhoneOutgoing, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

interface CallRecord {
  id: string;
  caller_number: string;
  called_number: string;
  service: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  unique_call_id: string;
  recording_url: string | null;
  created_at: string;
}

export default function CallRecordsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: callRecords, isLoading, refetch } = useQuery({
    queryKey: ['call-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select('*')
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false });

      if (error) throw error;
      return data as CallRecord[];
    },
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const downloadRecording = async (recordingUrl: string, uniqueCallId: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .download(recordingUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uniqueCallId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Registrazione scaricata");
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast.error("Errore nel download della registrazione");
    }
  };

  const handleProcessEmails = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-call-records-emails');
      
      if (error) throw error;
      
      toast.success(`Processate ${data.processed} chiamate dalle email. Ignorate: ${data.skipped}, Errori: ${data.errors}`);
      
      refetch();
    } catch (error) {
      console.error('Error processing emails:', error);
      toast.error("Errore nel processare le email");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRecords = callRecords?.filter(record =>
    record.caller_number.includes(searchTerm) ||
    record.called_number.includes(searchTerm) ||
    record.unique_call_id.includes(searchTerm)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Registrazioni Chiamate</h1>
          <p className="text-muted-foreground">
            Le chiamate vengono estratte automaticamente dalle email del centralino
          </p>
        </div>
        <Button onClick={handleProcessEmails} disabled={isProcessing}>
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Elaborazione...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizza Email
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Configurazione Email
          </CardTitle>
          <CardDescription>
            Il centralino deve inviare le email con i dati delle chiamate a questo sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">Formato email richiesto:</p>
              <p>L'email deve contenere nel corpo i seguenti dati:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Numero Chiamante: [numero]</li>
                <li>Numero Chiamato: [numero]</li>
                <li>Servizio: [tipo servizio, es. Chiamate_OUT]</li>
                <li>Data: [formato DD-MM-YYYY]</li>
                <li>Ora: [formato HH-MM-SS]</li>
                <li>Durata: [secondi] Secondi</li>
                <li>ID Univoco Chiamata: [id]</li>
                <li>Allegato MP3 (opzionale): registrazione audio</li>
              </ul>
              <p className="mt-4 font-medium">
                Clicca su "Sincronizza Email" per processare le nuove email e importare le chiamate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrazioni</CardTitle>
            <CardDescription>
              Lista completa delle chiamate registrate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per numero o ID chiamata..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Caricamento...</div>
            ) : !filteredRecords || filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nessuna registrazione trovata
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Ora</TableHead>
                      <TableHead>Chiamante</TableHead>
                      <TableHead>Chiamato</TableHead>
                      <TableHead>Servizio</TableHead>
                      <TableHead>Durata</TableHead>
                      <TableHead>ID Chiamata</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const isOutgoing = record.service.toLowerCase().includes('out');
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(record.call_date), 'dd/MM/yyyy', { locale: it })}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {record.call_time}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isOutgoing ? (
                                <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                              ) : (
                                <PhoneIncoming className="h-4 w-4 text-green-500" />
                              )}
                              {record.caller_number}
                            </div>
                          </TableCell>
                          <TableCell>{record.called_number}</TableCell>
                          <TableCell>
                            <span className="text-xs px-2 py-1 rounded-full bg-secondary">
                              {record.service}
                            </span>
                          </TableCell>
                          <TableCell>{formatDuration(record.duration_seconds)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.unique_call_id}
                          </TableCell>
                          <TableCell className="text-right">
                            {record.recording_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadRecording(record.recording_url!, record.unique_call_id)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Nessuna registrazione
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
