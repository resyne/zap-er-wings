import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function FluidaPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fluida - Gestione Risorse Umane</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluida HR Platform</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <iframe
            src="https://app.fluida.io/auth"
            className="w-full h-[800px] border-0 rounded-b-lg"
            title="Fluida HR Platform"
            allow="fullscreen"
          />
        </CardContent>
      </Card>
    </div>
  );
}