import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CalendarDays, UserCheck, MapPin, Calendar, AlertTriangle, BarChart3, Settings, Plane } from "lucide-react";

const DashboardTab = lazy(() => import("./tabs/DashboardTab"));
const ShiftsPage = lazy(() => import("./ShiftsPage"));
const AttendancePresenzePage = lazy(() => import("./AttendancePresenzePage"));
const OvertimePage = lazy(() => import("./OvertimePage"));
const TravelPage = lazy(() => import("./TravelPage"));
const LeavesPage = lazy(() => import("./LeavesPage"));
const AnomaliesPage = lazy(() => import("./AnomaliesPage"));
const AttendanceReportsPage = lazy(() => import("./AttendanceReportsPage"));
const GeofencesPage = lazy(() => import("./GeofencesPage"));
const AttendanceSettingsPage = lazy(() => import("./AttendanceSettingsPage"));

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const tabs = [
  { value: "dashboard", label: "Dashboard", icon: Clock },
  { value: "presenze", label: "Presenze", icon: UserCheck },
  { value: "turni", label: "Turni", icon: CalendarDays },
  { value: "straordinari", label: "Straordinari", icon: Clock },
  { value: "trasferte", label: "Trasferte", icon: Plane },
  { value: "assenze", label: "Assenze", icon: Calendar },
  { value: "anomalie", label: "Anomalie", icon: AlertTriangle },
  { value: "report", label: "Report", icon: BarChart3 },
  { value: "geofences", label: "Geofences", icon: MapPin },
  { value: "impostazioni", label: "Impostazioni", icon: Settings },
];

export default function AttendanceDashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Time & Attendance</h1>
        <p className="text-muted-foreground">Gestione completa presenze, turni e timbrature</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b overflow-x-auto">
          <TabsList className="inline-flex h-auto gap-1 bg-transparent p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 px-3 py-2 text-sm data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="dashboard"><Suspense fallback={<Loader />}><DashboardTab /></Suspense></TabsContent>
        <TabsContent value="presenze"><Suspense fallback={<Loader />}><AttendancePresenzePage /></Suspense></TabsContent>
        <TabsContent value="turni"><Suspense fallback={<Loader />}><ShiftsPage /></Suspense></TabsContent>
        <TabsContent value="straordinari"><Suspense fallback={<Loader />}><OvertimePage /></Suspense></TabsContent>
        <TabsContent value="trasferte"><Suspense fallback={<Loader />}><TravelPage /></Suspense></TabsContent>
        <TabsContent value="assenze"><Suspense fallback={<Loader />}><LeavesPage /></Suspense></TabsContent>
        <TabsContent value="anomalie"><Suspense fallback={<Loader />}><AnomaliesPage /></Suspense></TabsContent>
        <TabsContent value="report"><Suspense fallback={<Loader />}><AttendanceReportsPage /></Suspense></TabsContent>
        <TabsContent value="geofences"><Suspense fallback={<Loader />}><GeofencesPage /></Suspense></TabsContent>
        <TabsContent value="impostazioni"><Suspense fallback={<Loader />}><AttendanceSettingsPage /></Suspense></TabsContent>
      </Tabs>
    </div>
  );
}
