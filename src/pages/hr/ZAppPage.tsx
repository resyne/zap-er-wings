import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  DollarSign, 
  Package2, 
  Wrench, 
  CalendarDays, 
  MessageCircle,
  Smartphone
} from "lucide-react";

const sections = [
  {
    title: "Rapporto Intervento",
    description: "Compila e consulta i rapporti di intervento",
    icon: FileText,
    color: "bg-blue-500",
    url: "/support/service-reports",
  },
  {
    title: "Registro Incasso/Spese",
    description: "Registra incassi e spese operative",
    icon: DollarSign,
    color: "bg-green-500",
    url: "/finance/prima-nota",
  },
  {
    title: "Magazzino",
    description: "Gestisci scorte, movimenti e materiali",
    icon: Package2,
    color: "bg-amber-500",
    url: "/wms/stock",
  },
  {
    title: "Commesse",
    description: "Lavoro, produzione e spedizione",
    icon: Wrench,
    color: "bg-purple-500",
    url: "/direzione/orders",
  },
  {
    title: "Calendario Lavori",
    description: "Lavori programmati e calendario",
    icon: CalendarDays,
    color: "bg-indigo-500",
    url: "/direzione/calendario",
  },
  {
    title: "Comunicazioni",
    description: "Messaggi e comunicazioni interne",
    icon: MessageCircle,
    color: "bg-rose-500",
    url: "/hr/z-app/comunicazioni",
  },
];

export default function ZAppPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Smartphone className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Z-APP</h1>
            <p className="text-blue-100 text-sm">App per personale operativo</p>
          </div>
        </div>
      </div>

      {/* Grid di bottoni */}
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {sections.map((section) => (
            <button
              key={section.title}
              onClick={() => navigate(section.url)}
              className="flex flex-col items-center gap-3 p-5 sm:p-6 bg-white rounded-2xl shadow-sm border border-border hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200 text-center"
            >
              <div className={`h-14 w-14 rounded-2xl ${section.color} flex items-center justify-center shadow-sm`}>
                <section.icon className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm leading-tight">{section.title}</p>
                <p className="text-muted-foreground text-[11px] mt-1 leading-tight hidden sm:block">{section.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
