ALTER TABLE accounting_entries DROP CONSTRAINT accounting_entries_document_type_check;
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_document_type_check CHECK (document_type = ANY (ARRAY['fattura','scontrino','estratto_conto','documento_interno','rapporto_intervento','altro','movimento','nota_credito']));
