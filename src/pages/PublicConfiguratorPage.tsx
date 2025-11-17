import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PublicConfiguratorPage() {
  const { code } = useParams();
  const [step, setStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [selectedPower, setSelectedPower] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedInstallation, setSelectedInstallation] = useState<string>("");

  // Fetch link info
  const { data: linkInfo, isLoading: linkLoading } = useQuery({
    queryKey: ["configurator-link", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurator_links")
        .select(`
          *,
          products(*),
          leads(company_name, contact_name)
        `)
        .eq("unique_code", code)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!code,
  });

  // Fetch product configurations
  const { data: configurations } = useQuery({
    queryKey: ["product-configs", linkInfo?.product_id],
    queryFn: async () => {
      if (!linkInfo?.product_id) return [];
      const { data, error } = await supabase
        .from("product_configurations")
        .select("*")
        .eq("product_id", linkInfo.product_id)
        .eq("is_available", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!linkInfo?.product_id,
  });

  // Fetch product media
  const { data: media } = useQuery({
    queryKey: ["product-media-public", linkInfo?.product_id],
    queryFn: async () => {
      if (!linkInfo?.product_id) return [];
      const { data, error } = await supabase
        .from("product_configurator_media")
        .select("*")
        .eq("product_id", linkInfo.product_id)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
    enabled: !!linkInfo?.product_id,
  });

  // Update view count
  const updateViewCount = useMutation({
    mutationFn: async () => {
      if (!linkInfo?.id) return;
      const { error } = await supabase
        .from("product_configurator_links")
        .update({
          view_count: (linkInfo.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", linkInfo.id);
      
      if (error) throw error;
    },
  });

  useEffect(() => {
    if (linkInfo && !updateViewCount.isSuccess) {
      updateViewCount.mutate();
    }
  }, [linkInfo]);

  if (linkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!linkInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Link non valido</h1>
          <p className="text-muted-foreground">Il link non esiste o è scaduto.</p>
        </div>
      </div>
    );
  }

  const product = linkInfo.products;
  
  // Get unique values from configurations
  const models = configurations?.reduce((acc: any[], config: any) => {
    if (!acc.find(m => m.model_name === config.model_name)) {
      acc.push(config);
    }
    return acc;
  }, []) || [];

  const powerTypes = selectedModel
    ? configurations?.filter((c: any) => c.model_name === selectedModel.model_name)
        .map((c: any) => c.power_type)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    : [];

  const sizes = selectedModel && selectedPower
    ? configurations?.filter((c: any) => 
        c.model_name === selectedModel.model_name && c.power_type === selectedPower
      )
        .map((c: any) => c.size)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    : [];

  const installationTypes = selectedModel && selectedPower && selectedSize
    ? configurations?.filter((c: any) => 
        c.model_name === selectedModel.model_name && 
        c.power_type === selectedPower && 
        c.size === selectedSize
      )
        .map((c: any) => c.installation_type)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    : [];

  const canGoNext = () => {
    if (step === 1) return selectedModel !== null;
    if (step === 2) return selectedPower !== "";
    if (step === 3) return selectedSize !== "";
    return false;
  };

  const handleNext = () => {
    if (canGoNext()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const getPowerLabel = (power: string) => {
    const labels: Record<string, string> = {
      electric: "Elettrico",
      gas: "Gas",
      mixed: "Misto",
    };
    return labels[power] || power;
  };

  const getInstallationLabel = (type: string) => {
    const labels: Record<string, string> = {
      shipped: "Spedito",
      installed: "Montato sul posto",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{linkInfo.title}</h1>
              {linkInfo.description && (
                <p className="text-muted-foreground mt-1">{linkInfo.description}</p>
              )}
            </div>
            <Badge variant="outline">{product?.name}</Badge>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="border-b bg-muted/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {[
              { num: 1, label: "Modello" },
              { num: 2, label: "Alimentazione" },
              { num: 3, label: "Dimensione" },
              { num: 4, label: "Installazione" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step >= s.num
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s.num ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      s.num
                    )}
                  </div>
                  <span className="text-xs mt-1">{s.label}</span>
                </div>
                {i < 3 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      step > s.num ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Media */}
            <div className="space-y-4">
              {media && media.length > 0 ? (
                <div className="space-y-4">
                  {media.filter((m: any) => m.media_type === "image").map((img: any) => (
                    <div key={img.id} className="rounded-lg overflow-hidden border">
                      <img
                        src={img.media_url}
                        alt={img.title || product?.name}
                        className="w-full h-auto"
                      />
                      {img.title && (
                        <div className="p-3 bg-muted">
                          <p className="font-medium text-sm">{img.title}</p>
                          {img.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {img.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Nessuna immagine disponibile</p>
                </div>
              )}
            </div>

            {/* Right: Configuration */}
            <div className="space-y-6">
              {/* Step 1: Model Selection */}
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Scegli il modello</h2>
                  <div className="grid gap-3">
                    {models.map((model: any) => (
                      <Card
                        key={model.id}
                        className={`cursor-pointer transition-all ${
                          selectedModel?.id === model.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedModel(model)}
                      >
                        <CardHeader>
                          <CardTitle>{model.model_name}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Power Type */}
              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Scegli l'alimentazione</h2>
                  <div className="grid gap-3">
                    {powerTypes?.map((power: string) => (
                      <Card
                        key={power}
                        className={`cursor-pointer transition-all ${
                          selectedPower === power ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedPower(power)}
                      >
                        <CardHeader>
                          <CardTitle>{getPowerLabel(power)}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Size */}
              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Scegli la dimensione</h2>
                  <div className="grid gap-3">
                    {sizes?.map((size: string) => (
                      <Card
                        key={size}
                        className={`cursor-pointer transition-all ${
                          selectedSize === size ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedSize(size)}
                      >
                        <CardHeader>
                          <CardTitle>{size}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Installation */}
              {step === 4 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Tipo di installazione</h2>
                  <div className="grid gap-3">
                    {installationTypes?.map((type: string) => (
                      <Card
                        key={type}
                        className={`cursor-pointer transition-all ${
                          selectedInstallation === type ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedInstallation(type)}
                      >
                        <CardHeader>
                          <CardTitle>{getInstallationLabel(type)}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>

                  {selectedInstallation && (
                    <Card className="mt-6 bg-primary/5">
                      <CardHeader>
                        <CardTitle>Riepilogo Configurazione</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modello:</span>
                          <span className="font-medium">{selectedModel?.model_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Alimentazione:</span>
                          <span className="font-medium">{getPowerLabel(selectedPower)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dimensione:</span>
                          <span className="font-medium">{selectedSize}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Installazione:</span>
                          <span className="font-medium">{getInstallationLabel(selectedInstallation)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              <Separator />

              {/* Navigation Buttons */}
              <div className="flex gap-4">
                {step > 1 && (
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Indietro
                  </Button>
                )}
                {step < 4 ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canGoNext()}
                    className="flex-1"
                  >
                    Avanti
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => toast.success("Configurazione completata!")}
                    disabled={!selectedInstallation}
                    className="flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Completa
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
