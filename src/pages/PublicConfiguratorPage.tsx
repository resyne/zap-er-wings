import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Flame, Zap, Logs, Truck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/formatAmount";

const getPowerIcon = (powerType: string) => {
  if (powerType === "Elettrico") return <Zap className="h-5 w-5" />;
  if (powerType === "Gas") return <Flame className="h-5 w-5" />;
  return <Logs className="h-5 w-5" />;
};

export default function PublicConfiguratorPage() {
  const { code } = useParams();
  const [step, setStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedPower, setSelectedPower] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<string>("");
  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  // Fetch configurator link details if code is provided
  const { data: linkData } = useQuery({
    queryKey: ["configurator-link", code],
    queryFn: async () => {
      if (!code) return null;
      
      const { data, error } = await supabase
        .from("configurator_links")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!code,
  });

  // Auto-select preselected values from link
  useEffect(() => {
    if (linkData) {
      if (linkData.preselected_model) {
        setSelectedModel(linkData.preselected_model);
      }
      if (linkData.preselected_power) {
        setSelectedPower(linkData.preselected_power);
      }
      if (linkData.preselected_size) {
        setSelectedSize(linkData.preselected_size);
      }
    }
  }, [linkData]);

  // Fetch all configurations
  const { data: configurations, isLoading } = useQuery({
    queryKey: ["public-configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurations")
        .select("*")
        .eq("is_available", true)
        .order("model_name")
        .order("size");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch shipping prices
  const { data: shippingPrices } = useQuery({
    queryKey: ["shipping-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_prices")
        .select("*")
        .order("size_cm");
      if (error) throw error;
      return data;
    },
  });

  // Get unique models
  const models = configurations?.reduce((acc: any[], config: any) => {
    if (!acc.find(m => m === config.model_name)) {
      acc.push(config.model_name);
    }
    return acc;
  }, []) || [];

  // Get power types for selected model
  const powerTypes = configurations
    ?.filter((c: any) => c.model_name === selectedModel)
    .reduce((acc: any[], config: any) => {
      if (!acc.find(p => p === config.power_type)) {
        acc.push(config.power_type);
      }
      return acc;
    }, []) || [];

  // Get sizes for selected model and power
  const sizes = configurations
    ?.filter((c: any) => c.model_name === selectedModel && c.power_type === selectedPower)
    .map((c: any) => ({
      size: c.size_cm,
      pizzaCount: c.power_type === "Legna" ? c.pizza_count_wood : c.pizza_count_gas_electric,
      basePrice: c.base_price_wood,
      priceGas: c.price_gas,
      priceElectric: c.price_electric,
      priceInstallation: c.price_onsite_installation,
    })) || [];

  // Get current configuration
  const currentConfig = configurations?.find(
    (c: any) =>
      c.model_name === selectedModel &&
      c.power_type === selectedPower &&
      c.size_cm === selectedSize
  );

  // Calculate price
  const getConfigPrice = () => {
    if (!currentConfig) return 0;
    
    let basePrice = currentConfig.base_price_wood;
    if (selectedPower === "Gas" && currentConfig.price_gas > 0) {
      basePrice = currentConfig.price_gas;
    } else if (selectedPower === "Elettrico" && currentConfig.price_electric > 0) {
      basePrice = currentConfig.price_electric;
    }
    
    return basePrice;
  };

  const getInstallationPrice = () => {
    if (selectedInstallation === "shipping" && selectedSize) {
      const shippingPrice = shippingPrices?.find((p: any) => p.size_cm === selectedSize);
      return shippingPrice?.price || 0;
    } else if (selectedInstallation === "onsite" && currentConfig) {
      return currentConfig.price_onsite_installation || 0;
    }
    return 0;
  };

  const getTotalPrice = () => {
    return getConfigPrice() + getInstallationPrice();
  };

  const canGoNext = () => {
    if (step === 1) return !!selectedModel;
    if (step === 2) return !!selectedPower;
    if (step === 3) return !!selectedSize;
    if (step === 4) return !!selectedInstallation;
    if (step === 5) return !!customerData.name && !!customerData.email;
    return false;
  };

  const handleNext = () => {
    if (canGoNext()) {
      setStep(step + 1);
    }
  };

  const handleComplete = async () => {
    if (!code || !customerData.name || !customerData.email) {
      toast.error("Compila tutti i campi richiesti");
      return;
    }

    try {
      const { error } = await supabase
        .from("configurator_links")
        .update({
          customer_name: customerData.name,
          customer_email: customerData.email,
          customer_phone: customerData.phone || null,
          customer_company: customerData.company || null,
          selected_model: selectedModel,
          selected_power: selectedPower,
          selected_size: selectedSize,
          selected_installation: selectedInstallation,
          total_price: getTotalPrice(),
          configuration_data: {
            model: selectedModel,
            power: selectedPower,
            size: selectedSize,
            installation: selectedInstallation,
            configPrice: getConfigPrice(),
            installationPrice: getInstallationPrice(),
            totalPrice: getTotalPrice(),
          },
          submitted_at: new Date().toISOString(),
          status: "submitted",
        })
        .eq("code", code);

      if (error) throw error;

      toast.success("Richiesta inviata con successo! Verrai contattato a breve.");
      setStep(6); // Success state
    } catch (error: any) {
      console.error("Error submitting configuration:", error);
      toast.error("Errore nell'invio della richiesta. Riprova.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Configuratore Forni</h1>
          <p className="text-muted-foreground">Configura il tuo forno perfetto</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Passo {step} di 6</span>
            <span className="text-sm text-muted-foreground">{Math.round((step / 6) * 100)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Configuration Steps */}
          <div className="space-y-6">
            {/* Step 1: Model */}
            {step >= 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {step > 1 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    1. Scegli il Modello
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                    <div className="grid grid-cols-2 gap-4">
                      {models.map((model: string) => (
                        <div key={model} className="relative">
                          <RadioGroupItem
                            value={model}
                            id={`model-${model}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`model-${model}`}
                            className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent transition-colors"
                          >
                            <span className="font-semibold">{model}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Power Type */}
            {step >= 2 && selectedModel && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {step > 2 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    2. Scegli l'Alimentazione
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedPower} onValueChange={setSelectedPower}>
                    <div className="grid grid-cols-2 gap-4">
                      {powerTypes.map((power: string) => (
                        <div key={power} className="relative">
                          <RadioGroupItem
                            value={power}
                            id={`power-${power}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`power-${power}`}
                            className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent transition-colors gap-2"
                          >
                            {getPowerIcon(power)}
                            <span className="font-semibold">{power}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Size */}
            {step >= 3 && selectedPower && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {step > 3 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    3. Scegli la Dimensione
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={selectedSize?.toString()}
                    onValueChange={(v) => setSelectedSize(parseInt(v))}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {sizes.map((sizeData: any) => (
                        <div key={sizeData.size} className="relative">
                          <RadioGroupItem
                            value={sizeData.size.toString()}
                            id={`size-${sizeData.size}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`size-${sizeData.size}`}
                            className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent transition-colors"
                          >
                            <span className="text-2xl font-bold">{sizeData.size}cm</span>
                            <span className="text-sm text-muted-foreground">{sizeData.pizzaCount}</span>
                            <span className="text-lg font-semibold mt-2">
                              {formatAmount(
                                selectedPower === "Gas" && sizeData.priceGas > 0
                                  ? sizeData.priceGas
                                  : selectedPower === "Elettrico" && sizeData.priceElectric > 0
                                  ? sizeData.priceElectric
                                  : sizeData.basePrice
                              )}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Installation */}
            {step >= 4 && selectedSize && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {step > 4 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    4. Opzioni Aggiuntive e Riepilogo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedInstallation} onValueChange={setSelectedInstallation}>
                    <div className="space-y-3">
                      <div className="relative">
                        <RadioGroupItem
                          value="shipping"
                          id="install-shipping"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="install-shipping"
                          className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent transition-colors"
                        >
                          <Truck className="h-5 w-5 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold">Spedizione</div>
                            <div className="text-sm text-muted-foreground">
                              In Europa, con imballaggio cassonato in legno
                            </div>
                            <div className="text-lg font-bold mt-1">
                              {formatAmount(
                                shippingPrices?.find((p: any) => p.size_cm === selectedSize)?.price || 0
                              )}
                            </div>
                          </div>
                        </Label>
                      </div>

                      <div className="relative">
                        <RadioGroupItem
                          value="onsite"
                          id="install-onsite"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="install-onsite"
                          className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-accent transition-colors"
                        >
                          <Wrench className="h-5 w-5 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold">Montaggio sul Posto</div>
                            <div className="text-sm text-muted-foreground">
                              Servizio di montaggio professionale
                            </div>
                            <div className="text-lg font-bold mt-1">
                              {formatAmount(currentConfig?.price_onsite_installation || 0)}
                            </div>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Customer Info */}
            {step >= 5 && step !== 6 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    5. I Tuoi Dati
                  </CardTitle>
                  <CardDescription>
                    Inserisci i tuoi dati per ricevere il preventivo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome e Cognome *</Label>
                    <Input
                      id="name"
                      placeholder="Mario Rossi"
                      value={customerData.name}
                      onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="mario.rossi@example.com"
                      value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+39 123 456 7890"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Azienda</Label>
                    <Input
                      id="company"
                      placeholder="Nome Azienda"
                      value={customerData.company}
                      onChange={(e) => setCustomerData({ ...customerData, company: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Success Message */}
            {step === 6 && (
              <Card className="border-green-600">
                <CardContent className="py-12 text-center space-y-4">
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Richiesta Inviata!</h3>
                    <p className="text-muted-foreground">
                      Grazie per aver configurato il tuo forno. Verrai contattato a breve dal nostro team commerciale.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            {step < 6 && (
              <div className="flex gap-4">
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                    Indietro
                  </Button>
                )}
                {step < 5 ? (
                  <Button onClick={handleNext} disabled={!canGoNext()} className="flex-1">
                    Avanti
                  </Button>
                ) : (
                  <Button onClick={handleComplete} disabled={!canGoNext()} className="flex-1">
                    Richiedi Preventivo
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card>
              <CardHeader>
                <CardTitle>Riepilogo Configurazione</CardTitle>
                <CardDescription>Consegna: 6 settimane</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedModel && (
                  <div>
                    <div className="text-sm text-muted-foreground">Modello</div>
                    <div className="font-semibold">{selectedModel}</div>
                  </div>
                )}

                {selectedPower && (
                  <div>
                    <div className="text-sm text-muted-foreground">Alimentazione</div>
                    <div className="flex items-center gap-2 font-semibold">
                      {getPowerIcon(selectedPower)}
                      {selectedPower}
                    </div>
                  </div>
                )}

                {selectedSize && (
                  <div>
                    <div className="text-sm text-muted-foreground">Dimensione</div>
                    <div className="font-semibold">
                      {selectedSize}cm -{" "}
                      {currentConfig?.power_type === "Legna"
                        ? currentConfig?.pizza_count_wood
                        : currentConfig?.pizza_count_gas_electric}
                    </div>
                  </div>
                )}

                {selectedInstallation && (
                  <div>
                    <div className="text-sm text-muted-foreground">Opzione</div>
                    <div className="font-semibold">
                      {selectedInstallation === "shipping" ? "Spedizione" : "Montaggio sul Posto"}
                    </div>
                  </div>
                )}

                {step >= 4 && selectedSize && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Forno</span>
                        <span>{formatAmount(getConfigPrice())}</span>
                      </div>
                      {selectedInstallation && (
                        <div className="flex justify-between text-sm">
                          <span>
                            {selectedInstallation === "shipping" ? "Spedizione" : "Montaggio"}
                          </span>
                          <span>{formatAmount(getInstallationPrice())}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-2xl font-bold">
                        <span>Totale:</span>
                        <span>{formatAmount(getTotalPrice())}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
