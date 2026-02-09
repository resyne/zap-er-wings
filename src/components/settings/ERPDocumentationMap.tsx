import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Calendar, Wrench, CheckSquare, TrendingUp, Target,
  Users, Building2, DollarSign, FileText, Settings, Phone, MessageCircle,
  ShoppingCart, Truck, Package, Database, Clock, ShieldCheck, Ticket,
  Package2, Boxes, ClipboardCheck, ShoppingBag, BarChart3, Shield,
  UtensilsCrossed, Store, BookOpen, Mail, Palette, Zap, PieChart,
  Bot, Brain, Languages, Mic, ScanSearch, Sparkles, FileSearch, Globe, Send
} from "lucide-react";
import React from "react";

interface PageDoc {
  title: string;
  path: string;
  icon: React.ComponentType<any>;
  description: string;
}

interface SectionDoc {
  section: string;
  color: string;
  pages: PageDoc[];
}

interface AIFeatureDoc {
  title: string;
  icon: React.ComponentType<any>;
  model: string;
  description: string;
  edgeFunction: string;
}

const aiFeatures: AIFeatureDoc[] = [
  { title: "JESSY – Assistente CRM AI", icon: Bot, model: "GPT-4o (OpenAI)", edgeFunction: "crm-ai-assistant", description: "Chatbot conversazionale con tool-calling per gestire lead, clienti, offerte e preventivi tramite linguaggio naturale." },
  { title: "Analisi Priorità Lead", icon: Brain, model: "Gemini 3 Flash", edgeFunction: "analyze-leads-priority", description: "Analisi automatica dei lead con scoring di urgenza (1-10) basato su attività configuratore, messaggi non letti e stallo trattative." },
  { title: "WhatsApp AI Sales Assistant", icon: MessageCircle, model: "Gemini 3 Flash", edgeFunction: "whatsapp-ai-chat", description: "Assistente vendita AI integrato in WhatsApp con risposte automatiche, Knowledge Base e ritardi intelligenti configurabili." },
  { title: "Traduzione Chat WhatsApp", icon: Languages, model: "Gemini 2.5 Flash", edgeFunction: "translate-chat-message", description: "Traduzione automatica bidirezionale dei messaggi WhatsApp con rilevamento lingua e supporto multilingua." },
  { title: "Traduzione Template WhatsApp", icon: Globe, model: "Gemini 2.5 Flash", edgeFunction: "translate-whatsapp-template", description: "Traduzione automatica dei template WhatsApp Business per campagne marketing multilingua." },
  { title: "Traduzione Offerte Commerciali", icon: FileText, model: "Gemini 2.5 Flash", edgeFunction: "translate-offer", description: "Traduzione professionale di offerte commerciali mantenendo formattazione, struttura e tono professionale." },
  { title: "Traduzione Email", icon: Mail, model: "Gemini 2.5 Flash", edgeFunction: "translate-email-content", description: "Traduzione contenuti email per comunicazioni internazionali con clienti e partner." },
  { title: "Analisi Fatture (OCR)", icon: ScanSearch, model: "Gemini 2.5 Flash / GPT-5 Mini", edgeFunction: "analyze-invoice", description: "Estrazione automatica dati da fatture PDF e immagini: fornitore, importi, IVA, date e coordinate bancarie." },
  { title: "Analisi DDT", icon: FileSearch, model: "Gemini 2.5 Flash", edgeFunction: "analyze-ddt", description: "Analisi intelligente dei Documenti di Trasporto con estrazione dati e verifica automatica." },
  { title: "Analisi Documenti", icon: FileSearch, model: "Gemini 2.5 Flash", edgeFunction: "analyze-document", description: "Analisi generica documenti con OCR ed estrazione strutturata di informazioni chiave." },
  { title: "Trascrizione Audio Chiamate", icon: Mic, model: "Whisper (OpenAI)", edgeFunction: "transcribe-call-audio", description: "Trascrizione automatica delle registrazioni telefoniche del centralino con rilevamento lingua." },
  { title: "Analisi Chiamate", icon: Phone, model: "Gemini 2.5 Flash", edgeFunction: "analyze-call-record", description: "Analisi AI del sentiment e generazione riassunto automatico delle chiamate trascritte." },
  { title: "Trascrizione Audio WhatsApp", icon: Mic, model: "Whisper (OpenAI)", edgeFunction: "transcribe-whatsapp-audio", description: "Trascrizione automatica dei messaggi vocali WhatsApp ricevuti dai clienti." },
  { title: "Classificazione Contabile AI", icon: Database, model: "Gemini 3 Flash", edgeFunction: "classify-accounting-entry", description: "Classificazione automatica delle registrazioni contabili con suggerimento conto, centro di costo e competenza." },
  { title: "Strategy Wise Oracle", icon: Sparkles, model: "Gemini 2.5 Flash", edgeFunction: "strategy-wise-oracle", description: "Assistente AI strategico per analisi SWOT, pianificazione obiettivi e suggerimenti di governance aziendale." },
  { title: "Estrazione Dati Lead Webhook", icon: Globe, model: "Gemini 3 Flash", edgeFunction: "external-lead-webhook", description: "Estrazione intelligente dei campi lead da payload webhook esterni con normalizzazione automatica dei dati." },
  { title: "Automazioni Email Lead", icon: Send, model: "Gemini 2.5 Flash", edgeFunction: "send-lead-automation-emails", description: "Generazione contenuti email personalizzati per sequenze di automazione marketing basate su AI." },
];

const erpSections: SectionDoc[] = [
  {
    section: "Direzione",
    color: "bg-blue-100 text-blue-800",
    pages: [
      { title: "Dashboard Direzionale", path: "/direzione/dashboard", icon: LayoutDashboard, description: "Panoramica generale dell'andamento aziendale con KPI principali, grafici di fatturato, ordini e performance." },
      { title: "Calendario Aziendale", path: "/direzione/calendario", icon: Calendar, description: "Calendario condiviso per eventi aziendali, scadenze, ferie, festività e appuntamenti di team." },
      { title: "Riepilogo Operativo", path: "/direzione/riepilogo-operativo", icon: Wrench, description: "Vista riassuntiva dello stato di tutte le commesse, ordini di lavoro e attività operative in corso." },
      { title: "Task Management", path: "/tasks", icon: CheckSquare, description: "Gestione attività con vista Kanban, calendario, task ricorrenti, commenti e assegnazioni a utenti." },
      { title: "Task KPI", path: "/direzione/task-kpi", icon: TrendingUp, description: "Indicatori di performance sulle attività: completamento, tempi medi, carico per utente." },
      { title: "Strategy", path: "/direzione/strategy", icon: Target, description: "Pianificazione strategica aziendale con obiettivi, iniziative e analisi SWOT assistita da AI." },
    ]
  },
  {
    section: "Area Personale",
    color: "bg-indigo-100 text-indigo-800",
    pages: [
      { title: "Dashboard Personale", path: "/personal-area", icon: LayoutDashboard, description: "Dashboard individuale con le proprie attività, appuntamenti, offerte recenti e calendario settimanale." },
      { title: "Calendario Personale", path: "/personal-area/calendario", icon: Calendar, description: "Calendario privato dell'utente per gestire appuntamenti, promemoria e impegni personali." },
    ]
  },
  {
    section: "CRM",
    color: "bg-green-100 text-green-800",
    pages: [
      { title: "Lead", path: "/crm/leads", icon: Users, description: "Gestione lead con pipeline Kanban, filtri avanzati, automazioni, mappa geografica e integrazione WhatsApp." },
      { title: "Lead KPI", path: "/crm/leads/kpi", icon: TrendingUp, description: "Analisi performance commerciale: conversioni, tempi di risposta, valore pipeline e statistiche per agente." },
      { title: "Clienti", path: "/crm/customers", icon: Building2, description: "Anagrafica clienti con contatti, storico ordini, documenti fiscali (P.IVA, SDI, PEC) e comunicazioni." },
      { title: "Preventivatore Costi", path: "/crm/cost-estimator", icon: DollarSign, description: "Strumento per creare preventivi dettagliati con materiali, manodopera, macchinari e margini." },
      { title: "Offerte", path: "/crm/offers", icon: FileText, description: "Creazione e gestione offerte commerciali con template personalizzabili, PDF e invio via email." },
      { title: "Configuratore Prodotti", path: "/crm/product-configurator", icon: Settings, description: "Configuratore interattivo per personalizzare prodotti (modello, potenza, dimensioni) con link condivisibili." },
      { title: "Call Records", path: "/crm/call-records", icon: Phone, description: "Registro chiamate con integrazione centralino, trascrizione audio, analisi AI del sentiment e matching lead." },
      { title: "WhatsApp Business", path: "/crm/whatsapp", icon: MessageCircle, description: "Chat WhatsApp Business integrata con template, traduzione automatica, AI assistant e libreria file." },
      { title: "WaSender", path: "/crm/wasender", icon: MessageCircle, description: "Invio massivo di messaggi WhatsApp per campagne marketing e comunicazioni broadcast." },
    ]
  },
  {
    section: "Commesse",
    color: "bg-orange-100 text-orange-800",
    pages: [
      { title: "Ordini", path: "/direzione/orders", icon: ShoppingCart, description: "Gestione completa ordini clienti con stato, documenti, commenti, file allegati e informazioni finanziarie." },
      { title: "Commesse di Produzione", path: "/mfg/work-orders", icon: Wrench, description: "Ordini di lavoro per la produzione con timeline, articoli, attività e assegnazione tecnici." },
      { title: "Commesse di Lavoro", path: "/support/work-orders", icon: Wrench, description: "Ordini di servizio per interventi tecnici sul campo con pianificazione e rapporti." },
      { title: "Commesse di Spedizione", path: "/warehouse/shipping-orders", icon: Truck, description: "Gestione spedizioni con tracking, commenti, stati e coordinamento logistico." },
      { title: "Rapporti di Intervento", path: "/support/service-reports", icon: FileText, description: "Rapporti dettagliati degli interventi tecnici con firma digitale, foto e materiali utilizzati." },
    ]
  },
  {
    section: "Produzione",
    color: "bg-purple-100 text-purple-800",
    pages: [
      { title: "Anagrafica Prodotti", path: "/mfg/products", icon: Package, description: "Catalogo prodotti con specifiche tecniche, immagini, listini prezzi e varianti configurabili." },
      { title: "Distinte Base (BOM)", path: "/mfg/bom", icon: Database, description: "Gestione distinte base multilivello con composizione materiali, sotto-assiemi e versioning." },
      { title: "Esecuzioni", path: "/mfg/executions", icon: Clock, description: "Monitoraggio avanzamento produzione, tempi di esecuzione e stato di completamento lavorazioni." },
      { title: "Certificazioni", path: "/mfg/certifications", icon: ShieldCheck, description: "Gestione dichiarazioni di conformità, certificati di prodotto e documentazione normativa." },
      { title: "Numeri di Serie", path: "/mfg/serials", icon: Package, description: "Tracciabilità completa dei prodotti tramite numeri seriali con storico e garanzie." },
      { title: "RMA", path: "/mfg/rma", icon: Wrench, description: "Gestione resi e autorizzazioni al reso con tracking dello stato e risoluzione." },
    ]
  },
  {
    section: "Assistenza Tecnica",
    color: "bg-red-100 text-red-800",
    pages: [
      { title: "Dashboard Assistenza", path: "/support", icon: LayoutDashboard, description: "Panoramica richieste di assistenza, ticket aperti, installazioni programmate e statistiche supporto." },
      { title: "Ticket", path: "/support/tickets", icon: Ticket, description: "Sistema di ticketing per richieste di assistenza con priorità, assegnazioni, commenti e SLA." },
    ]
  },
  {
    section: "Magazzino",
    color: "bg-amber-100 text-amber-800",
    pages: [
      { title: "Anagrafica Materiali", path: "/warehouse/materials", icon: Package2, description: "Catalogo materiali e componenti con codici, categorie, fornitori, prezzi e unità di misura." },
      { title: "Scorte", path: "/wms/stock", icon: Boxes, description: "Visualizzazione livelli di scorta in tempo reale con soglie minime e alert di rifornimento." },
      { title: "Movimenti", path: "/wms/movements", icon: Truck, description: "Registro movimenti di magazzino: carichi, scarichi, trasferimenti con causali e riferimenti." },
      { title: "Inventario", path: "/wms/inventory", icon: ClipboardCheck, description: "Gestione inventari fisici con conteggio, riconciliazione differenze e storico verifiche." },
      { title: "DDT", path: "/wms/ddt", icon: FileText, description: "Documenti di trasporto con generazione automatica, verifica AI e condivisione tramite link." },
    ]
  },
  {
    section: "Acquisti",
    color: "bg-teal-100 text-teal-800",
    pages: [
      { title: "Fornitori", path: "/procurement/suppliers", icon: Building2, description: "Anagrafica fornitori con contatti, valutazioni, documenti e storico ordini di acquisto." },
      { title: "Richieste di Offerta (RFQ)", path: "/procurement/rfq", icon: FileText, description: "Creazione e gestione richieste di offerta a fornitori per comparazione prezzi e condizioni." },
      { title: "Ordini di Acquisto", path: "/procurement/po", icon: ShoppingBag, description: "Gestione ordini a fornitore con approvazioni, conferme, tracking consegne e portale fornitore." },
      { title: "Ricevimenti", path: "/procurement/receipts", icon: Package, description: "Registrazione merci in entrata con controllo quantità, qualità e abbinamento a ordini." },
      { title: "Controllo Qualità", path: "/procurement/quality-control", icon: ClipboardCheck, description: "Verifiche qualitative sui materiali ricevuti con checklist, non-conformità e azioni correttive." },
      { title: "Rifornimenti", path: "/procurement/replenishment", icon: BarChart3, description: "Pianificazione rifornimenti automatici basati su scorte minime, lead time e consumi storici." },
    ]
  },
  {
    section: "Partnership",
    color: "bg-cyan-100 text-cyan-800",
    pages: [
      { title: "Importatori", path: "/partnerships/importers", icon: Users, description: "Gestione rete importatori con Kanban, mappa geografica, listini dedicati e comunicazioni." },
      { title: "Installatori", path: "/partnerships/installers", icon: Wrench, description: "Network installatori con qualifiche, zone di competenza, materiali e stato collaborazione." },
      { title: "Rivenditori", path: "/partnerships/resellers", icon: Store, description: "Gestione rivenditori con accordi commerciali, listini, performance e comunicazioni dedicate." },
    ]
  },
  {
    section: "Finanza",
    color: "bg-emerald-100 text-emerald-800",
    pages: [
      { title: "Prima Nota", path: "/finance/prima-nota", icon: FileText, description: "Registrazione movimenti contabili giornalieri con importazione XML fatture e classificazione AI." },
      { title: "Fatture", path: "/finance/invoices", icon: FileText, description: "Gestione fatture attive e passive con importazione elettronica e sincronizzazione Fattura24." },
    ]
  },
  {
    section: "Controllo di Gestione",
    color: "bg-rose-100 text-rose-800",
    pages: [
      { title: "Dashboard CEO", path: "/management-control", icon: LayoutDashboard, description: "Cruscotto direzionale con margini, ricavi, costi, trend e indicatori finanziari chiave." },
      { title: "Setup", path: "/management-control/setup", icon: Settings, description: "Configurazione parametri del controllo di gestione: categorie, centri di costo e regole." },
      { title: "Movimenti", path: "/management-control/movements", icon: FileText, description: "Registrazione e analisi movimenti economici con classificazione per categoria e progetto." },
      { title: "Commesse (Progetti)", path: "/management-control/projects", icon: Target, description: "Analisi economica per commessa: costi, ricavi, margini e confronto con budget." },
      { title: "Budget & Forecast", path: "/management-control/budget", icon: BarChart3, description: "Pianificazione budget annuale per conto e centro, con confronto actual vs previsto." },
      { title: "Crediti e Debiti", path: "/management-control/credits-debts", icon: DollarSign, description: "Monitoraggio crediti verso clienti e debiti verso fornitori con scadenzario e aging." },
    ]
  },
  {
    section: "Controllo di Gestione 2 (Contabilità Avanzata)",
    color: "bg-fuchsia-100 text-fuchsia-800",
    pages: [
      { title: "Registro", path: "/management-control-2/registro", icon: FileText, description: "Registro generale delle operazioni contabili con filtri temporali e ricerca avanzata." },
      { title: "Movimenti Finanziari", path: "/management-control-2/movimenti-finanziari", icon: DollarSign, description: "Dettaglio flussi finanziari: incassi, pagamenti, anticipi e riconciliazione bancaria." },
      { title: "Setup Contabile", path: "/management-control-2/setup-contabile", icon: Settings, description: "Configurazione piano dei conti, centri di costo/ricavo e motore contabile automatico." },
      { title: "Prima Nota Contabile", path: "/management-control-2/prima-nota", icon: Database, description: "Registrazioni contabili in partita doppia con dare/avere, conti e competenza temporale." },
      { title: "Scadenziario", path: "/management-control-2/scadenziario", icon: Clock, description: "Gestione scadenze pagamenti e incassi con alert, solleciti e stato finanziario." },
      { title: "Mastrino Contabile", path: "/management-control-2/mastrino", icon: PieChart, description: "Dettaglio movimenti per singolo conto contabile con saldi progressivi e filtri." },
      { title: "Registro Contabile Fatture", path: "/management-control-2/registro-fatture", icon: FileText, description: "Registro IVA fatture emesse e ricevute con riepilogo aliquote e totali periodici." },
    ]
  },
  {
    section: "Risorse Umane",
    color: "bg-sky-100 text-sky-800",
    pages: [
      { title: "Personale", path: "/hr/people", icon: Users, description: "Anagrafica dipendenti con documenti, formazione, visite mediche, contratti e scadenze." },
      { title: "Sicurezza sul Lavoro", path: "/hr/safety", icon: Shield, description: "Gestione adempimenti sicurezza: DVR, formazione obbligatoria, DPI e scadenze normative." },
      { title: "Tecnici", path: "/hr/technicians", icon: Wrench, description: "Gestione team tecnico con competenze, disponibilità, assegnazioni e calendario interventi." },
      { title: "Fluida", path: "/hr/fluida", icon: Users, description: "Integrazione con Fluida per gestione presenze, timbrature e rilevazione orario di lavoro." },
      { title: "Ticket Restaurant", path: "/hr/ticket-restaurant", icon: UtensilsCrossed, description: "Gestione e assegnazione buoni pasto ai dipendenti con calcolo mensile e report." },
    ]
  },
  {
    section: "Documentazione",
    color: "bg-lime-100 text-lime-800",
    pages: [
      { title: "Dashboard Documentazione", path: "/docs", icon: FileText, description: "Centro documentale con accesso rapido a schede tecniche, manuali, conformità e listini." },
      { title: "Schede Tecniche", path: "/docs/technical-sheets", icon: FileText, description: "Documentazione tecnica prodotti suddivisa per categoria: forni, abbattitori e accessori." },
      { title: "Conformità", path: "/docs/compliance", icon: ShieldCheck, description: "Documenti normativi, certificazioni CE, dichiarazioni di conformità e documentazione regolamentare." },
      { title: "Manuali", path: "/docs/manuals", icon: BookOpen, description: "Manuali d'uso, installazione e manutenzione dei prodotti in formato digitale." },
      { title: "Listini", path: "/docs/price-lists", icon: DollarSign, description: "Listini prezzi ufficiali per brand e mercato con gestione versioni e distribuzione." },
    ]
  },
  {
    section: "Marketing",
    color: "bg-pink-100 text-pink-800",
    pages: [
      { title: "Campagne", path: "/marketing/campaigns", icon: Target, description: "Creazione e gestione campagne marketing multicanale con obiettivi, budget e risultati." },
      { title: "Marketing Automation", path: "/marketing/automation", icon: Zap, description: "Automazioni WhatsApp e email basate su trigger, sequenze temporali e segmentazione lead." },
      { title: "Email Marketing", path: "/marketing/email-marketing", icon: Mail, description: "Newsletter e campagne email con template editor, liste di distribuzione e statistiche invio." },
      { title: "Content Creation", path: "/marketing/content-creation", icon: CheckSquare, description: "Creazione contenuti marketing con assistenza AI per testi, immagini e materiali promozionali." },
      { title: "Archivio Media", path: "/marketing/archive", icon: FileText, description: "Repository centralizzato per documenti, immagini, video e materiali marketing organizzati per categoria." },
      { title: "Brandkit", path: "/marketing/brandkit", icon: Palette, description: "Gestione identità visiva dei brand: loghi, colori, font, linee guida e asset grafici." },
    ]
  },
  {
    section: "Comunicazione",
    color: "bg-violet-100 text-violet-800",
    pages: [
      { title: "Email", path: "/communication/email", icon: Mail, description: "Client email integrato con sincronizzazione IMAP, invio, ricezione e archiviazione messaggi." },
    ]
  },
  {
    section: "Sistema",
    color: "bg-gray-100 text-gray-800",
    pages: [
      { title: "Integrazioni", path: "/integrations", icon: Zap, description: "Configurazione integrazioni esterne: WhatsApp API, Zapier, Fattura24, Resend, Fluida e altri servizi." },
      { title: "Impostazioni", path: "/settings", icon: Settings, description: "Gestione utenti, profili, ruoli, permessi, password, configurazioni di sistema e sicurezza." },
    ]
  },
];

export function ERPDocumentationMap() {
  const totalPages = erpSections.reduce((acc, s) => acc + s.pages.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mappa Completa ERP ZAPPER</h2>
          <p className="text-sm text-muted-foreground">
            {erpSections.length} sezioni · {totalPages} pagine · {aiFeatures.length} funzioni AI
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          v1.1 · Aggiornato Feb 2026
        </Badge>
      </div>

      {/* AI Features Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 font-medium">
              <Sparkles className="h-3 w-3 mr-1" />
              Funzionalità AI Integrate
            </Badge>
            <span className="text-xs text-muted-foreground font-normal">
              {aiFeatures.length} funzioni
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {aiFeatures.map((feature, idx) => (
              <React.Fragment key={feature.edgeFunction}>
                {idx > 0 && <Separator className="my-2" />}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 p-1.5">
                    <feature.icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{feature.title}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {feature.model}
                      </Badge>
                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">
                        {feature.edgeFunction}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {erpSections.map((section) => (
        <Card key={section.section}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge className={section.color + " border-0 font-medium"}>
                {section.section}
              </Badge>
              <span className="text-xs text-muted-foreground font-normal">
                {section.pages.length} {section.pages.length === 1 ? "pagina" : "pagine"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {section.pages.map((page, idx) => (
                <React.Fragment key={page.path}>
                  {idx > 0 && <Separator className="my-2" />}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-muted p-1.5">
                      <page.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{page.title}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">
                          {page.path}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {page.description}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
