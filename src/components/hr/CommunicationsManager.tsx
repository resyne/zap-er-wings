import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SendCommunicationDialog } from "./SendCommunicationDialog";
import {
  Send,
  Search,
  Megaphone,
  User,
  AlertTriangle,
  Palmtree,
  Info,
  Zap,
  Check,
  MailOpen,
  Mail,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

const typeLabels: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  announcement: { label: "Aziendale", icon: Megaphone, variant: "default" },
  personal: { label: "Personale", icon: User, variant: "secondary" },
  formal_warning: { label: "Richiamo", icon: AlertTriangle, variant: "destructive" },
  vacation_request: { label: "Rich. Ferie", icon: Palmtree, variant: "outline" },
  vacation_response: { label: "Risp. Ferie", icon: Check, variant: "outline" },
  info: { label: "Info", icon: Info, variant: "secondary" },
  urgent: { label: "Urgente", icon: Zap, variant: "destructive" },
};

export function CommunicationsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["admin-communications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_communications")
        .select("*, sender:profiles!internal_communications_sender_id_fkey(first_name, last_name, email), recipient:profiles!internal_communications_recipient_id_fkey(first_name, last_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = communications.filter((c: any) =>
    `${c.title} ${c.content} ${c.sender?.first_name || ""} ${c.sender?.last_name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: communications.length,
    unread: communications.filter((c: any) => !c.is_read).length,
    announcements: communications.filter((c: any) => c.communication_type === "announcement").length,
    warnings: communications.filter((c: any) => c.communication_type === "formal_warning").length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Totale inviate</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Non lette</p>
            <p className="text-2xl font-bold text-orange-600">{stats.unread}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Aziendali</p>
            <p className="text-2xl font-bold text-blue-600">{stats.announcements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Richiami</p>
            <p className="text-2xl font-bold text-red-600">{stats.warnings}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Comunicazioni Inviate ({filtered.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cerca comunicazioni..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Nuova
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((comm: any) => {
                  const tl = typeLabels[comm.communication_type] || typeLabels.info;
                  const Icon = tl.icon;
                  const recipientName = comm.recipient
                    ? `${comm.recipient.first_name || ""} ${comm.recipient.last_name || ""}`.trim() || comm.recipient.email
                    : "Tutti";

                  return (
                    <TableRow key={comm.id}>
                      <TableCell>
                        {comm.is_read ? (
                          <MailOpen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Mail className="h-4 w-4 text-orange-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tl.variant} className="text-xs">
                          <Icon className="h-3 w-3 mr-1" />
                          {tl.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{comm.title}</TableCell>
                      <TableCell>
                        <span className="text-sm">{recipientName}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{comm.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(comm.created_at), "d MMM yyyy HH:mm", { locale: it })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nessuna comunicazione trovata
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SendCommunicationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
