-- Aggiungi campi finanziari alla tabella sales_orders
ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoiced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Crea tabella per lo storico attività degli ordini
CREATE TABLE IF NOT EXISTS public.sales_order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_sales_order_logs_order_id ON public.sales_order_logs(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_logs_created_at ON public.sales_order_logs(created_at DESC);

-- Crea tabella per i commenti sugli ordini
CREATE TABLE IF NOT EXISTS public.sales_order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  tagged_users UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_sales_order_comments_order_id ON public.sales_order_comments(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_comments_created_at ON public.sales_order_comments(created_at DESC);

-- Abilita RLS per sales_order_logs
ALTER TABLE public.sales_order_logs ENABLE ROW LEVEL SECURITY;

-- Policy per visualizzare i log (tutti gli utenti autenticati)
CREATE POLICY "users_can_view_order_logs"
ON public.sales_order_logs
FOR SELECT
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Policy per creare log (solo il service role per trigger automatici)
CREATE POLICY "service_role_can_insert_order_logs"
ON public.sales_order_logs
FOR INSERT
WITH CHECK (true);

-- Abilita RLS per sales_order_comments
ALTER TABLE public.sales_order_comments ENABLE ROW LEVEL SECURITY;

-- Policy per visualizzare i commenti
CREATE POLICY "users_can_view_order_comments"
ON public.sales_order_comments
FOR SELECT
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Policy per creare commenti
CREATE POLICY "users_can_create_order_comments"
ON public.sales_order_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_minimum_role(auth.uid(), 'user'::app_role));

-- Policy per modificare i propri commenti
CREATE POLICY "users_can_update_own_order_comments"
ON public.sales_order_comments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy per eliminare i propri commenti
CREATE POLICY "users_can_delete_own_order_comments"
ON public.sales_order_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at sui commenti
CREATE OR REPLACE TRIGGER update_sales_order_comments_updated_at
BEFORE UPDATE ON public.sales_order_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Funzione per creare automaticamente log quando un ordine viene modificato
CREATE OR REPLACE FUNCTION public.log_sales_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO public.sales_order_logs (
      sales_order_id,
      user_id,
      action,
      details,
      new_values
    ) VALUES (
      NEW.id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      v_action,
      jsonb_build_object('message', 'Ordine creato'),
      v_new_values
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Log solo se ci sono cambiamenti significativi
    IF OLD.status IS DISTINCT FROM NEW.status OR
       OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
       OLD.invoiced IS DISTINCT FROM NEW.invoiced OR
       OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN
      
      INSERT INTO public.sales_order_logs (
        sales_order_id,
        user_id,
        action,
        details,
        old_values,
        new_values
      ) VALUES (
        NEW.id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        v_action,
        jsonb_build_object(
          'message', 'Ordine aggiornato',
          'changes', jsonb_build_object(
            'status', CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN jsonb_build_object('old', OLD.status, 'new', NEW.status) ELSE NULL END,
            'total_amount', CASE WHEN OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN jsonb_build_object('old', OLD.total_amount, 'new', NEW.total_amount) ELSE NULL END,
            'invoiced', CASE WHEN OLD.invoiced IS DISTINCT FROM NEW.invoiced THEN jsonb_build_object('old', OLD.invoiced, 'new', NEW.invoiced) ELSE NULL END,
            'invoice_number', CASE WHEN OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN jsonb_build_object('old', OLD.invoice_number, 'new', NEW.invoice_number) ELSE NULL END
          )
        ),
        v_old_values,
        v_new_values
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger per tracciare le modifiche agli ordini
DROP TRIGGER IF EXISTS log_sales_order_changes_trigger ON public.sales_orders;
CREATE TRIGGER log_sales_order_changes_trigger
AFTER INSERT OR UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_sales_order_changes();

-- Trigger per notificare gli utenti taggati nei commenti degli ordini
CREATE OR REPLACE TRIGGER notify_sales_order_comment_tags
AFTER INSERT ON public.sales_order_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_tagged();

-- Commenti sulle tabelle per documentazione
COMMENT ON TABLE public.sales_order_logs IS 'Storico di tutte le modifiche e azioni sugli ordini di vendita';
COMMENT ON TABLE public.sales_order_comments IS 'Commenti cronologici sugli ordini di vendita con supporto per tagging utenti';
COMMENT ON COLUMN public.sales_orders.total_amount IS 'Importo totale della commessa';
COMMENT ON COLUMN public.sales_orders.invoiced IS 'Indica se l''ordine è stato fatturato';
COMMENT ON COLUMN public.sales_orders.invoice_date IS 'Data di fatturazione';
COMMENT ON COLUMN public.sales_orders.invoice_number IS 'Numero fattura associata';