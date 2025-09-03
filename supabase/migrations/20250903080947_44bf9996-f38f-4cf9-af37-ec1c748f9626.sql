-- Restructure chart of accounts with hierarchical levels
-- First, add new columns for hierarchy
ALTER TABLE public.chart_of_accounts 
ADD COLUMN level INTEGER DEFAULT 1,
ADD COLUMN parent_code TEXT,
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Clear existing data to rebuild with new structure
DELETE FROM public.chart_of_accounts;

-- Insert new structured chart of accounts
-- Level 1 - Main Structure
INSERT INTO public.chart_of_accounts (code, name, account_type, category, level, parent_code, sort_order, is_active) VALUES
('01', 'Ricavi', 'revenue', 'main', 1, NULL, 10, true),
('02', 'Costo del Venduto (COGS)', 'cost', 'main', 1, NULL, 20, true),
('03', 'Opex (Spese Operative)', 'opex', 'main', 1, NULL, 30, true),
('07', 'Ammortamenti', 'depreciation', 'main', 1, NULL, 70, true),
('09', 'One-off / Altri Costi Straordinari', 'extraordinary', 'main', 1, NULL, 90, true);

-- Level 2 - Detail accounts
-- 01 Ricavi
INSERT INTO public.chart_of_accounts (code, name, account_type, category, level, parent_code, sort_order, is_active) VALUES
('01.01', 'Ricavi Macchine', 'revenue', 'machines', 2, '01', 101, true),
('01.02', 'Ricavi Installazioni', 'revenue', 'installations', 2, '01', 102, true),
('01.03', 'Ricavi Service', 'revenue', 'service', 2, '01', 103, true),
('01.03.1', 'Canoni Ricorrenti', 'revenue', 'recurring', 2, '01.03', 1031, true),
('01.03.2', 'Servizi Spot', 'revenue', 'spot_services', 2, '01.03', 1032, true);

-- 02 COGS
INSERT INTO public.chart_of_accounts (code, name, account_type, category, level, parent_code, sort_order, is_active) VALUES
('02.01', 'Materiali & Componenti', 'cost', 'materials', 2, '02', 201, true),
('02.02', 'Manodopera Diretta (ore tecnico)', 'cost', 'direct_labor', 2, '02', 202, true),
('02.03', 'Trasporti & Logistica', 'cost', 'transport', 2, '02', 203, true),
('02.99', 'Altri COGS (accantonamento temporaneo)', 'cost', 'other_cogs', 2, '02', 299, true);

-- 03 Opex
INSERT INTO public.chart_of_accounts (code, name, account_type, category, level, parent_code, sort_order, is_active) VALUES
('03.10', 'Personale (non diretto)', 'opex', 'personnel', 2, '03', 310, true),
('03.20', 'Marketing & Adv', 'opex', 'marketing', 2, '03', 320, true),
('03.30', 'Software & Cloud', 'opex', 'software', 2, '03', 330, true),
('03.40', 'Affitti/Utenze', 'opex', 'utilities', 2, '03', 340, true),
('03.50', 'Consulenze & Servizi Esterni', 'opex', 'consulting', 2, '03', 350, true),
('03.99', 'Altri Opex', 'opex', 'other_opex', 2, '03', 399, true);

-- 07 Ammortamenti
INSERT INTO public.chart_of_accounts (code, name, account_type, category, level, parent_code, sort_order, is_active) VALUES
('07.10', 'Ammortamenti Straordinario', 'depreciation', 'extraordinary', 2, '07', 710, true);

-- 09 One-off / Eventi Straordinari
INSERT INTO public.chart_of_accounts (code, name, account_type, category, level, parent_code, sort_order, is_active) VALUES
('09.10', 'One-off Costi Straordinari', 'extraordinary', 'extraordinary_costs', 2, '09', 910, true),
('09.90', 'Resi & Sconti (contra-ricavo)', 'extraordinary', 'returns_discounts', 2, '09', 990, true);

-- Create index for better performance on hierarchy queries
CREATE INDEX idx_chart_accounts_level ON public.chart_of_accounts(level);
CREATE INDEX idx_chart_accounts_parent_code ON public.chart_of_accounts(parent_code);
CREATE INDEX idx_chart_accounts_sort_order ON public.chart_of_accounts(sort_order);