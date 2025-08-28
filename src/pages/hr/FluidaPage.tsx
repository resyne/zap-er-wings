import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, Calendar, RefreshCw, UserCheck, Coffee, AlertCircle, BarChart3 } from "lucide-react";

interface Employee {
  id: string;
  fluida_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  status: string;
  salary?: number;
  synced_at?: string;
}

interface Timesheet {
  id: string;
  employee_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  total_hours?: number;
  regular_hours?: number;
  overtime_hours?: number;
  status: string;
  notes?: string;
  hr_employees: Employee;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason?: string;
  hr_employees: Employee;
}

interface MonthlyReport {
  employee_id: string;
  employee_name: string;
  month: string;
  year: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_hours: number;
}

export default function FluidaPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    loadMonthlyReports();
  }, [selectedYear, selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('hr_employees')
        .select('*')
        .order('first_name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Load recent timesheets
      const { data: timesheetsData, error: timesheetsError } = await supabase
        .from('hr_timesheets')
        .select(`
          *,
          hr_employees (*)
        `)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (timesheetsError) throw timesheetsError;
      setTimesheets(timesheetsData || []);

      // Load pending leave requests
      const { data: leaveData, error: leaveError } = await supabase
        .from('hr_leave_requests')
        .select(`
          *,
          hr_employees (*)
        `)
        .order('created_at', { ascending: false });

      if (leaveError) throw leaveError;
      setLeaveRequests(leaveData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati HR",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReports = async () => {
    try {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      
      const { data, error } = await supabase
        .from('hr_timesheets')
        .select(`
          employee_id,
          regular_hours,
          overtime_hours,
          total_hours,
          hr_employees (
            first_name,
            last_name
          )
        `)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Aggregate hours by employee
      const aggregated = data?.reduce((acc: Record<string, MonthlyReport>, item) => {
        const employeeKey = item.employee_id;
        if (!acc[employeeKey]) {
          acc[employeeKey] = {
            employee_id: item.employee_id,
            employee_name: `${item.hr_employees.first_name} ${item.hr_employees.last_name}`,
            month: new Date(selectedYear, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long' }),
            year: selectedYear,
            total_regular_hours: 0,
            total_overtime_hours: 0,
            total_hours: 0
          };
        }
        
        acc[employeeKey].total_regular_hours += item.regular_hours || 0;
        acc[employeeKey].total_overtime_hours += item.overtime_hours || 0;
        acc[employeeKey].total_hours += item.total_hours || 0;
        
        return acc;
      }, {}) || {};

      setMonthlyReports(Object.values(aggregated));
    } catch (error) {
      console.error('Error loading monthly reports:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento del report mensile",
        variant: "destructive",
      });
    }
  };

  const syncWithFluida = async (action: string) => {
    console.log('Starting sync with action:', action);
    setSyncing(true);
    try {
      console.log('Invoking fluida-sync function...');
      const response = await supabase.functions.invoke('fluida-sync', {
        body: { action }
      });

      console.log('Full function response:', response);
      console.log('Response data:', response.data);
      console.log('Response error:', response.error);
      
      if (response.error) throw response.error;

      toast({
        title: "Sincronizzazione completata",
        description: response.data?.message || "Sincronizzazione completata",
      });

      // Reload data after sync
      await loadData();
      await loadMonthlyReports();

    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Errore sincronizzazione",
        description: "Errore durante la sincronizzazione con Fluida",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'active': 'default',
      'inactive': 'secondary',
      'pending': 'outline',
      'approved': 'default',
      'rejected': 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestione Risorse Umane</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncWithFluida('sync-all')}
            disabled={syncing}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizza tutto
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-muted-foreground">Dipendenti</p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <UserCheck className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-muted-foreground">Attivi</p>
                <p className="text-2xl font-bold">
                  {employees.filter(e => e.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Coffee className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm text-muted-foreground">Ferie in attesa</p>
                <p className="text-2xl font-bold">
                  {leaveRequests.filter(r => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-muted-foreground">Ore questa settimana</p>
                <p className="text-2xl font-bold">
                  {timesheets.reduce((sum, ts) => sum + (ts.total_hours || 0), 0).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Dipendenti</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheet</TabsTrigger>
          <TabsTrigger value="leave-requests">Ferie e Permessi</TabsTrigger>
          <TabsTrigger value="monthly-reports">Report Mensile</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lista Dipendenti</CardTitle>
              <Button 
                onClick={() => syncWithFluida('sync-employees')}
                disabled={syncing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizza
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Caricamento...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Dipartimento</TableHead>
                      <TableHead>Posizione</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data assunzione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          {employee.first_name} {employee.last_name}
                        </TableCell>
                        <TableCell>{employee.email || '-'}</TableCell>
                        <TableCell>{employee.department || '-'}</TableCell>
                        <TableCell>{employee.position || '-'}</TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                        <TableCell>
                          {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('it-IT') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Timesheet (Ultimi 7 giorni)</CardTitle>
              <Button 
                onClick={() => syncWithFluida('sync-timesheets')}
                disabled={syncing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizza
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Caricamento...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dipendente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrata</TableHead>
                      <TableHead>Uscita</TableHead>
                      <TableHead>Ore totali</TableHead>
                      <TableHead>Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map((timesheet) => (
                      <TableRow key={timesheet.id}>
                        <TableCell className="font-medium">
                          {timesheet.hr_employees.first_name} {timesheet.hr_employees.last_name}
                        </TableCell>
                        <TableCell>
                          {new Date(timesheet.date).toLocaleDateString('it-IT')}
                        </TableCell>
                        <TableCell>
                          {timesheet.clock_in ? new Date(timesheet.clock_in).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </TableCell>
                        <TableCell>
                          {timesheet.clock_out ? new Date(timesheet.clock_out).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </TableCell>
                        <TableCell>{timesheet.total_hours?.toFixed(1) || '-'}</TableCell>
                        <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave-requests">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Richieste Ferie e Permessi</CardTitle>
              <Button 
                onClick={() => syncWithFluida('sync-leave-requests')}
                disabled={syncing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizza
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Caricamento...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dipendente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Dal</TableHead>
                      <TableHead>Al</TableHead>
                      <TableHead>Giorni</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.hr_employees.first_name} {request.hr_employees.last_name}
                        </TableCell>
                        <TableCell>{request.leave_type}</TableCell>
                        <TableCell>
                          {new Date(request.start_date).toLocaleDateString('it-IT')}
                        </TableCell>
                        <TableCell>
                          {new Date(request.end_date).toLocaleDateString('it-IT')}
                        </TableCell>
                        <TableCell>{request.days_requested}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{request.reason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-reports">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Report Mensile Ore Lavorate</CardTitle>
              <div className="flex gap-2">
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => (
                      <SelectItem key={2024 - i} value={(2024 - i).toString()}>
                        {2024 - i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Caricamento...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dipendente</TableHead>
                      <TableHead>Mese/Anno</TableHead>
                      <TableHead>Ore Ordinarie</TableHead>
                      <TableHead>Ore Straordinarie</TableHead>
                      <TableHead>Totale Ore</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyReports.map((report) => (
                      <TableRow key={`${report.employee_id}-${report.year}-${report.month}`}>
                        <TableCell className="font-medium">
                          {report.employee_name}
                        </TableCell>
                        <TableCell>
                          {report.month} {report.year}
                        </TableCell>
                        <TableCell>
                          <span className="text-blue-600 font-medium">
                            {report.total_regular_hours.toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-orange-600 font-medium">
                            {report.total_overtime_hours.toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-bold">
                            {report.total_hours.toFixed(1)}h
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {monthlyReports.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nessun dato trovato per il periodo selezionato
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}