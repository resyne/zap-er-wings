import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Upload, 
  Camera, 
  FileText,
  Loader2,
  Plus,
  X,
  Check,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface AccountingEntry {
  id: string;
  direction: 'entrata' | 'uscita';
  document_type: string;
  amount: number;
  document_date: string;
  attachment_url: string;
  payment_method: string | null;
  subject_type: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

type FormStep = 'upload' | 'review' | 'confirm';

const DOCUMENT_TYPES = [
  { value: 'fattura', label: 'Fattura' },
  { value: 'scontrino', label: 'Scontrino / Ricevuta' },
  { value: 'estratto_conto', label: 'Estratto conto' },
  { value: 'documento_interno', label: 'Documento interno' },
  { value: 'rapporto_intervento', label: 'Rapporto di intervento' },
  { value: 'altro', label: 'Altro' },
];

const PAYMENT_METHODS = [
  { value: 'contanti', label: 'Contanti' },
  { value: 'carta', label: 'Carta' },
  { value: 'bonifico', label: 'Bonifico' },
  { value: 'anticipo_personale', label: 'Anticipo personale' },
  { value: 'non_so', label: 'Non so' },
];

const SUBJECT_TYPES = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'fornitore', label: 'Fornitore' },
  { value: 'interno', label: 'Interno' },
];

export default function EntryExitRegisterPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<FormStep>('upload');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [direction, setDirection] = useState<'entrata' | 'uscita' | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [subjectType, setSubjectType] = useState<string>('');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEntries((data || []) as AccountingEntry[]);
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Errore nel caricamento delle registrazioni');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Il file non può superare 10MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('accounting-attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('accounting-attachments')
        .getPublicUrl(fileName);

      setAttachmentUrl(urlData.publicUrl);
      setAttachmentName(file.name);
      
      // Move to AI analysis step
      await analyzeDocument(urlData.publicUrl, file.name);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Errore nel caricamento del file');
    } finally {
      setUploading(false);
    }
  };

  const analyzeDocument = async (url: string, fileName: string) => {
    setAnalyzing(true);
    try {
      // Simulate AI analysis - in production this would call an AI edge function
      // For now, we'll just set some default values and let the user fill in the rest
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Set today's date as default
      setDocumentDate(format(new Date(), 'yyyy-MM-dd'));
      
      // Try to infer document type from filename
      const lowerName = fileName.toLowerCase();
      if (lowerName.includes('fattura')) {
        setDocumentType('fattura');
      } else if (lowerName.includes('scontrino') || lowerName.includes('ricevuta')) {
        setDocumentType('scontrino');
      } else if (lowerName.includes('estratto')) {
        setDocumentType('estratto_conto');
      }
      
      toast.info('Documento analizzato. Controlla i dati e completa le informazioni mancanti.');
      setStep('review');
    } catch (error) {
      console.error('Error analyzing document:', error);
      toast.error('Errore nell\'analisi del documento');
      setStep('review'); // Still move to review even if analysis fails
    } finally {
      setAnalyzing(false);
    }
  };

  const resetForm = () => {
    setStep('upload');
    setAttachmentUrl(null);
    setAttachmentName(null);
    setDirection(null);
    setDocumentType('');
    setAmount('');
    setDocumentDate('');
    setPaymentMethod('');
    setSubjectType('');
    setNote('');
  };

  const handleSubmit = async () => {
    if (!direction) {
      toast.error('Seleziona la direzione (Entrata/Uscita)');
      return;
    }
    if (!documentType) {
      toast.error('Seleziona il tipo di documento');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Inserisci un importo valido');
      return;
    }
    if (!documentDate) {
      toast.error('Inserisci la data del documento');
      return;
    }
    if (!attachmentUrl) {
      toast.error('L\'allegato è obbligatorio');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('accounting_entries')
        .insert({
          user_id: user?.id,
          direction,
          document_type: documentType,
          amount: parseFloat(amount),
          document_date: documentDate,
          attachment_url: attachmentUrl,
          payment_method: paymentMethod || null,
          subject_type: subjectType || null,
          note: note || null,
          status: 'da_classificare'
        });

      if (error) throw error;

      toast.success('Registrazione salvata con successo');
      resetForm();
      loadEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error('Errore nel salvataggio della registrazione');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'da_classificare':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">🟡 Da Classificare</Badge>;
      case 'classificato':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">🔵 Classificato</Badge>;
      case 'registrato':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">🟢 Registrato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Registro Entrate/Uscite</h1>
        <p className="text-muted-foreground">Registra entrate e uscite caricando documenti</p>
      </div>

      {/* New Entry Form */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nuova Registrazione
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                {uploading || analyzing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">
                      {uploading ? 'Caricamento in corso...' : 'Analisi documento in corso...'}
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">
                      Carica una foto o un documento (PDF, JPG, PNG)
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button variant="outline" asChild>
                          <span className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Carica File
                          </span>
                        </Button>
                      </label>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button variant="outline" asChild>
                          <span className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Scatta Foto
                          </span>
                        </Button>
                      </label>
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                📌 Senza allegato → non esiste. Il documento deve essere leggibile.
              </p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              {/* Attachment Preview */}
              {attachmentUrl && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm truncate">{attachmentName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Direction - Required */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Direzione <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={direction === 'entrata' ? 'default' : 'outline'}
                    className={`h-16 flex flex-col items-center gap-1 ${
                      direction === 'entrata' 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'hover:bg-green-50 hover:border-green-300'
                    }`}
                    onClick={() => setDirection('entrata')}
                  >
                    <ArrowUpCircle className="h-6 w-6" />
                    <span className="font-medium">ENTRATA</span>
                  </Button>
                  <Button
                    type="button"
                    variant={direction === 'uscita' ? 'default' : 'outline'}
                    className={`h-16 flex flex-col items-center gap-1 ${
                      direction === 'uscita' 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'hover:bg-red-50 hover:border-red-300'
                    }`}
                    onClick={() => setDirection('uscita')}
                  >
                    <ArrowDownCircle className="h-6 w-6" />
                    <span className="font-medium">USCITA</span>
                  </Button>
                </div>
              </div>

              {/* Document Type - Required */}
              <div className="space-y-2">
                <Label htmlFor="documentType" className="text-sm font-medium">
                  Tipo Documento <span className="text-destructive">*</span>
                </Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount - Required */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">
                  Importo Totale € <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-lg"
                />
              </div>

              {/* Document Date - Required */}
              <div className="space-y-2">
                <Label htmlFor="documentDate" className="text-sm font-medium">
                  Data Documento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                />
              </div>

              {/* Payment Method - Optional */}
              <div className="space-y-2">
                <Label htmlFor="paymentMethod" className="text-sm font-medium">
                  Metodo di Pagamento <span className="text-muted-foreground text-xs">(opzionale)</span>
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Solo se certo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Type - Optional */}
              <div className="space-y-2">
                <Label htmlFor="subjectType" className="text-sm font-medium">
                  Soggetto <span className="text-muted-foreground text-xs">(opzionale)</span>
                </Label>
                <Select value={subjectType} onValueChange={setSubjectType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Solo se evidente" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_TYPES.map(subject => (
                      <SelectItem key={subject.value} value={subject.value}>
                        {subject.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Note - Optional */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-sm font-medium">
                  Nota <span className="text-muted-foreground text-xs">(opzionale, max 140 caratteri)</span>
                </Label>
                <Textarea
                  id="note"
                  placeholder="Es: Pagamento urgente per intervento Napoli"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 140))}
                  maxLength={140}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground text-right">{note.length}/140</p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !direction || !documentType || !amount || !documentDate}
                  className="flex-1"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Registra
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ultime Registrazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nessuna registrazione trovata</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dir.</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.direction === 'entrata' ? (
                          <ArrowUpCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {DOCUMENT_TYPES.find(t => t.value === entry.document_type)?.label || entry.document_type}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        entry.direction === 'entrata' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.direction === 'entrata' ? '+' : '-'}€{entry.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(entry.document_date), 'dd/MM/yy', { locale: it })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
