import { lazy, Suspense } from "react";
import { Receipt } from "lucide-react";

const RegistroContabileContent = lazy(() => import("@/pages/management-control-2/RegistroContabilePage"));

export default function RegistroContabilePage() {
  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro Contabile</h1>
          <p className="text-sm text-muted-foreground">Registrazione e contabilizzazione di fatture e documenti fiscali</p>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          </div>
        </div>
      }>
        <RegistroContabileContent />
      </Suspense>
    </div>
  );
}
