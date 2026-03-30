import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Globe, Mail, Loader2, CheckCircle2, XCircle, ExternalLink, Copy, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface ScrapingResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

interface GeneratedEmail {
  source: ScrapingResult;
  email: {
    subject: string;
    body: string;
    recipientName: string;
    recipientCompany: string;
  } | null;
  error: string | null;
}

export default function ScrapingPage() {
  const { toast } = useToast();

  // Scraping config
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("it");
  const [language, setLanguage] = useState("it");
  const [maxResults, setMaxResults] = useState(20);

  // Mission config
  const [mission, setMission] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [emailLanguage, setEmailLanguage] = useState("Italiano");

  // State
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [activeTab, setActiveTab] = useState("search");

  const handleScrape = async () => {
    if (!query.trim()) {
      toast({ title: "Errore", description: "Inserisci una query di ricerca", variant: "destructive" });
      return;
    }

    setScraping(true);
    setResults([]);
    setSelectedResults(new Set());
    setGeneratedEmails([]);

    try {
      const { data, error } = await supabase.functions.invoke('apify-scrape', {
        body: { query, location, language, maxResults },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Scraping failed');

      setResults(data.results || []);
      // Select all by default
      setSelectedResults(new Set(data.results?.map((_: any, i: number) => i) || []));

      toast({
        title: "Scraping completato",
        description: `Trovati ${data.resultsCount} risultati per "${query}"`,
      });

      if (data.results?.length > 0) {
        setActiveTab("results");
      }
    } catch (error: any) {
      console.error('Scraping error:', error);
      toast({ title: "Errore", description: error.message || "Errore durante lo scraping", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const handleGenerateEmails = async () => {
    if (selectedResults.size === 0) {
      toast({ title: "Errore", description: "Seleziona almeno un risultato", variant: "destructive" });
      return;
    }
    if (!mission.trim()) {
      toast({ title: "Errore", description: "Inserisci la missione dell'email", variant: "destructive" });
      return;
    }

    setGenerating(true);

    try {
      const selectedData = results.filter((_, i) => selectedResults.has(i));

      const { data, error } = await supabase.functions.invoke('generate-scraping-emails', {
        body: {
          results: selectedData,
          mission,
          senderName,
          senderCompany,
          language: emailLanguage,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Email generation failed');

      setGeneratedEmails(data.emails || []);
      toast({
        title: "Email generate",
        description: `${data.successCount}/${data.totalProcessed} email generate con successo`,
      });

      setActiveTab("emails");
    } catch (error: any) {
      console.error('Email generation error:', error);
      toast({ title: "Errore", description: error.message || "Errore nella generazione email", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const toggleResult = (index: number) => {
    const next = new Set(selectedResults);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedResults(next);
  };

  const toggleAll = () => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map((_, i) => i)));
    }
  };

  const copyEmail = (email: GeneratedEmail) => {
    if (!email.email) return;
    const text = `Oggetto: ${email.email.subject}\n\n${email.email.body}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato", description: "Email copiata negli appunti" });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scraping & Lead Generation</h1>
            <p className="text-sm text-muted-foreground">
              Cerca attività con Apify e genera email personalizzate con AI
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>Ricerca</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2" disabled={results.length === 0}>
              <Search className="h-4 w-4" />
              <span>Risultati {results.length > 0 && `(${results.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2" disabled={generatedEmails.length === 0}>
              <Mail className="h-4 w-4" />
              <span>Email Generate {generatedEmails.length > 0 && `(${generatedEmails.filter(e => e.email).length})`}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scraping Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Configurazione Scraping
                </CardTitle>
                <CardDescription>Configura i parametri di ricerca Google tramite Apify</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Query di ricerca *</Label>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="es: spazzacamino Milano, idraulico Roma..."
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Paese</Label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italia</SelectItem>
                        <SelectItem value="de">Germania</SelectItem>
                        <SelectItem value="fr">Francia</SelectItem>
                        <SelectItem value="es">Spagna</SelectItem>
                        <SelectItem value="gb">Regno Unito</SelectItem>
                        <SelectItem value="us">Stati Uniti</SelectItem>
                        <SelectItem value="at">Austria</SelectItem>
                        <SelectItem value="ch">Svizzera</SelectItem>
                        <SelectItem value="pt">Portogallo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lingua</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="de">Tedesco</SelectItem>
                        <SelectItem value="fr">Francese</SelectItem>
                        <SelectItem value="es">Spagnolo</SelectItem>
                        <SelectItem value="en">Inglese</SelectItem>
                        <SelectItem value="pt">Portoghese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Numero massimo risultati</Label>
                  <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleScrape} disabled={scraping} className="w-full" size="lg">
                  {scraping ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Scraping in corso...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Avvia Scraping
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Mission Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Missione Email
                </CardTitle>
                <CardDescription>Definisci lo scopo delle email che verranno generate dall'AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Missione / Scopo *</Label>
                  <Textarea
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    placeholder="es: Presentazione Programma Partnership ZAPPER - Proporre collaborazione per installazione e manutenzione caminetti..."
                    className="mt-1 min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome mittente</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="es: Mario Rossi"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Azienda mittente</Label>
                    <Input
                      value={senderCompany}
                      onChange={(e) => setSenderCompany(e.target.value)}
                      placeholder="es: ZAPPER"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Lingua email</Label>
                  <Select value={emailLanguage} onValueChange={setEmailLanguage}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Italiano">Italiano</SelectItem>
                      <SelectItem value="Inglese">Inglese</SelectItem>
                      <SelectItem value="Tedesco">Tedesco</SelectItem>
                      <SelectItem value="Francese">Francese</SelectItem>
                      <SelectItem value="Spagnolo">Spagnolo</SelectItem>
                      <SelectItem value="Portoghese">Portoghese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Risultati Scraping</CardTitle>
                  <CardDescription>
                    {selectedResults.size} di {results.length} risultati selezionati
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={toggleAll}>
                    {selectedResults.size === results.length ? "Deseleziona tutti" : "Seleziona tutti"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateEmails}
                    disabled={generating || selectedResults.size === 0 || !mission.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Genera Email ({selectedResults.size})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedResults.size === results.length && results.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead className="w-10">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, i) => (
                      <TableRow key={i} className={selectedResults.has(i) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedResults.has(i)}
                            onCheckedChange={() => toggleResult(i)}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{result.position || i + 1}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{result.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                          {result.description}
                        </TableCell>
                        <TableCell>
                          <a href={result.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold">Email Generate</h3>
              <p className="text-sm text-muted-foreground">
                {generatedEmails.filter(e => e.email).length} email pronte su {generatedEmails.length} totali
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {generatedEmails.map((item, i) => (
              <Card key={i} className={item.error ? "border-destructive/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.email ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <CardTitle className="text-base">{item.source.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.email?.recipientCompany && (
                        <Badge variant="outline">{item.email.recipientCompany}</Badge>
                      )}
                      {item.email && (
                        <Button variant="ghost" size="sm" onClick={() => copyEmail(item)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <a href={item.source.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardHeader>
                {item.email ? (
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Oggetto</Label>
                      <p className="font-medium">{item.email.subject}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Corpo</Label>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 mt-1">
                        {item.email.body}
                      </p>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent>
                    <p className="text-sm text-destructive">{item.error}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
