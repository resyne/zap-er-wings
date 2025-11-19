import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: string; full_name: string }>;
  onSuccess: () => void;
}

export const AddAppointmentDialog = ({ open, onOpenChange, employees, onSuccess }: AddAppointmentDialogProps) => {
  const [appointmentType, setAppointmentType] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState<Date>();
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleEmployeeChange = (value: string) => {
    setEmployeeId(value);
    const employee = employees.find(e => e.id === value);
    if (employee) {
      setEmployeeName(employee.full_name);
    }
  };

  const handleSubmit = async () => {
    if (!appointmentType || !employeeName || !appointmentDate) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('safety_appointments')
        .insert({
          appointment_type: appointmentType,
          employee_id: employeeId || null,
          employee_name: employeeName,
          appointment_date: format(appointmentDate, 'yyyy-MM-dd'),
          expiry_date: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : null,
          is_active: isActive,
        });

      if (error) throw error;

      toast.success("Nomina aggiunta con successo");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error adding appointment:', error);
      toast.error("Errore durante l'aggiunta della nomina");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAppointmentType("");
    setEmployeeId("");
    setEmployeeName("");
    setAppointmentDate(undefined);
    setExpiryDate(undefined);
    setIsActive(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Nomina</DialogTitle>
          <DialogDescription>
            Registra una nuova nomina di sicurezza
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="appointment-type">Tipo Nomina *</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rspp">RSPP - Responsabile Servizio Prevenzione e Protezione</SelectItem>
                <SelectItem value="antincendio">Addetto Antincendio</SelectItem>
                <SelectItem value="primo_soccorso">Addetto Primo Soccorso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="employee">Seleziona Dipendente</Label>
            <Select value={employeeId} onValueChange={handleEmployeeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona dipendente" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="employee-name">Nome Nominato *</Label>
            <Input
              id="employee-name"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Nome del nominato"
            />
          </div>

          <div>
            <Label>Data Nomina *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !appointmentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {appointmentDate ? format(appointmentDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={appointmentDate}
                  onSelect={setAppointmentDate}
                  locale={it}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Data Scadenza (opzionale)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  locale={it}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is-active">Nomina attiva</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
