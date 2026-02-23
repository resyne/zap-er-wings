import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Megaphone,
  User,
  AlertTriangle,
  Palmtree,
  Info,
  Zap,
  Check,
  Clock,
  MessageCircle,
  ChevronRight,
  Mail,
  MailOpen,
  Filter,
  Plus,
  Send,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

type CommType = "announcement" | "personal" | "formal_warning" | "vacation_request" | "vacation_response" | "info" | "urgent";

const typeConfig: Record<CommType, { label: string; icon: any; bg: string; border: string; text: string }> = {
  announcement: { label: "Comunicazione aziendale", icon: Megaphone, bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  personal: { label: "Personale", icon: User, bg: "bg-slate-50", border: "border-l-slate-500", text: "text-slate-700" },
  formal_warning: { label: "Richiamo formale", icon: AlertTriangle, bg: "bg-red-50", border: "border-l-red-500", text: "text-red-700" },
  vacation_request: { label: "Richiesta ferie", icon: Palmtree, bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700" },
  vacation_response: { label: "Risposta ferie", icon: Check, bg: "bg-teal-50", border: "border-l-teal-500", text: "text-teal-700" },
  info: { label: "Informativa", icon: Info, bg: "bg-sky-50", border: "border-l-sky-500", text: "text-sky-700" },
  urgent: { label: "Urgente", icon: Zap, bg: "bg-amber-50", border: "border-l-amber-500", text: "text-amber-700" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Bassa", className: "bg-slate-100 text-slate-700" },
  normal: { label: "Normale", className: "bg-blue-100 text-blue-700" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgente", className: "bg-red-100 text-red-700" },
};

type FilterType = "all" | "unread" | CommType;

const employeeCommTypes = [
  { value: "vacation_request", label: "Richiesta ferie", icon: Palmtree },
  { value: "personal", label: "Messaggio personale", icon: User },
  { value: "info", label: "Segnalazione", icon: Info },
];

export default function ZAppComunicazioniPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedComm, setSelectedComm] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [composeType, setComposeType] = useState("vacation_request");

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["internal-communications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_communications")
        .select("*, sender:profiles!internal_communications_sender_id_fkey(first_name, last_name, email)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("internal_communications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-communications"] });
    },
  });

  const sendComm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("internal_communications").insert({
        title: composeTitle,
        content: composeContent,
        communication_type: composeType,
        priority: "normal",
        sender_id: user?.id,
        recipient_id: null, // goes to admin/all
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-communications"] });
      setShowCompose(false);
      setComposeTitle("");
      setComposeContent("");
      setComposeType("vacation_request");
    },
  });

  const handleOpenComm = (comm: any) => {
    setSelectedComm(comm);
    if (!comm.is_read) {
      markAsRead.mutate(comm.id);
    }
  };

  const filteredComms = communications.filter((c: any) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !c.is_read;
    return c.communication_type === activeFilter;
  });

  const unreadCount = communications.filter((c: any) => !c.is_read).length;

  const filterOptions: { value: FilterType; label: string; icon?: any }[] = [
    { value: "all", label: "Tutte" },
    { value: "unread", label: `Non lette (${unreadCount})` },
    { value: "announcement", label: "Aziendali", icon: Megaphone },
    { value: "personal", label: "Personali", icon: User },
    { value: "formal_warning", label: "Richiami", icon: AlertTriangle },
    { value: "vacation_request", label: "Ferie", icon: Palmtree },
    { value: "info", label: "Info", icon: Info },
    { value: "urgent", label: "Urgenti", icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-rose-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Comunicazioni</h1>
            <p className="text-rose-200 text-xs">
              {unreadCount > 0 ? `${unreadCount} non lette` : "Nessuna non letta"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-3 bg-background border-b overflow-x-auto">
          <div className="flex gap-2">
            {filterOptions.map((f) => (
              <button
                key={f.value}
                onClick={() => { setActiveFilter(f.value); setShowFilters(false); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f.value
                    ? "bg-rose-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filter indicator */}
      {activeFilter !== "all" && (
        <div className="px-4 pt-2">
          <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setActiveFilter("all")}>
            Filtro: {filterOptions.find(f => f.value === activeFilter)?.label} ✕
          </Badge>
        </div>
      )}

      {/* Communications list */}
      <div className="px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredComms.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              {activeFilter === "unread" ? "Nessuna comunicazione non letta" : "Nessuna comunicazione"}
            </p>
          </div>
        ) : (
          filteredComms.map((comm: any) => {
            const cfg = typeConfig[comm.communication_type as CommType] || typeConfig.info;
            const Icon = cfg.icon;
            const pri = priorityConfig[comm.priority] || priorityConfig.normal;
            const senderName = comm.sender
              ? `${comm.sender.first_name || ""} ${comm.sender.last_name || ""}`.trim() || comm.sender.email
              : "Sistema";

            return (
              <button
                key={comm.id}
                onClick={() => handleOpenComm(comm)}
                className={`w-full text-left rounded-xl border-l-4 ${cfg.border} ${
                  comm.is_read ? "bg-background" : cfg.bg
                } p-3 shadow-sm active:scale-[0.98] transition-all ${
                  !comm.is_read ? "ring-1 ring-inset ring-rose-200" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${comm.is_read ? "bg-muted" : "bg-white/80"} ${cfg.text}`}>
                    {comm.is_read ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${comm.is_read ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {comm.title}
                      </p>
                      {!comm.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{senderName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>
                      {comm.priority !== "normal" && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${pri.className}`}>{pri.label}</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(parseISO(comm.created_at), { addSuffix: true, locale: it })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedComm} onOpenChange={(o) => !o && setSelectedComm(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl overflow-y-auto">
          {selectedComm && <CommDetailSheet comm={selectedComm} />}
        </SheetContent>
      </Sheet>

      {/* FAB - Compose */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-rose-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Compose Sheet */}
      <Sheet open={showCompose} onOpenChange={setShowCompose}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Invia Comunicazione
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tipo</Label>
              <Select value={composeType} onValueChange={setComposeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employeeCommTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Titolo</Label>
              <Input
                value={composeTitle}
                onChange={(e) => setComposeTitle(e.target.value)}
                placeholder="Oggetto del messaggio"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Messaggio</Label>
              <Textarea
                value={composeContent}
                onChange={(e) => setComposeContent(e.target.value)}
                placeholder="Scrivi qui..."
                rows={4}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendComm.mutate()}
              disabled={!composeTitle.trim() || !composeContent.trim() || sendComm.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendComm.isPending ? "Invio..." : "Invia"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CommDetailSheet({ comm }: { comm: any }) {
  const cfg = typeConfig[comm.communication_type as CommType] || typeConfig.info;
  const Icon = cfg.icon;
  const pri = priorityConfig[comm.priority] || priorityConfig.normal;
  const senderName = comm.sender
    ? `${comm.sender.first_name || ""} ${comm.sender.last_name || ""}`.trim() || comm.sender.email
    : "Sistema";

  return (
    <>
      <SheetHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${cfg.bg} ${cfg.text}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-left text-base leading-tight">{comm.title}</SheetTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
              {comm.priority !== "normal" && (
                <Badge className={`text-xs ${pri.className}`}>{pri.label}</Badge>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-4">
        {/* Sender & date info */}
        <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{senderName}</span>
          </div>
          <span className="text-muted-foreground text-xs">
            {format(parseISO(comm.created_at), "d MMM yyyy, HH:mm", { locale: it })}
          </span>
        </div>

        {/* Recipient info */}
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          {comm.recipient_id ? "Comunicazione personale" : "Comunicazione a tutti i dipendenti"}
        </div>

        {/* Content */}
        <div className="bg-background border rounded-xl p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{comm.content}</p>
        </div>

        {/* Read status */}
        {comm.read_at && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Check className="h-3 w-3" />
            Letta il {format(parseISO(comm.read_at), "d MMM yyyy alle HH:mm", { locale: it })}
          </p>
        )}
      </div>
    </>
  );
}
