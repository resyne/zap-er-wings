import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Lock, Package, Clock, CheckCircle, AlertCircle, MessageSquare, Paperclip } from "lucide-react";

export default function SupplierPortalPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supplierData, setSupplierData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  // Check if already authenticated from sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem(`supplier_token_${supplierId}`);
    if (token) {
      const [storedSupplierId, storedCode] = token.split(':');
      if (storedSupplierId === supplierId) {
        setAccessCode(storedCode);
        handleAccess(storedCode);
      }
    }
  }, [supplierId]);

  const handleAccess = async (code?: string) => {
    const codeToUse = code || accessCode;
    if (!codeToUse || !supplierId) {
      toast.error("Inserisci il codice di accesso");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-portal-access', {
        body: { supplierId, accessCode: codeToUse }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        sessionStorage.removeItem(`supplier_token_${supplierId}`);
        return;
      }

      setIsAuthenticated(true);
      setSupplierData(data.supplier);
      setOrders(data.orders || []);
      sessionStorage.setItem(`supplier_token_${supplierId}`, data.accessToken);
      toast.success(`Benvenuto, ${data.supplier.name}!`);
    } catch (error: any) {
      console.error('Access error:', error);
      toast.error("Errore durante l'accesso");
      sessionStorage.removeItem(`supplier_token_${supplierId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "In Attesa", variant: "secondary" as const, icon: Clock },
      confirmed: { label: "Confermato", variant: "default" as const, icon: CheckCircle },
      in_production: { label: "In Produzione", variant: "default" as const, icon: Package },
      shipped: { label: "Spedito", variant: "default" as const, icon: CheckCircle },
      delivered: { label: "Consegnato", variant: "default" as const, icon: CheckCircle },
      cancelled: { label: "Annullato", variant: "destructive" as const, icon: AlertCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Portale Fornitori</CardTitle>
            <CardDescription>
              Inserisci il codice di accesso per visualizzare i tuoi ordini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Codice di accesso"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAccess()}
                className="text-center text-lg tracking-widest"
                maxLength={8}
              />
            </div>
            <Button 
              onClick={() => handleAccess()} 
              className="w-full" 
              size="lg"
              disabled={isLoading || accessCode.length < 6}
            >
              {isLoading ? "Verifica in corso..." : "Accedi"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{supplierData?.name}</h1>
              <p className="text-muted-foreground mt-1">
                Portale di gestione ordini • {orders.length} ordini totali
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                sessionStorage.removeItem(`supplier_token_${supplierId}`);
                setIsAuthenticated(false);
              }}
            >
              Esci
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="active">Attivi ({orders.filter(o => !['delivered', 'cancelled'].includes(o.production_status)).length})</TabsTrigger>
            <TabsTrigger value="pending">Da Confermare ({orders.filter(o => o.production_status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="completed">Completati ({orders.filter(o => o.production_status === 'delivered').length})</TabsTrigger>
            <TabsTrigger value="all">Tutti</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {orders.filter(o => !['delivered', 'cancelled'].includes(o.production_status)).map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {orders.filter(o => o.production_status === 'pending').map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {orders.filter(o => o.production_status === 'delivered').map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OrderCard({ order, getStatusBadge }: any) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-xl">{order.number}</CardTitle>
              {getStatusBadge(order.production_status)}
            </div>
            <CardDescription className="mt-2">
              Ordinato il {new Date(order.created_at).toLocaleDateString('it-IT')}
              {order.expected_delivery_date && (
                <> • Consegna prevista: {new Date(order.expected_delivery_date).toLocaleDateString('it-IT')}</>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              €{order.total_amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">Totale ordine</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        {order.purchase_order_items && order.purchase_order_items.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground">Articoli</h4>
            <div className="space-y-2">
              {order.purchase_order_items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">{item.material?.name || item.description}</div>
                    <div className="text-sm text-muted-foreground">Quantità: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      €{item.unit_price?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Tot: €{(item.quantity * item.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Commenti ({order.purchase_order_comments?.[0]?.count || 0})
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Paperclip className="h-4 w-4" />
            Allegati ({order.purchase_order_attachments?.[0]?.count || 0})
          </Button>
          {order.production_status === 'pending' && (
            <Button size="sm" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Conferma Ordine
            </Button>
          )}
          {order.production_status === 'confirmed' && (
            <Button size="sm" variant="secondary" className="gap-2">
              <Package className="h-4 w-4" />
              Aggiorna Stato
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}