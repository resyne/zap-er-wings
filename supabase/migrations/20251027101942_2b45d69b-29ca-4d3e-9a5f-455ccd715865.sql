-- Create table for work order article items with checkable status
CREATE TABLE public.work_order_article_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.work_order_article_items ENABLE ROW LEVEL SECURITY;

-- Create policies for work_order_article_items
CREATE POLICY "Users can view work order article items"
ON public.work_order_article_items
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create work order article items"
ON public.work_order_article_items
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update work order article items"
ON public.work_order_article_items
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete work order article items"
ON public.work_order_article_items
FOR DELETE
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_work_order_article_items_updated_at
BEFORE UPDATE ON public.work_order_article_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_work_order_article_items_work_order_id ON public.work_order_article_items(work_order_id);
CREATE INDEX idx_work_order_article_items_is_completed ON public.work_order_article_items(is_completed);