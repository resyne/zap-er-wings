ALTER TABLE invoice_registry DROP CONSTRAINT invoice_registry_vat_regime_check;
ALTER TABLE invoice_registry ADD CONSTRAINT invoice_registry_vat_regime_check 
CHECK (vat_regime = ANY (ARRAY['domestica_imponibile', 'ue_non_imponibile', 'extra_ue', 'reverse_charge', 'esente', 'ridotta_10', 'ridotta_4']));