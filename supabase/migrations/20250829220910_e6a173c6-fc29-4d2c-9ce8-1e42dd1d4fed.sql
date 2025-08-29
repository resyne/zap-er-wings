-- Rimuovi la foreign key esistente che punta a auth.users (non sicuro)
ALTER TABLE public.work_orders 
DROP CONSTRAINT IF EXISTS work_orders_assigned_to_fkey;

-- Aggiungi foreign key corretta che punta alla tabella technicians
ALTER TABLE public.work_orders 
ADD CONSTRAINT work_orders_assigned_to_technician_fkey 
FOREIGN KEY (assigned_to) REFERENCES public.technicians(id)
ON DELETE SET NULL;