-- Rimuovo il constraint unico su extension_number
ALTER TABLE public.phone_extensions DROP CONSTRAINT phone_extensions_extension_number_key;

-- Creo un nuovo constraint unico sulla combinazione extension_number + pbx_id
CREATE UNIQUE INDEX phone_extensions_extension_pbx_unique ON public.phone_extensions (extension_number, pbx_id);